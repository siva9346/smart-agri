#!/usr/bin/env bash
# Pulls the deployed API Gateway URL from the CloudFormation stack output and
# writes it into src/config.ts, so the app never ships with the placeholder URL.
#
# Usage: scripts/sync-api-url.sh [stack-name] [region]
set -euo pipefail

STACK_NAME="${1:-naveena-uzhavan}"
REGION="${2:-ap-south-1}"

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

if [ -z "$API_URL" ] || [ "$API_URL" = "None" ]; then
  echo "Could not find ApiUrl output for stack '$STACK_NAME' in '$REGION'" >&2
  exit 1
fi

CONFIG_FILE="$(cd "$(dirname "$0")/.." && pwd)/src/config.ts"
sed -i.bak "s#^export const API_BASE_URL = .*#export const API_BASE_URL = '${API_URL}';#" "$CONFIG_FILE"
rm -f "${CONFIG_FILE}.bak"

echo "Updated src/config.ts -> $API_URL"
