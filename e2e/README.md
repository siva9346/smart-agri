# Browser end-to-end tests

Runs the real app (Expo web) against the real Lambda handlers on an in-memory AWS mock.

```bash
# 1. backend (seeds one user per role; password: password1)
pip install -r backend/tests/requirements.txt
PORT=3055 python backend/scripts/local_api.py

# 2. app
EXPO_PUBLIC_API_URL=http://localhost:3055/v1 npx expo start --web --port 8095

# 3. tests (restart local_api.py first for a clean state)
cd e2e && npm install && npm test        # CHROME_PATH=/path/to/chrome if needed
```

`smoke.js` opens every screen for every role and fails on crashes, failed API calls or error states.
`flows.js` drives consultation → expert recommendation → quotation → approval → share → acceptance,
and the announcement banner / X-dismiss behaviour.
`visibility.js` checks the customer has no product catalogue (menus, routes, API) while staff still do. Screenshots of failures land in `e2e/shots/`.
