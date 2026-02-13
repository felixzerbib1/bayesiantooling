#!/usr/bin/env node

/**
 * generate-tests.js — Test plan generator
 *
 * Reads:   ../data/feature-flags.json       (customer configs — source of truth)
 *          data/test-definitions.json        (scenarios & flag test criteria)
 *
 * Writes:  test-plans/test-plan-{customer}.csv   (one per customer)
 *
 * Usage:   node generate-tests.js
 *          node generate-tests.js --customer medstar_health
 */

const fs = require("fs");
const path = require("path");

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT = __dirname;
const FLAG_DATA_PATH = path.join(ROOT, "..", "data", "feature-flags.json");
const TEST_DEF_PATH = path.join(ROOT, "data", "test-definitions.json");
const OUTPUT_DIR = path.join(ROOT, "test-plans");

// ─── Load data ────────────────────────────────────────────────────────────────
let flagData, testDefs;

try {
  flagData = JSON.parse(fs.readFileSync(FLAG_DATA_PATH, "utf-8"));
} catch (err) {
  console.error(`Error reading feature flags: ${err.message}`);
  console.error(`Expected at: ${FLAG_DATA_PATH}`);
  process.exit(1);
}

try {
  testDefs = JSON.parse(fs.readFileSync(TEST_DEF_PATH, "utf-8"));
} catch (err) {
  console.error(`Error reading test definitions: ${err.message}`);
  console.error(`Expected at: ${TEST_DEF_PATH}`);
  process.exit(1);
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let filterCustomer = null;
const customerArgIdx = args.indexOf("--customer");
if (customerArgIdx !== -1 && args[customerArgIdx + 1]) {
  filterCustomer = args[customerArgIdx + 1];
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values) {
  return values.map(csvEscape).join(",");
}

// ─── EHR terminology resolver ─────────────────────────────────────────────────
function resolveEhrTerms(text, ehr) {
  const terms = testDefs.ehrTerminology[ehr] || testDefs.ehrTerminology["Epic"];
  return text
    .replace(/\{flowsheet\}/g, terms.flowsheet)
    .replace(/\{patientList\}/g, terms.patientList)
    .replace(/\{alertFlag\}/g, terms.alertFlag)
    .replace(/\{noteType\}/g, terms.noteType)
    .replace(/\{orderEntry\}/g, terms.orderEntry)
    .replace(/\{storyboard\}/g, terms.storyboard);
}

// ─── Role label resolver ──────────────────────────────────────────────────────
function roleLabel(roleKey) {
  if (!roleKey) return "--";
  const role = testDefs.roles[roleKey];
  return role ? role.label : roleKey;
}

// ─── Template variable resolver ───────────────────────────────────────────────
function resolveTemplateVars(text, scenario) {
  const profile = scenario.patientProfile || {};
  return text
    .replace(/\{chiefComplaint\}/g, profile.chiefComplaint || "")
    .replace(/\{diagnosis\}/g, profile.diagnosis || "")
    .replace(/\{labOrders\}/g, profile.labs?.orders?.join(", ") || "")
    .replace(/\{labResults\}/g, profile.labs?.results || "")
    .replace(/\{problemList\}/g, profile.problemList || "")
    .replace(/\{medicalHistory\}/g, profile.medicalHistory || "")
    .replace(/\{antibiotics\}/g, profile.antibiotics || "");
}

// ─── Check if scenario applies to customer ────────────────────────────────────
function scenarioApplies(scenario, customer, customerConfig) {
  // Customer must have the product
  if (!customer.products.includes(scenario.product)) return false;

  // Check required flags — if a scenario requires certain flags, they must be enabled
  if (scenario.requiredFlags && scenario.requiredFlags.length > 0) {
    const productConfig = customerConfig?.[scenario.product];
    if (!productConfig) return false;
    for (const flagKey of scenario.requiredFlags) {
      if (productConfig.flags[flagKey] !== true) return false;
    }
  }

  return true;
}

// ─── Get applicable flag tests for a customer/product ─────────────────────────
function getFlagTests(customer, productKey, customerConfig) {
  const productConfig = customerConfig?.[productKey];
  if (!productConfig) return { enabled: [], disabled: [] };

  const enabled = [];
  const disabled = [];

  // Walk all flag definitions for this product
  for (const [catKey, catFlags] of Object.entries(flagData.flagDefinitions)) {
    for (const flag of catFlags) {
      // Check if flag applies to this product
      if (flag.applicableProducts !== "all" && !flag.applicableProducts.includes(productKey)) {
        continue;
      }

      const testCriteria = testDefs.flagTestCriteria[flag.key];
      if (!testCriteria) continue;

      const value = productConfig.flags[flag.key];
      if (value === true) {
        if (testCriteria.whenEnabled) {
          enabled.push({ flag, criteria: testCriteria.whenEnabled, category: catKey });
        }
      } else if (value === false) {
        if (testCriteria.whenDisabled) {
          disabled.push({ flag, criteria: testCriteria.whenDisabled, category: catKey });
        }
      }
    }
  }

  return { enabled, disabled };
}

// ─── Category label helper ────────────────────────────────────────────────────
function categoryLabel(catKey) {
  return catKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Generate test plan CSV for a customer ────────────────────────────────────
function generateTestPlan(customer) {
  const ehr = customer.ehr;
  const customerConfig = flagData.configurations[customer.key];
  const rows = [];

  // Header
  rows.push(csvRow([
    "Test Step #",
    "Section",
    "Scenario / Flag",
    "User",
    "Test Step Description",
    "Expected Result",
    "Test Result",
    "Pass/Fail",
    "Description of failure/issues",
  ]));

  let stepNum = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 1: SCENARIO-BASED TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  for (const scenario of testDefs.scenarios) {
    if (!scenarioApplies(scenario, customer, customerConfig)) continue;

    // Scenario header row
    stepNum++;
    rows.push(csvRow([
      "",
      "SCENARIO",
      `=== ${scenario.name} ===`,
      "",
      scenario.description,
      `Workflow: ${scenario.workflow}`,
      "",
      "",
      "",
    ]));

    // Patient profile info row
    if (scenario.patientProfile) {
      const p = scenario.patientProfile;
      stepNum++;
      rows.push(csvRow([
        "",
        "PATIENT SETUP",
        scenario.name,
        "",
        `Test Patient: Age ${p.age}, ${p.sex}, ${p.location}. Chief Complaint: ${p.chiefComplaint || "N/A"}`,
        "",
        "",
        "",
        "",
      ]));
    }

    // Setup steps
    for (const step of scenario.setupSteps) {
      stepNum++;
      const action = resolveEhrTerms(resolveTemplateVars(step.action, scenario), ehr);
      const expected = resolveEhrTerms(resolveTemplateVars(step.expected, scenario), ehr);
      rows.push(csvRow([
        stepNum,
        "Setup",
        scenario.name,
        roleLabel(step.role),
        action,
        expected,
        "",
        "",
        "",
      ]));
    }

    // Core test steps
    for (const step of scenario.coreTestSteps) {
      stepNum++;
      const action = resolveEhrTerms(resolveTemplateVars(step.action, scenario), ehr);
      const expected = resolveEhrTerms(resolveTemplateVars(step.expected, scenario), ehr);
      rows.push(csvRow([
        stepNum,
        "Bayesian UI Test",
        scenario.name,
        roleLabel(step.role),
        action,
        expected,
        "",
        "",
        "",
      ]));
    }

    // Flag-specific verification steps for this scenario's product
    // (only for scenario-relevant flags — enabled ones get verification steps)
    const scenarioProduct = scenario.product;
    const { enabled: enabledFlags } = getFlagTests(customer, scenarioProduct, customerConfig);

    // Filter to flags that make sense in this scenario context
    // For bundle-tracking scenarios, include bundle flags
    // For all scenarios, include writeback and regulatory checks
    const relevantCategories = new Set();
    if (scenario.key.includes("sepsis_ed") || scenario.key.includes("septic_shock")) {
      // Full flow scenarios — check all applicable enabled flags
      relevantCategories.add("assessment_writeback");
      relevantCategories.add("documentation");
      relevantCategories.add("regulatory");
      if (scenario.requiredFlags?.includes("bundle_tracking")) {
        relevantCategories.add("bundle_manager");
      }
    }
    if (scenario.key === "no_sepsis_no_infection") {
      relevantCategories.add("assessment_writeback");
      relevantCategories.add("contributing_factors");
    }
    if (scenario.key === "abx_workflow") {
      relevantCategories.add("suppression");
    }
    if (scenario.key === "comfort_care_suppression") {
      relevantCategories.add("suppression");
    }
    if (scenario.key === "septic_shock_rnf_to_icu") {
      relevantCategories.add("assessment_writeback");
      relevantCategories.add("contributing_factors");
    }

    const scenarioFlagTests = enabledFlags.filter((f) => relevantCategories.has(f.category));

    if (scenarioFlagTests.length > 0) {
      // Section header for flag verification
      rows.push(csvRow([
        "",
        "FLAG VERIFICATION",
        scenario.name,
        "",
        "--- Feature-specific verification steps (auto-generated from enabled flags) ---",
        "",
        "",
        "",
        "",
      ]));

      for (const flagTest of scenarioFlagTests) {
        for (const criterion of flagTest.criteria) {
          stepNum++;
          const stepText = resolveEhrTerms(criterion.step, ehr);
          rows.push(csvRow([
            stepNum,
            "Flag Verification",
            `${flagTest.flag.name} [${flagTest.flag.key}]`,
            roleLabel(criterion.role),
            stepText,
            "VERIFY",
            "",
            "",
            "",
          ]));
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 2: DISABLED FLAG ABSENCE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  for (const productKey of customer.products) {
    const { disabled: disabledFlags } = getFlagTests(customer, productKey, customerConfig);

    if (disabledFlags.length > 0) {
      const productName = flagData.products.find((p) => p.key === productKey)?.name || productKey;

      rows.push(csvRow([
        "",
        "ABSENCE TESTS",
        `=== ${productName}: Disabled Flag Verification ===`,
        "",
        "Verify that disabled features do NOT appear in the application",
        "",
        "",
        "",
        "",
      ]));

      let currentCategory = null;
      for (const flagTest of disabledFlags) {
        // Category header
        if (flagTest.category !== currentCategory) {
          currentCategory = flagTest.category;
          rows.push(csvRow([
            "",
            "Absence Test",
            `--- ${categoryLabel(flagTest.category)} ---`,
            "",
            "",
            "",
            "",
            "",
            "",
          ]));
        }

        for (const criterion of flagTest.criteria) {
          stepNum++;
          const stepText = resolveEhrTerms(criterion.step, ehr);
          rows.push(csvRow([
            stepNum,
            "Absence Test",
            `${flagTest.flag.name} [${flagTest.flag.key}]`,
            roleLabel(criterion.role),
            stepText,
            "VERIFY ABSENT",
            "",
            "",
            "",
          ]));
        }
      }
    }
  }

  return rows.join("\n");
}

// ─── Summary stats ────────────────────────────────────────────────────────────
function getTestPlanStats(customer) {
  const customerConfig = flagData.configurations[customer.key];
  let scenarioCount = 0;
  let enabledFlagCount = 0;
  let disabledFlagCount = 0;

  for (const scenario of testDefs.scenarios) {
    if (scenarioApplies(scenario, customer, customerConfig)) {
      scenarioCount++;
    }
  }

  for (const productKey of customer.products) {
    const { enabled, disabled } = getFlagTests(customer, productKey, customerConfig);
    enabledFlagCount += enabled.length;
    disabledFlagCount += disabled.length;
  }

  return { scenarioCount, enabledFlagCount, disabledFlagCount };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

function main() {
  console.log("Test Plan Generator");
  console.log("===================\n");
  console.log(`Feature Flags: ${FLAG_DATA_PATH}`);
  console.log(`Test Definitions: ${TEST_DEF_PATH}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const customers = filterCustomer
    ? flagData.customers.filter((c) => c.key === filterCustomer)
    : flagData.customers;

  if (customers.length === 0) {
    console.error(`No customer found matching: ${filterCustomer}`);
    process.exit(1);
  }

  let totalPlans = 0;

  for (const customer of customers) {
    const stats = getTestPlanStats(customer);
    const csv = generateTestPlan(customer);
    const filename = `test-plan-${customer.key}.csv`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, csv, "utf-8");

    const lineCount = csv.split("\n").length;
    console.log(
      `  ✓ ${filename}  (${lineCount} rows | ${stats.scenarioCount} scenarios | ${stats.enabledFlagCount} enabled flags | ${stats.disabledFlagCount} absence tests)`
    );
    totalPlans++;
  }

  console.log(`\n✓ Generated ${totalPlans} test plan(s) in test-plans/`);
  console.log("\nDone!");
}

main();
