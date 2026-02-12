# Feature Flag Taxonomy — Engineering & Product Review

> **Purpose:** Align on a cross-cutting feature flag taxonomy that serves as the single source of truth for all customer-facing flag configurations.
>
> **Audience:** Engineering, Product, Product Operations
>
> **Prepared for:** Engineering/Product sync
>
> **Date:** 2026-02-12

---

## 1. Context

We have built a feature flag configuration viewer (`index.html`) that gives customer-facing teams (CS, Product Ops, Product) a read-only view of which flags are enabled per customer. The data lives in `data/feature-flags.json` and is generated into a static HTML viewer and a markdown reference.

To build this, we sourced flag data from:
- **Frontend Integration Checklists** (PDFs) — Memorial Care, Inova, ThedaCare, MedStar, Northwell
- **Kubernetes config-patch YAMLs** — LifeBridge (staging), Memorial Care (production), URMC (staging), Inova (staging), CCF (staging), ThedaCare (staging)
- **Tribal knowledge** — product/engineering conversations

This document captures the current taxonomy, identifies gaps between the YAML configs and the JSON schema, and proposes a set of decisions for the team to make.

---

## 2. Current Taxonomy (38 flags, 9 categories)

### Assessment & Writeback (8 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 1 | `nurse_writeback_flowsheet` | Nurse Assessment - Auto Writeback to Flowsheet Rows | `ENABLE_NURSE_ASSESSMENT_WRITEBACK`, `ASSESSMENT_WRITEBACK_ENABLED` | Mapped |
| 2 | `nurse_writeback_note` | Nurse Assessment - Auto Writeback as Clinical Note | `ENABLE_NURSE_DOCUMENTATION_NOTE_WRITEBACK_ON_ASSESSMENT_SUBMISSION` | Mapped |
| 3 | `nurse_escalation_questions` | Nurse Assessment - Provider Escalation Questions | `ENABLE_PROVIDER_ESCALATED_QUESTION_IN_SEPSIS_NURSE_ASSESSMENT` | Mapped |
| 4 | `nursing_q1_not_diagnostic` | Nursing Question 1 - Not Diagnostic Tooltip | — | **Unmapped** |
| 5 | `provider_flowsheet_writeback` | Provider Assessment - Auto Flowsheet Writeback | `ENABLE_PROVIDER_ASSESSMENT_WRITEBACK` | Mapped |
| 6 | `auto_writeback_note_type` | Automatic Flowsheet Writeback of Note Type | `ENABLE_DOCUMENTATION_FORM_WRITEBACK` | Mapped |
| 7 | `provider_unsure_followup` | Provider Follow-Up on Unsure Response | `ENABLE_PROVIDER_QUESTION_ON_UNSURE_RESPONSE` | Mapped |
| 8 | `sepsis_deescalation` | Sepsis De-escalation | `SEPSIS_DEESCALATION_ENABLED` (5 ConfigMaps) | Mapped |

### Documentation (4 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 9 | `create_new_note` | Create a New Note Button | `ENABLE_PROVIDER_DOCUMENTATION_NOTE_WRITEBACK` + `DOCUMENTATION_AUTO_GENERATED_NOTE_ENABLED` | Composite |
| 10 | `add_to_existing_note` | Add to Existing Note Button | `DOCUMENTATION_FHIR_WRITEBACK_ENABLED` | Mapped |
| 11 | `provider_doc_tab` | Provider Documentation Tab in Treatment Management | `SHOW_SEPSIS_PROVIDER_DOCUMENTATION` | Mapped (see Gap 5) |
| 12 | `nursing_documentation` | Nursing Documentation | — | **Unmapped** |

### Bundle Manager (14 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 13 | `bundle_tracking` | Bundle Tracking | `ENABLE_BUNDLE_TRACKING` (3 ConfigMaps) + `SHOW_BUNDLE_TRACKING` | Mapped |
| 14 | `nurse_order_set` | Nurse Order Set Enabled | `ORDER_SET_ENABLED` (shared) | Shared toggle |
| 15 | `provider_order_set` | Provider Order Set Enabled | `ORDER_SET_ENABLED` (shared) | Shared toggle |
| 16 | `bundle_start_provider_trigger` | Bundle Start Time by Provider Trigger | — | **Unmapped** |
| 17 | `fluid_mod_bayesian_ui` | Fluid Modification (Bayesian UI) | `ENABLE_FLUIDS_QUESTIONS` | Mapped |
| 18 | `fluid_mod_ehr_order_set` | Fluid Modification (EHR Order Set) | `ENABLE_FLUIDS_CONTRAINDICATION_REASON_FID` | Mapped |
| 19 | `provider_fluid_questions` | Provider - Fluid Documentation Questions | `FLUIDS_CONTRAINDICATION_AVAILABLE_IN_DOCUMENTATION` | Mapped |
| 20 | `ibw_calculation` | Ideal Body Weight Calculation | `ENABLE_FLUIDS_CONTRAINDICATION_AUTO_SELECT_FID` (shared) | Shared toggle |
| 21 | `auto_obesity_contraindication` | Auto-Selection of Obesity Contraindication | `ENABLE_FLUIDS_CONTRAINDICATION_AUTO_SELECT_FID` (shared) | Shared toggle |
| 22 | `focused_exam_writeback` | Focused Exam Writeback to Flowsheet Row | `ENABLE_FOCUSED_EXAM_WRITEBACK` | Mapped |
| 23 | `focused_exam_read` | Focused Exam Read from Flowsheet | — | **Unmapped** |
| 24 | `prn_fluids` | PRN Fluids | — | **Unmapped** |
| 25 | `prn_vasopressors` | PRN Vasopressors | — | **Unmapped** |
| 26 | `redirect_on_active_bundles` | Redirect to Treatment Management on Active Bundles | `ENABLE_REDIRECT_TO_TREATMENT_MANAGEMENT_ON_ACTIVE_BUNDLES` | Mapped |

### Contributing Factors (3 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 27 | `qsofa` | qSOFA | — | **Unmapped** |
| 28 | `lactate_trending` | Lactate Trending | — | **Unmapped** |
| 29 | `historical_contributing_factors` | Historical Contributing Factors | `HISTORICAL_CONTRIBUTING_FACTORS` | Mapped |

### Clinical Workflow (1 flag)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 30 | `redirect_to_treatment_management` | Redirect to Treatment Management | `ENABLE_REDIRECT_TO_TREATMENT_MANAGEMENT` | Mapped |

### BP Management (1 flag)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 31 | `bp_management` | BP Management | — | **Unmapped** |

### Regulatory (2 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 32 | `investigational_banner` | Investigational Banner | `ALERT_BANNER` + `ALERT_BANNER_TEXT` | Composite |
| 33 | `ifu` | Instructions for Use (IFU) | `REGULATED_PRODUCT_INFO` + `REGULATED_PRODUCT_IFU_BUCKET` | Composite |

### Suppression (3 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 34 | `antibiotic_driven_suppression` | Antibiotic-Driven Suppression | — | **Unmapped** |
| 35 | `reset_suppression_on_admission` | Re-set Suppression on Admission (ED>IP) | — | **Unmapped** |
| 36 | `code_status_suppression` | Code Status Suppression | `ENABLE_CODE_STATUS_SUPPRESSION` | Mapped |

### Other (2 flags)

| # | Flag Key | Display Name | Env Var(s) | Mapping Status |
|---|----------|-------------|------------|----------------|
| 37 | `neutropenic_fever_enabled` | Neutropenic Fever Model | `NEUTROPENIC_FEVER_ENABLED` | Mapped |
| 38 | `neutropenic_fever_notifications` | Neutropenic Fever Notifications | `ENABLE_NEUTROPENIC_FEVER_NOTIFICATIONS` | Mapped |

---

## 3. Mapping Summary

| Status | Count | Flags |
|--------|-------|-------|
| **Mapped** (1:1 boolean) | 18 | nurse_writeback_flowsheet, nurse_writeback_note, nurse_escalation_questions, provider_flowsheet_writeback, auto_writeback_note_type, provider_unsure_followup, sepsis_deescalation, add_to_existing_note, provider_doc_tab, bundle_tracking, fluid_mod_bayesian_ui, fluid_mod_ehr_order_set, provider_fluid_questions, focused_exam_writeback, redirect_on_active_bundles, historical_contributing_factors, redirect_to_treatment_management, code_status_suppression |
| **Mapped** (composite) | 3 | create_new_note, investigational_banner, ifu |
| **Mapped** (shared toggle) | 4 | nurse_order_set, provider_order_set, ibw_calculation, auto_obesity_contraindication |
| **Mapped** (new, from YAML) | 2 | neutropenic_fever_enabled, neutropenic_fever_notifications |
| **Unmapped** | 11 | nursing_q1_not_diagnostic, nursing_documentation, bundle_start_provider_trigger, focused_exam_read, prn_fluids, prn_vasopressors, qsofa, lactate_trending, bp_management, antibiotic_driven_suppression, reset_suppression_on_admission |

---

## 4. Outstanding Gaps

### Gap 1: 11 Flags with No Known Env Var

These flags exist in the JSON (sourced from PDFs or product knowledge) but have never appeared in any config-patch YAML across 6 customers.

| Flag | Current Category | Question for Engineering |
|------|-----------------|------------------------|
| `nursing_q1_not_diagnostic` | Assessment | How is this tooltip controlled? Form schema? Frontend code? |
| `nursing_documentation` | Documentation | MedStar-only. Is this a Cerner-specific feature? Where is it toggled? |
| `bundle_start_provider_trigger` | Bundle Manager | Is this bundle-manager config, form schema, or DB-level? |
| `focused_exam_read` | Bundle Manager | Form schema in S3? Database config? |
| `prn_fluids` | Bundle Manager | ThedaCare-only. How is this controlled? |
| `prn_vasopressors` | Bundle Manager | ThedaCare-only. Same question. |
| `qsofa` | Contributing Factors | MedStar-only. Form schema? |
| `lactate_trending` | Contributing Factors | Inova-only. How is this toggled? |
| `bp_management` | BP Management | Inova-only. Is this a separate service/feature? |
| `antibiotic_driven_suppression` | Suppression | ThedaCare-only. Alert-state-manager? |
| `reset_suppression_on_admission` | Suppression | ThedaCare-only. Same question. |

**Decision needed:** For each — what controls it? Should we create env vars, or document "controlled via [X]" in the mapping file?

### Gap 2: Env Vars in YAML with No Corresponding JSON Flag

These appear in production/staging YAMLs and affect user-facing behavior, but we have not added them to the JSON schema.

| Env Var | ConfigMap(s) | Found In | What It Does | Should It Be a Flag? |
|---------|-------------|----------|-------------|---------------------|
| `ENABLE_UPDATED_SOURCES_OF_INFECTION_LIST` | trews-api-v3 | MemCare, URMC, CCF | Updated dropdown for source of infection | ? |
| `ENABLE_SOURCES_OF_INFECTION_MULTISELECT_WITH_OPEN_MENU` | ui-config | MemCare, URMC, CCF | Multi-select source of infection dropdown | ? |
| `DOCUMENTATION_FORMATTED_PLACEHOLDERS_ENABLED` | ui-config, trews-api-v3 | MemCare, CCF | Formatted placeholders in doc notes | ? |
| `NURSE_ORDER_SET_REQUIRES_ALTERED_MENTAL_STATUS` | trews-api-v3 | URMC | Nurse order set gated on AMS | ? |
| `USE_ORDER_PANEL_ID_TO_PLACE_ORDERS` | trews-api-v3 | CCF | Panel IDs vs order set IDs | ? |
| `FETCH_PRACTITIONER_ROLE` | trews-api-v3 | MemCare | Fetch practitioner role from FHIR | ? |
| `ENABLE_DOMAIN_FLAGS` | trews-api-v3, alert-state-mgr | MemCare, URMC, Inova, CCF | Meta-flag gating domain-specific behavior | ? |

**Decision needed:** Which of these are user-facing (Tier 1 — should be in the viewer) vs. implementation detail (Tier 2 — stays in YAML only)?

### Gap 3: `SHOW_SEPSIS_PROVIDER_DOCUMENTATION` vs. `provider_doc_tab`

| Customer | JSON `provider_doc_tab` | YAML `SHOW_SEPSIS_PROVIDER_DOCUMENTATION` |
|----------|------------------------|------------------------------------------|
| Memorial Care | `true` | `false` |
| URMC | `true` | `false` |
| CCF | `true` | `false` |

The JSON says the provider doc tab is enabled, but the YAML UI var says "show = false" everywhere. This suggests one of:
- The env var is deprecated and the feature is now always visible
- The feature is accessed via redirect (`ENABLE_REDIRECT_TO_TREATMENT_MANAGEMENT`) rather than a direct tab
- The JSON value is wrong

**Decision needed:** Is `SHOW_SEPSIS_PROVIDER_DOCUMENTATION` still the controlling var? Or has this been superseded?

### Gap 4: `ENABLE_FLUIDS_QUESTIONS` Conflict (CCF)

| Customer | JSON `fluid_mod_bayesian_ui` | YAML `ENABLE_FLUIDS_QUESTIONS` |
|----------|----------------------------|-------------------------------|
| CCF | `true` | `false` |
| Memorial Care | `false` | `false` |

The JSON has CCF's fluid questions enabled, but the YAML (CCF staging) has it as `false`. Possible explanations:
- Staging differs from production
- JSON was set from a PDF that describes the intended state, not the deployed state

**Decision needed:** What is CCF's actual production state for fluid questions?

### Gap 5: CCF Hospital-Level Toggle Pattern

CCF uses a different pattern for many flags — hospital-level granularity instead of simple booleans:

```
ENABLE_BUNDLE_TRACKING: "FAIRH|true,CCF|true,AVONH|true,LUTHH|true,..."
```

This affects 8+ env vars: `ENABLE_BUNDLE_TRACKING`, `SHOW_BUNDLE_TRACKING`, `ENABLE_NURSE_ASSESSMENT_WRITEBACK`, `ENABLE_PROVIDER_ASSESSMENT_WRITEBACK`, `ASSESSMENT_WRITEBACK_ENABLED`, `DOCUMENTATION_FHIR_WRITEBACK_ENABLED`, `DOCUMENTATION_AUTO_GENERATED_NOTE_ENABLED`, `ENABLE_REDIRECT_TO_TREATMENT_MANAGEMENT`.

Currently, the JSON treats CCF as a single boolean (`true`), which is a lossy abstraction.

**Decision needed:**
- Is this pattern CCF-specific or the direction for other multi-hospital customers?
- Should the viewer capture sub-customer (hospital-level) granularity? Or is a single "enabled for CCF" sufficient for the target audience?
- If any CCF hospital has a flag set to `false` while others are `true`, how should the viewer represent that?

### Gap 6: Shared Toggles

Two env vars each control two JSON flags that cannot be independently toggled:

| Env Var | Controls | Can They Diverge? |
|---------|----------|-------------------|
| `ORDER_SET_ENABLED` | `nurse_order_set` + `provider_order_set` | If one is off and the other on, how? |
| `ENABLE_FLUIDS_CONTRAINDICATION_AUTO_SELECT_FID` | `ibw_calculation` + `auto_obesity_contraindication` | Always coupled? |

Currently the JSON allows them to have different values (e.g., MedStar has `nurse_order_set: false`, `provider_order_set: false`). But if a customer wanted one on and one off, the shared env var can't support that.

**Decision needed:** Are these truly inseparable, or is there another mechanism to differentiate?

### Gap 7: Staging vs. Production Configs

The YAMLs are a mix of environments:

| Customer | YAML Environment |
|----------|-----------------|
| Memorial Care | **Production** |
| ThedaCare | Staging |
| URMC | Staging |
| Inova | Staging |
| CCF | Staging |
| LifeBridge | Staging |

Staging configs may not reflect production state. Some flags may be enabled in staging for testing but disabled in production (or vice versa).

**Decision needed:** Should we source production YAMLs for all customers? Or is staging close enough for the viewer's purpose?

### Gap 8: `ASSESSMENT_WRITEBACK_ENABLED` vs. `ENABLE_NURSE_ASSESSMENT_WRITEBACK`

Memorial Care has:
- `ENABLE_NURSE_ASSESSMENT_WRITEBACK` = `true` (trews-api-v3)
- `ASSESSMENT_WRITEBACK_ENABLED` = `false` (ui-config)

Both are mapped to `nurse_writeback_flowsheet` in the JSON (currently `true`). These appear to control different things — one is backend writeback, the other is a UI indicator.

**Decision needed:** Are these the same feature or do they need to be separate flags?

---

## 5. Proposed Category Naming — Review

| Current Category Key | Display Name | Flag Count | Feedback Wanted |
|---------------------|-------------|------------|-----------------|
| `assessment_writeback` | Assessment Writeback | 8 | Does `sepsis_deescalation` belong here or in its own category? |
| `documentation` | Documentation | 4 | Correct grouping? |
| `bundle_manager` | Bundle Manager | 14 | Too many flags? Should fluid management be split out? |
| `contributing_factors` | Contributing Factors | 3 | Correct grouping? |
| `clinical_workflow` | Clinical Workflow | 1 | Merge into another category? Only has one flag. |
| `bp_management` | BP Management | 1 | Merge into another category? Only has one flag. |
| `regulatory` | Regulatory | 2 | Correct grouping? |
| `suppression` | Suppression | 3 | Correct grouping? |
| `other` | Other | 2 | Better name? "Neutropenic Fever"? Or keep generic for future flags? |

**Specific questions:**
1. `clinical_workflow` and `bp_management` each have 1 flag. Should these be merged into another category, or kept separate for anticipated growth?
2. `bundle_manager` has 14 flags. Should we split out a sub-group (e.g., "Fluid Management" for the 5 fluid-related flags)?
3. Is "Other" the right name for the neutropenic fever flags, or should this be "Models" / "Additional Products"?

---

## 6. Customer Configuration Summary

Current state of all 38 flags across 9 customers (Sepsis product only):

| Category | Flag | MemCare | Inova | ThedaCare | MedStar | CCF | UChicago | URMC | Northwell | Mayo |
|----------|------|---------|-------|-----------|---------|-----|----------|------|-----------|------|
| **Assessment** | nurse_writeback_flowsheet | on | on | on | on | on | on | on | off | — |
| | nurse_writeback_note | off | off | off | off | off | off | off | on | — |
| | nurse_escalation_questions | on | on | on | on | on | on | on | off | — |
| | nursing_q1_not_diagnostic | off | off | off | on | off | off | off | off | — |
| | provider_flowsheet_writeback | off | on | on | on | on | on | on | off | — |
| | auto_writeback_note_type | on | on | on | on | on | on | on | off | — |
| | provider_unsure_followup | on | off | on | off | on | off | off | off | — |
| | sepsis_deescalation | on | off | on | off | on | off | on | off | — |
| **Documentation** | create_new_note | on | on | on | on | on | on | on | on | — |
| | add_to_existing_note | off | off | on | on | on | off | off | off | — |
| | provider_doc_tab | on | on | on | on | on | on | on | on | — |
| | nursing_documentation | off | off | off | on | off | off | off | off | — |
| **Bundle Mgr** | bundle_tracking | on | on | on | on | on | on | on | off | — |
| | nurse_order_set | on | off | off | off | on | off | off | off | — |
| | provider_order_set | on | on | on | off | on | on | on | off | — |
| | bundle_start_provider_trigger | off | on | on | off | off | off | off | off | — |
| | fluid_mod_bayesian_ui | off | on | on | on | on | on | off | on | — |
| | fluid_mod_ehr_order_set | on | on | on | on | on | off | off | off | — |
| | provider_fluid_questions | off | on | on | on | on | on | off | on | — |
| | ibw_calculation | off | on | on | off | off | off | off | off | — |
| | auto_obesity_contraindication | off | on | on | off | off | off | off | off | — |
| | focused_exam_writeback | off | on | on | on | on | off | off | off | — |
| | focused_exam_read | off | on | on | off | off | off | off | off | — |
| | prn_fluids | off | off | on | off | off | off | off | off | — |
| | prn_vasopressors | off | off | on | off | off | off | off | off | — |
| | redirect_on_active_bundles | on | off | on | off | on | off | on | off | — |
| **Contrib. Factors** | qsofa | off | off | off | on | off | off | off | off | — |
| | lactate_trending | off | on | off | off | off | off | off | off | — |
| | historical_contributing_factors | on | off | on | off | off | off | off | off | — |
| **Clinical WF** | redirect_to_treatment_mgmt | off | off | on | off | off | off | off | off | — |
| **BP Mgmt** | bp_management | off | on | off | off | off | off | off | off | — |
| **Regulatory** | investigational_banner | off | off | off | on | off | off | off | off | — |
| | ifu | off | off | off | on | off | off | off | off | — |
| **Suppression** | antibiotic_driven_suppression | off | off | on | off | off | off | off | off | — |
| | reset_suppression_on_admission | off | off | on | off | off | off | off | off | — |
| | code_status_suppression | on | on | on | off | on | off | off | off | — |
| **Other** | neutropenic_fever_enabled | off | off | off | off | on | off | off | off | — |
| | neutropenic_fever_notifications | off | off | off | off | on | off | off | off | — |

*Mayo Clinic is Palliative Care only — no Sepsis flags apply.*

---

## 7. Proposed Agenda for Review Call

1. **Validate the 9 categories** (Section 5) — confirm naming and grouping
2. **Resolve the 12 unmapped flags** (Gap 1) — for each, identify how it's controlled
3. **Triage the 7 untracked env vars** (Gap 2) — classify as Tier 1 (add to viewer) or Tier 2 (YAML-only)
4. **Clarify `SHOW_SEPSIS_PROVIDER_DOCUMENTATION`** (Gap 3) — is this var deprecated?
5. **Confirm CCF fluid questions state** (Gap 4) — staging vs. production
6. **CCF hospital-level granularity** (Gap 5) — does the viewer need sub-customer support?
7. **Shared toggles** (Gap 6) — can nurse/provider order sets be independently controlled?
8. **Staging vs. production** (Gap 7) — should we source production YAMLs?
9. **`ASSESSMENT_WRITEBACK_ENABLED` semantics** (Gap 8) — one flag or two?

**Expected outcome:** A validated, canonical flag list with confirmed env var mappings and agreed category structure.

---

## 8. Business Value

### Time Saved

**CS: ~120 hrs/yr recovered.** Every flag question today follows the same loop: CS pings engineering in Slack, waits 30 min–4 hrs, gets the answer, relays to customer. This happens 2–3x/week. With self-service, the answer takes 15 seconds.

**Engineering: ~80 hrs/yr of interrupts eliminated.** Flag questions are low-complexity but high-interrupt — open the repo, find the YAML, find the ConfigMap, read the value, respond. Each one costs 5–10 min plus context-switch overhead. 3–4/week across all requesting teams.

**Production Support: ~15 min saved per incident.** Flag misconfiguration is a common first hypothesis during triage. Today that means repo access and YAML literacy. With the viewer, flag state is confirmed in 30 seconds instead of 15 minutes. Across ~50 incidents/year, that's ~12 hrs — and 15 min closer to resolution every time.

**Product Ops: ~10 hrs saved per new customer onboarding.** Building a new customer's integration checklist currently starts with copying another customer's and manually diffing. The matrix view gives an instant cross-customer comparison — which config to start from, what's different — replacing institutional memory with a live reference.

### Risk Prevention

**Miscommunication.** Without a single view, flag state answers depend on who you ask. CS might reference an old PDF. Engineering might reference staging. Product might reference what was scoped, not what shipped. One viewer, one answer.

**Go-live gaps.** No systematic way to verify that what's deployed matches what was agreed. A red pill where there should be green is visible instantly. Catching a missing writeback config before go-live vs. after the first clinical shift is the difference between a config change and an incident.

**Key-person risk.** The complete picture of "what's enabled where and why" lives in 2–3 heads. The JSON with notes and the mapping file make that knowledge durable, version-controlled, and searchable.

**Audit trail.** Investigational banner and IFU flags have compliance implications. Git history provides an immutable record of which customers had which flags at any point — something a spreadsheet or Confluence page cannot.

### Strategic Value

**Zero marginal cost to scale.** Works the same for 9 customers or 30. Manual processes (Slack questions, YAML lookups) scale linearly with customer count. This doesn't.

**Foundation for automation.** The JSON schema, env var mapping, and generation pipeline are the building blocks for automated YAML-to-viewer sync (V1). V0 isn't throwaway — it's the data model V1 builds on.

**Alignment without meetings.** Replaces the "let's go through each customer's config" meeting. All teams see the same view independently. Conversations shift from "what is the state?" to "what should we change?"

---

## 9. Post-Call Actions

Depending on decisions made, the following updates will be needed:

| Decision | Action |
|----------|--------|
| New flags to add | Update `feature-flags.json` and `env-var-mapping.yaml` |
| Flags to remove or merge | Update both files, regenerate |
| Category renames | Update `flagDefinitions` keys in JSON |
| New env var mappings | Update `env-var-mapping.yaml` |
| Hospital-level support | Requires schema change in JSON + generator update |
| Production YAML sourcing | Obtain and re-analyze production configs |
