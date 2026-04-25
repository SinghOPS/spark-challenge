#!/usr/bin/env bash

set -euo pipefail

# Deploy Guardian backend (CDK), then create/update an Amplify app that pulls
# frontend code from GitHub and triggers a production deployment.
#
# Required env vars:
#   GITHUB_REPO_URL        e.g. https://github.com/<org>/<repo>
#   GITHUB_ACCESS_TOKEN    GitHub PAT with repo read + webhook permissions
#
# Optional env vars:
#   STACK_NAME             default: GuardianStack
#   AWS_REGION             default: current AWS CLI region or us-east-1
#   AMPLIFY_APP_NAME       default: guardian-frontend
#   AMPLIFY_BRANCH_NAME    default: main

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CDK_DIR="${ROOT_DIR}/cdk"

if [[ ! -d "${CDK_DIR}" ]]; then
  echo "cdk directory not found at ${CDK_DIR}" >&2
  exit 1
fi

: "${GITHUB_REPO_URL:?GITHUB_REPO_URL is required}"
: "${GITHUB_ACCESS_TOKEN:?GITHUB_ACCESS_TOKEN is required}"

STACK_NAME="${STACK_NAME:-GuardianStack}"
AWS_REGION="${AWS_REGION:-$(aws configure get region || true)}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AMPLIFY_APP_NAME="${AMPLIFY_APP_NAME:-guardian-frontend}"
AMPLIFY_BRANCH_NAME="${AMPLIFY_BRANCH_NAME:-main}"

echo "==> Region: ${AWS_REGION}"
echo "==> Stack: ${STACK_NAME}"
echo "==> Amplify app: ${AMPLIFY_APP_NAME}"
echo "==> Amplify branch: ${AMPLIFY_BRANCH_NAME}"

echo "==> Deploying backend with CDK..."
(
  cd "${CDK_DIR}"
  npm install
  npx cdk deploy "${STACK_NAME}" --require-approval never
)

echo "==> Reading backend API URL from CloudFormation outputs..."
API_URL="$(aws cloudformation describe-stacks \
  --region "${AWS_REGION}" \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue | [0]" \
  --output text)"

if [[ -z "${API_URL}" || "${API_URL}" == "None" ]]; then
  echo "Could not resolve ApiUrl from stack outputs." >&2
  exit 1
fi

echo "==> Backend API URL: ${API_URL}"

BUILD_SPEC_FILE="$(mktemp)"
cat > "${BUILD_SPEC_FILE}" <<'YAML'
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: out
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
YAML

echo "==> Creating or updating Amplify app..."
APP_ID="$(aws amplify list-apps \
  --region "${AWS_REGION}" \
  --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId | [0]" \
  --output text)"

if [[ -z "${APP_ID}" || "${APP_ID}" == "None" ]]; then
  APP_ID="$(aws amplify create-app \
    --region "${AWS_REGION}" \
    --name "${AMPLIFY_APP_NAME}" \
    --repository "${GITHUB_REPO_URL}" \
    --access-token "${GITHUB_ACCESS_TOKEN}" \
    --platform WEB \
    --build-spec "file://${BUILD_SPEC_FILE}" \
    --environment-variables NEXT_PUBLIC_API_URL="${API_URL}" \
    --enable-branch-auto-build \
    --query "app.appId" \
    --output text)"
  echo "Created Amplify app: ${APP_ID}"
else
  aws amplify update-app \
    --region "${AWS_REGION}" \
    --app-id "${APP_ID}" \
    --repository "${GITHUB_REPO_URL}" \
    --access-token "${GITHUB_ACCESS_TOKEN}" \
    --platform WEB \
    --build-spec "file://${BUILD_SPEC_FILE}" \
    --environment-variables NEXT_PUBLIC_API_URL="${API_URL}" \
    >/dev/null
  echo "Updated Amplify app: ${APP_ID}"
fi

echo "==> Creating or updating Amplify branch..."
EXISTING_BRANCH="$(aws amplify list-branches \
  --region "${AWS_REGION}" \
  --app-id "${APP_ID}" \
  --query "branches[?branchName=='${AMPLIFY_BRANCH_NAME}'].branchName | [0]" \
  --output text)"

if [[ -z "${EXISTING_BRANCH}" || "${EXISTING_BRANCH}" == "None" ]]; then
  aws amplify create-branch \
    --region "${AWS_REGION}" \
    --app-id "${APP_ID}" \
    --branch-name "${AMPLIFY_BRANCH_NAME}" \
    --stage PRODUCTION \
    --enable-auto-build \
    --framework "Next.js - SSG" \
    --environment-variables NEXT_PUBLIC_API_URL="${API_URL}" \
    >/dev/null
  echo "Created branch: ${AMPLIFY_BRANCH_NAME}"
else
  aws amplify update-branch \
    --region "${AWS_REGION}" \
    --app-id "${APP_ID}" \
    --branch-name "${AMPLIFY_BRANCH_NAME}" \
    --enable-auto-build \
    --framework "Next.js - SSG" \
    --environment-variables NEXT_PUBLIC_API_URL="${API_URL}" \
    >/dev/null
  echo "Updated branch: ${AMPLIFY_BRANCH_NAME}"
fi

echo "==> Starting Amplify release job..."
JOB_SUMMARY="$(aws amplify start-job \
  --region "${AWS_REGION}" \
  --app-id "${APP_ID}" \
  --branch-name "${AMPLIFY_BRANCH_NAME}" \
  --job-type RELEASE \
  --query "{jobId:jobSummary.jobId,status:jobSummary.status}" \
  --output json)"

AMPLIFY_CONSOLE_URL="https://${AWS_REGION}.console.aws.amazon.com/amplify/home?region=${AWS_REGION}#/${APP_ID}"

echo "Deployment started."
echo "App ID: ${APP_ID}"
echo "Job: ${JOB_SUMMARY}"
echo "Amplify console: ${AMPLIFY_CONSOLE_URL}"

rm -f "${BUILD_SPEC_FILE}"
