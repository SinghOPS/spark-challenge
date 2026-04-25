# Guardian - The Algorithmic Auditor

An AWS-native AI governance layer that audits AI outputs for proxy bias, calculates legal liability debt, and guides ethical decision-making through Socratic scaffolding.

## Architecture

| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Next.js on Amplify | CSV upload, audit dashboard, Socratic chat |
| API | API Gateway (REST) | Routes requests to Lambda functions |
| Ingest | AWS Lambda (Python) | Parses CSV, uploads to S3, runs bias analysis |
| Bias Engine | AWS Lambda (Python) | Statistical parity checks (Disparate Impact / 4/5ths) |
| Logic Gate | AWS Lambda (Python) | 4/5ths rule, Legal Liability Debt calculation, proxy detection |
| Socratic Tutor | AWS Lambda + Bedrock | Claude 3.5 Sonnet for guided fairness exploration |
| Storage | DynamoDB + S3 | Audit logs, chat history, CSV data |

## Project Structure

```
spark-challenge/
├── cdk/                  # AWS CDK infrastructure (TypeScript)
│   ├── bin/              # CDK app entry point
│   └── lib/              # Stack definitions
├── lambdas/              # Python Lambda functions
│   ├── shared/           # Shared models & DynamoDB helpers (Lambda layer)
│   ├── ingest/           # CSV ingestion + in-Lambda bias analysis
│   ├── logic_gate/       # Ethics Logic Gate (4/5ths rule)
│   └── socratic_chat/    # Bedrock-powered Socratic tutor
├── frontend/             # Next.js application
│   └── src/
│       ├── app/          # Pages (upload, audit detail, dashboard)
│       ├── components/   # UI components
│       └── lib/          # API client
└── docs/                 # Documentation
```

## Prerequisites

- Node.js 18+
- Python 3.12
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

### 1. CDK Infrastructure

```bash
cd cdk
npm install
npx cdk bootstrap   # First time only
npx cdk deploy
```

After deployment, note the API Gateway URL from the stack outputs.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your API Gateway URL
npm run dev
```

## Guardrails

### Ethics (Inclusion) — The 4/5ths Rule
If the selection rate of a protected group falls below 80% of the highest group's rate, the API call is blocked and the user is directed to the Fairness Workshop.

### Economics (Transparency) — Legal Liability Debt
Estimates potential class-action/EEOC/GDPR fine exposure:
```
liability = (1.0 - impact_ratio) * $1,000,000
```

### Education (Agency) — Socratic Scaffolding
When bias is detected, Bedrock (Claude 3.5 Sonnet) guides users through understanding the bias via Socratic questioning rather than prescriptive fixes.

### Environment (Accountability) — Green-Audit Compute
All compute runs on serverless Lambda, spinning up only during audits to minimize carbon footprint.
