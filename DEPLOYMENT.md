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
