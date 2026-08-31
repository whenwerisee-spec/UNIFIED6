<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your Coinbase app

This contains everything you need to run your app locally.

View your Coinbase app locally in the browser after starting the dev server.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Configure security secrets in `.env.local`:
   - `JWT_SECRET`
   - `SOVEREIGN_ENCRYPTION_KEY`
   - Initial admin bootstrap vars: `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_TOTP_SECRET`
   - After first successful bootstrap, a `src/db/bootstrap.lock` file is created. Keep it committed only in local/dev contexts and do not remove it except through approved recovery procedures.
4. Run the app:
   `npm run dev`

## Security Verification

- Run full security checks (verification + auth + bootstrap + auth API integration):
   `npm test`
- Validate the production environment contract:
   `npm run verify:prod-env`
- Run production build:
   `npm run build`
- Run the health check:
   `powershell -ExecutionPolicy Bypass -File .\scripts\health-check.ps1`

## Production Deployment

- Copy [.env.production.example](.env.production.example) to `.env.production` and fill in production secrets.
- Build a container image with `docker build -t coinbase-app .`
- Start the container with `docker run -p 3000:3000 --env-file .env.production coinbase-app`
