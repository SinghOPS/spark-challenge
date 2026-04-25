# Guardian User Guide

This guide explains how to run an audit, interpret results, and use the fairness workshop.

## 1) What You Need

- A CSV dataset with:
  - one **protected attribute** column (for example: `race`, `sex`, `age_group`)
  - one **binary outcome** column (for example: `approved`, `hired`, `selected`) with `0/1` values
- Access to Guardian frontend

## 2) Start a New Audit

1. Open **New Audit** page.
2. Upload CSV.
3. Select:
   - **Protected Attribute** = fairness comparison group
   - **Outcome Column** = decision outcome to evaluate
4. Click **Run Bias Audit**.

## 3) Recommended Test Files

From `test-data/`:

- `adult_test_ready.csv` - quick smoke test
- `adult_train_ready.csv` - primary quality test
- `adult_full_ready.csv` - larger end-to-end test (trimmed for payload limits)

For Adult dataset specifically:

- Protected attribute: `sex` (first run), then `race`
- Outcome: `approved`

## 4) Understanding Results

### Status

- **PASSED**: impact ratio >= 0.80
- **BLOCKED**: impact ratio < 0.80

### Impact Ratio

- Formula: `min(selection_rate) / max(selection_rate)`
- Lower value means stronger disparity

### Legal Liability Debt

- Formula: `(1 - impact_ratio) * 1,000,000`
- Serves as a transparency/risk indicator

### Proxy Bias Warnings

Flags features that may indirectly encode protected traits (for example names, zip code, socioeconomic fields).

## 5) Using the Socratic Workshop

When an audit is blocked:

1. Click **Start Fairness Trade-off Workshop**.
2. Ask focused questions:
   - "Which feature likely causes the disparity?"
   - "What should I test removing first?"
   - "How do I compare fairness vs accuracy after ablation?"
3. Use suggested checks to iterate on your model/data pipeline.

## 6) Practical Validation Workflow

Run these in order:

1. Smoke test with `adult_test_ready.csv`, protected=`sex`, outcome=`approved`
2. Repeat with protected=`race`
3. Compare audit outcomes and proxy warnings
4. Re-run after feature adjustments and verify impact ratio moves toward/above 0.80

## 7) Common Issues

### `413 Content Too Large`

Cause:
- CSV body exceeds API Gateway limit after base64 expansion.

What to do:
- Use smaller file
- Sample rows before upload
- (Future enhancement) move to presigned S3 upload workflow

### Browser shows CORS error with failed POST

Often this is secondary to upstream `413/5xx` errors. Check network status code first.

### Chat model error

If Bedrock model access is not enabled in account/region, chat may fail. Verify Bedrock model access and inference profile permissions.

## 8) Good Dataset Hygiene

- Keep outcome strictly binary (0/1)
- Remove duplicate header rows
- Avoid blank lines
- Ensure selected columns exist exactly as named
- Keep file sizes within frontend/API limits

## 9) FAQ

### Which column is "protected attribute"?

The group you want fairness compared across (for example `race`, `sex`, `age_group`).

### Which column is "outcome"?

The decision result column used for selection rate computation (for example `approved`).

### Can I use multiclass outcomes?

Current workflow expects binary outcomes for direct 4/5ths-style interpretation.
