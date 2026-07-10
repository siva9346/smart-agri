// ── After deploying the backend, replace this with your actual API Gateway URL ──
// Run: scripts/sync-api-url.sh   (or manually via the aws cloudformation command below)
// aws cloudformation describe-stacks --stack-name naveena-uzhavan \
//   --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
export const API_BASE_URL = 'https://oe2hznr4xi.execute-api.ap-south-1.amazonaws.com/v1';
