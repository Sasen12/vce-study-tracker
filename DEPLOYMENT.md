# Deployment

This app has two deployable parts:

- Expo web frontend on Netlify.
- Node/Express API plus Postgres on Render.

The OpenAI key must live only on the backend host. The browser receives only `EXPO_PUBLIC_API_URL`, so students can use AI features without seeing the key.

## 1. Backend on Render

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Render will read `render.yaml` and create:
   - `vce-study-tracker-api`
   - `vce-study-tracker-db`
4. Add the secret environment variable on the web service:
   - `OPENAI_API_KEY`
5. Deploy the service.
6. Copy the public API URL, for example:

```text
https://vce-study-tracker-api.onrender.com/api
```

## 2. Frontend on Netlify

1. Create a Netlify site from the same GitHub repo.
2. Build command:

```text
npm run build:web
```

3. Publish directory:

```text
dist
```

4. Add the production environment variable:

```text
EXPO_PUBLIC_API_URL=https://your-render-api-url/api
```

5. Deploy.

## Notes

- `backend/.env` and root `.env` are ignored and should not be committed.
- If you change `EXPO_PUBLIC_API_URL`, rebuild the Netlify site because Expo public environment variables are bundled at build time.
- Public AI access spends the backend `OPENAI_API_KEY`. Add rate limits before a wide public launch if cost control becomes important.
- Pricing tiers add columns to the `users` table. After pulling billing changes on the API machine, run:

```text
npm install --prefix backend
npm run prisma:push --prefix backend
npm run prisma:generate --prefix backend
npm run build --prefix backend
```

- Stripe Checkout is optional until configured. To turn payments on, add these backend env vars:

```text
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_MAX=price_...
FRONTEND_URL=https://your-netlify-site.netlify.app
```

- Register the Stripe webhook URL as `https://your-api-domain/api/billing/webhook` and listen for Checkout/session and subscription events.
