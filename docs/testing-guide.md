# Guardian Testing Guide (Using Included Example Datasets)

This guide provides a practical, repeatable test plan for Guardian using files already present in `test-data/`.

## 1) Pre-Test Checklist

- Backend deployed (CDK stack active)
- Frontend reachable (local or Amplify)
- You are on **New Audit** page
- CSV upload file size is below frontend/API limit

## 2) Core Field Mapping Rules

For every run:

- **Protected Attribute** = group column to compare fairness across
- **Outcome Column** = binary decision column (`0/1`)

Examples:

- Protected attribute: `race`, `sex`, `age_group`, `gender`
- Outcome column: `approved`, `promoted`

## 3) Scenario Matrix (Recommended)

| Scenario | Dataset | Protected Attribute | Outcome Column | Expected Status | Expected Impact Ratio (approx) |
|---|---|---|---|---|---|
| A - Race bias baseline | `loan_applications_biased.csv` | `race` | `approved` | `BLOCKED` | `0.2222` |
| B - Severe age bias | `loan_applications_age_bias.csv` | `age_group` | `approved` | `BLOCKED` | `0.0769` |
| C - Fair hiring baseline | `hiring_fair.csv` | `gender` | `promoted` | `PASSED` | `0.8750` |
| D - Adult dataset (sex) | `adult_full_ready.csv` | `sex` | `approved` | `BLOCKED` | `~0.4230` |
| E - Adult dataset (race) | `adult_full_ready.csv` | `race` | `approved` | `BLOCKED` | `~0.1676` |

Notes:

- Impact ratios are approximate; small differences are expected if file content changes.
- Current threshold is `0.80`:
  - `< 0.80` => `BLOCKED`
  - `>= 0.80` => `PASSED`

## 4) Detailed Step-by-Step Procedure

Repeat this for each scenario in the matrix.

1. Go to **New Audit**
2. Upload the scenario CSV from `test-data/`
3. Select the exact columns from the matrix
4. Click **Run Bias Audit**
5. Wait for audit page to load
6. Verify:
   - Status (`PASSED` or `BLOCKED`)
   - Impact Ratio (close to expected)
   - Legal Liability Debt (non-zero if blocked)
   - Proxy warnings shown when applicable
7. If blocked, click **Start Fairness Trade-off Workshop** and verify chat response appears

## 5) What to Validate Per Feature

### A) Audit Pipeline

- Upload works
- Audit transitions from processing to final status
- Dashboard lists new audit with filename and status

### B) Fairness Math

- Impact ratio aligns with expected scenario behavior
- `BLOCKED` for biased scenarios
- `PASSED` for fair scenario (`hiring_fair.csv`)

### C) Liability

- Formula in app: `liability = (1 - impact_ratio) * 1,000,000`
- Verify higher disparity yields higher liability

### D) Chat UX

- No duplicate initial prompt
- Assistant response streams in UI
- Markdown output renders cleanly (headers, bullets, etc.)

## 6) Quick Smoke Test (2 minutes)

Use this minimum set when you just need confidence after a change:

1. `hiring_fair.csv` + `gender/promoted` -> should pass
2. `loan_applications_biased.csv` + `race/approved` -> should block
3. Open chat on blocked run and send one question

## 7) Troubleshooting

### `413 Content Too Large`

- Cause: request payload too large (CSV base64 in JSON)
- Action: use smaller dataset/file or sample rows

### CORS error shown in browser

- Often secondary to upstream non-2xx responses (`413`, `5xx`)
- Check network status code first

### Unexpected status/ratio

- Confirm selected columns are correct
- Ensure outcome column is truly binary (`0/1`)
- Ensure protected/outcome columns are different

## 8) Dataset Inventory (Current Repo)

- `loan_applications_biased.csv`
- `loan_applications_age_bias.csv`
- `hiring_fair.csv`
- `adult_full_ready.csv` (trimmed sample of Adult dataset)
