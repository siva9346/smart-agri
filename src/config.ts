// ── After deploying the backend, replace this with your actual API Gateway URL ──
// Run: aws cloudformation describe-stacks --stack-name naveena-uzhavan \
//        --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
export const API_BASE_URL = 'https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/v1';
