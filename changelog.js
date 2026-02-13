#!/usr/bin/env node

/**
 * changelog.js — Detect feature flag changes and notify
 *
 * Compares feature-flags.json between the current state and the last
 * committed version (or any two git refs). If changes are detected:
 *   1. Prints a human-readable changelog to stdout
 *   2. Posts a summary to Slack via webhook (if SLACK_WEBHOOK_URL is set)
 *
 * Usage:
 *   node changelog.js                     # compare working tree vs HEAD
 *   node changelog.js HEAD~1 HEAD         # compare two commits
 *   node changelog.js abc123 def456       # compare two specific refs
 *   node changelog.js --dry-run           # print changelog without sending to Slack
 *
 * Environment:
 *   SLACK_WEBHOOK_URL    — Slack incoming webhook URL (optional; skips Slack if unset)
 *
 * Can also be called programmatically:
 *   const { detectChanges, formatChangelog, formatSlackMessage, postToSlack } = require('./changelog');
 */

const { execSync } = require("child_process");
const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = __dirname;
const JSON_REL_PATH = "data/feature-flags.json";
const JSON_ABS_PATH = path.join(ROOT, JSON_REL_PATH);

// ─── Git helpers ──────────────────────────────────────────────────────────────

function getJsonAtRef(ref) {
  try {
    const raw = execSync(`git show ${ref}:${JSON_REL_PATH}`, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCurrentJson() {
  try {
    return JSON.parse(fs.readFileSync(JSON_ABS_PATH, "utf-8"));
  } catch {
    return null;
  }
}

// ─── Diff engine ──────────────────────────────────────────────────────────────

function detectChanges(oldData, newData) {
  const changes = {
    customersAdded: [],
    customersRemoved: [],
    productsAdded: [],
    productsRemoved: [],
    flagsAdded: [],
    flagsRemoved: [],
    configChanges: [], // { customer, product, flag, oldValue, newValue }
    noteChanges: [], // { customer, product, flag, oldNote, newNote }
    customerProductChanges: [], // { customer, added: [], removed: [] }
  };

  if (!oldData || !newData) return changes;

  // ── Product changes ─────────────────────────────────────────────────────
  const oldProductKeys = new Set(oldData.products.map((p) => p.key));
  const newProductKeys = new Set(newData.products.map((p) => p.key));
  for (const p of newData.products) {
    if (!oldProductKeys.has(p.key)) changes.productsAdded.push(p);
  }
  for (const p of oldData.products) {
    if (!newProductKeys.has(p.key)) changes.productsRemoved.push(p);
  }

  // ── Customer changes ───────────────────────────────────────────────────
  const oldCustomerKeys = new Set(oldData.customers.map((c) => c.key));
  const newCustomerKeys = new Set(newData.customers.map((c) => c.key));
  for (const c of newData.customers) {
    if (!oldCustomerKeys.has(c.key)) changes.customersAdded.push(c);
  }
  for (const c of oldData.customers) {
    if (!newCustomerKeys.has(c.key)) changes.customersRemoved.push(c);
  }

  // ── Customer product assignment changes ─────────────────────────────────
  for (const newCust of newData.customers) {
    const oldCust = oldData.customers.find((c) => c.key === newCust.key);
    if (!oldCust) continue;
    const oldProds = new Set(oldCust.products);
    const newProds = new Set(newCust.products);
    const added = [...newProds].filter((p) => !oldProds.has(p));
    const removed = [...oldProds].filter((p) => !newProds.has(p));
    if (added.length || removed.length) {
      changes.customerProductChanges.push({
        customer: newCust.name,
        customerKey: newCust.key,
        added,
        removed,
      });
    }
  }

  // ── Flag definition changes ─────────────────────────────────────────────
  const oldFlagKeys = new Set();
  const newFlagKeys = new Set();
  for (const flags of Object.values(oldData.flagDefinitions || {})) {
    for (const f of flags) oldFlagKeys.add(f.key);
  }
  for (const flags of Object.values(newData.flagDefinitions || {})) {
    for (const f of flags) newFlagKeys.add(f.key);
  }
  for (const key of newFlagKeys) {
    if (!oldFlagKeys.has(key)) changes.flagsAdded.push(key);
  }
  for (const key of oldFlagKeys) {
    if (!newFlagKeys.has(key)) changes.flagsRemoved.push(key);
  }

  // ── Configuration value changes ─────────────────────────────────────────
  const allCustomerKeys = new Set([...oldCustomerKeys, ...newCustomerKeys]);

  for (const custKey of allCustomerKeys) {
    const oldCust = oldData.customers.find((c) => c.key === custKey);
    const newCust = newData.customers.find((c) => c.key === custKey);
    if (!oldCust || !newCust) continue; // new/removed customers handled above

    const customerName = newCust.name;
    const oldConfig = oldData.configurations[custKey] || {};
    const newConfig = newData.configurations[custKey] || {};

    // Check all products
    const allProducts = new Set([
      ...Object.keys(oldConfig),
      ...Object.keys(newConfig),
    ]);

    for (const prodKey of allProducts) {
      const productName =
        newData.products.find((p) => p.key === prodKey)?.name || prodKey;
      const oldFlags = oldConfig[prodKey]?.flags || {};
      const newFlags = newConfig[prodKey]?.flags || {};
      const oldNotes = oldConfig[prodKey]?.notes || {};
      const newNotes = newConfig[prodKey]?.notes || {};

      // Flag value changes
      const allFlagKeys = new Set([
        ...Object.keys(oldFlags),
        ...Object.keys(newFlags),
      ]);
      for (const flagKey of allFlagKeys) {
        const oldVal = oldFlags[flagKey];
        const newVal = newFlags[flagKey];
        if (oldVal !== newVal) {
          changes.configChanges.push({
            customer: customerName,
            customerKey: custKey,
            product: productName,
            productKey: prodKey,
            flag: flagKey,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }

      // Note changes
      const allNoteKeys = new Set([
        ...Object.keys(oldNotes),
        ...Object.keys(newNotes),
      ]);
      for (const flagKey of allNoteKeys) {
        const oldNote = oldNotes[flagKey] || "";
        const newNote = newNotes[flagKey] || "";
        if (oldNote !== newNote) {
          changes.noteChanges.push({
            customer: customerName,
            customerKey: custKey,
            product: productName,
            productKey: prodKey,
            flag: flagKey,
            oldNote,
            newNote,
          });
        }
      }
    }
  }

  return changes;
}

function hasChanges(changes) {
  return (
    changes.customersAdded.length > 0 ||
    changes.customersRemoved.length > 0 ||
    changes.productsAdded.length > 0 ||
    changes.productsRemoved.length > 0 ||
    changes.flagsAdded.length > 0 ||
    changes.flagsRemoved.length > 0 ||
    changes.configChanges.length > 0 ||
    changes.noteChanges.length > 0 ||
    changes.customerProductChanges.length > 0
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatValue(val) {
  if (val === true) return "Enabled";
  if (val === false) return "Disabled";
  if (val === undefined) return "—";
  return String(val);
}

function formatValueShort(val) {
  if (val === true) return "Y";
  if (val === false) return "N";
  if (val === undefined) return "—";
  return String(val);
}

function flagDisplayName(flagKey) {
  return flagKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format changes as a human-readable changelog (terminal output)
 */
function formatChangelog(changes, oldRef, newRef) {
  const lines = [];
  const ln = (s = "") => lines.push(s);

  ln("═══════════════════════════════════════════════════════");
  ln("  FEATURE FLAG CHANGELOG");
  ln(`  ${oldRef || "previous"} → ${newRef || "current"}`);
  ln(`  ${new Date().toISOString().split("T")[0]}`);
  ln("═══════════════════════════════════════════════════════");
  ln();

  if (!hasChanges(changes)) {
    ln("  No changes detected.");
    return lines.join("\n");
  }

  // Products
  if (changes.productsAdded.length) {
    ln("📦 Products Added:");
    for (const p of changes.productsAdded) ln(`  + ${p.name}`);
    ln();
  }
  if (changes.productsRemoved.length) {
    ln("📦 Products Removed:");
    for (const p of changes.productsRemoved) ln(`  - ${p.name}`);
    ln();
  }

  // Customers
  if (changes.customersAdded.length) {
    ln("🏥 Customers Added:");
    for (const c of changes.customersAdded)
      ln(`  + ${c.name} (${c.products.join(", ")})`);
    ln();
  }
  if (changes.customersRemoved.length) {
    ln("🏥 Customers Removed:");
    for (const c of changes.customersRemoved) ln(`  - ${c.name}`);
    ln();
  }

  // Customer product changes
  if (changes.customerProductChanges.length) {
    ln("🔄 Customer Product Changes:");
    for (const cp of changes.customerProductChanges) {
      if (cp.added.length)
        ln(`  ${cp.customer}: + ${cp.added.join(", ")}`);
      if (cp.removed.length)
        ln(`  ${cp.customer}: - ${cp.removed.join(", ")}`);
    }
    ln();
  }

  // Flag definitions
  if (changes.flagsAdded.length) {
    ln("🆕 New Flag Definitions:");
    for (const f of changes.flagsAdded) ln(`  + ${f}`);
    ln();
  }
  if (changes.flagsRemoved.length) {
    ln("🗑️  Removed Flag Definitions:");
    for (const f of changes.flagsRemoved) ln(`  - ${f}`);
    ln();
  }

  // Config changes — grouped by customer
  if (changes.configChanges.length) {
    ln("⚙️  Configuration Changes:");
    ln();

    // Group by customer
    const byCustomer = {};
    for (const c of changes.configChanges) {
      const key = `${c.customer} / ${c.product}`;
      if (!byCustomer[key]) byCustomer[key] = [];
      byCustomer[key].push(c);
    }

    for (const [group, items] of Object.entries(byCustomer)) {
      ln(`  ${group}:`);
      for (const item of items) {
        ln(
          `    ${item.flag}: ${formatValue(item.oldValue)} → ${formatValue(item.newValue)}`
        );
      }
      ln();
    }
  }

  // Note changes
  if (changes.noteChanges.length) {
    ln("📝 Note Changes:");
    for (const n of changes.noteChanges) {
      if (n.newNote && !n.oldNote) {
        ln(`  ${n.customer} / ${n.flag}: added note`);
      } else if (!n.newNote && n.oldNote) {
        ln(`  ${n.customer} / ${n.flag}: removed note`);
      } else {
        ln(`  ${n.customer} / ${n.flag}: updated note`);
      }
    }
    ln();
  }

  // Summary
  const totalChanges =
    changes.configChanges.length +
    changes.noteChanges.length +
    changes.flagsAdded.length +
    changes.flagsRemoved.length +
    changes.customersAdded.length +
    changes.customersRemoved.length;
  ln(`─── ${totalChanges} total change(s) ───`);

  return lines.join("\n");
}

/**
 * Format changes as a Slack message (Block Kit)
 */
function formatSlackMessage(changes, viewerUrl) {
  const blocks = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Feature Flag Update",
    },
  });

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `*${new Date().toISOString().split("T")[0]}* | ${changes.configChanges.length} flag change(s)`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // Config changes — grouped by customer
  if (changes.configChanges.length) {
    const byCustomer = {};
    for (const c of changes.configChanges) {
      const key = c.customer;
      if (!byCustomer[key]) byCustomer[key] = { product: c.product, items: [] };
      byCustomer[key].items.push(c);
    }

    for (const [customer, { product, items }] of Object.entries(byCustomer)) {
      let text = `*${customer}* — ${product}\n`;
      for (const item of items) {
        const emoji = item.newValue === true ? ":large_green_circle:" : ":red_circle:";
        text += `${emoji}  \`${item.flag}\`: ${formatValueShort(item.oldValue)} → ${formatValueShort(item.newValue)}\n`;
      }
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: text.trim() },
      });
    }
  }

  // New customers
  if (changes.customersAdded.length) {
    let text = "*New Customers*\n";
    for (const c of changes.customersAdded) {
      text += `:hospital:  ${c.name} (${c.products.join(", ")})\n`;
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: text.trim() },
    });
  }

  // New flags
  if (changes.flagsAdded.length) {
    let text = "*New Flags*\n";
    for (const f of changes.flagsAdded) {
      text += `:new:  \`${f}\`\n`;
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: text.trim() },
    });
  }

  // Footer with link
  if (viewerUrl) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${viewerUrl}|View Dashboard>`,
        },
      ],
    });
  }

  return { blocks };
}

// ─── Slack sender ─────────────────────────────────────────────────────────────

function postToSlack(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(message);
    const url = new URL(webhookUrl);
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            resolve(body);
          } else {
            reject(new Error(`Slack API returned ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  let oldData, newData;
  let oldRef = "HEAD";
  let newRef = "working tree";

  if (filteredArgs.length === 2) {
    // Compare two refs
    oldRef = filteredArgs[0];
    newRef = filteredArgs[1];
    oldData = getJsonAtRef(oldRef);
    newData = getJsonAtRef(newRef);
  } else if (filteredArgs.length === 1) {
    // Compare one ref against working tree
    oldRef = filteredArgs[0];
    oldData = getJsonAtRef(oldRef);
    newData = getCurrentJson();
  } else {
    // Compare HEAD against working tree
    oldData = getJsonAtRef("HEAD");
    newData = getCurrentJson();
  }

  if (!oldData) {
    console.error(`Could not read feature-flags.json at ref: ${oldRef}`);
    process.exit(1);
  }
  if (!newData) {
    console.error(`Could not read feature-flags.json at ref: ${newRef}`);
    process.exit(1);
  }

  const changes = detectChanges(oldData, newData);

  // Print changelog
  console.log(formatChangelog(changes, oldRef, newRef));

  if (!hasChanges(changes)) {
    process.exit(0);
  }

  // Slack notification
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("\n💡 Set SLACK_WEBHOOK_URL to enable Slack notifications.");
    console.log(
      "   Example: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../xxx node changelog.js"
    );
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n🔕 Dry run — Slack message preview:");
    const slackMsg = formatSlackMessage(
      changes,
      "https://feature-flag-app-pied.vercel.app/"
    );
    console.log(JSON.stringify(slackMsg, null, 2));
    process.exit(0);
  }

  // Send to Slack
  try {
    const slackMsg = formatSlackMessage(
      changes,
      "https://feature-flag-app-pied.vercel.app/"
    );
    await postToSlack(webhookUrl, slackMsg);
    console.log("\n✅ Slack notification sent.");
  } catch (err) {
    console.error(`\n❌ Slack notification failed: ${err.message}`);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  detectChanges,
  hasChanges,
  formatChangelog,
  formatSlackMessage,
  postToSlack,
};

// Run if called directly
if (require.main === module) {
  main();
}
