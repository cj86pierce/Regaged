# Regaged – Steam client

Desktop launcher for Regaged. It runs under Steam, gets a Steam auth ticket, exchanges it for a Regaged JWT, then opens the game in a window (your deployed backend URL with the token).

## Prerequisites

- Node.js 18+
- Backend deployed and `REGAGED_API_BASE` pointing to it (e.g. `https://your-app.vercel.app`)
- Steamworks partner account and App ID when publishing to Steam

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your backend URL (or use default for dev):
   ```bash
   set REGAGED_API_BASE=https://your-regaged-domain.vercel.app
   ```

3. Run under Steam (required for auth):
   - Install the game in Steam (or use “Add non-Steam game” and point to the Electron exe for testing).
   - Launch from Steam so `steamworks.js` can get a session ticket.

   For local dev without Steam, run Electron directly (auth will fail; you can still open the site):
   ```bash
   npm start
   ```

## Build

- **Windows (no Steam upload):**
  ```bash
  npm run build:win
  ```
  Output in `dist/`.

- **Steam build (after configuring Steamworks):**
  - In `package.json` → `build.steam`, set your Steam App ID and enable publish.
  - Run:
  ```bash
  npm run build:steam
  ```
  Then use Steamworks partner upload to publish the build.

## Env (backend)

Your Regaged backend needs:

- `STEAM_WEB_API_KEY` – from [Steamworks API Key](https://steamcommunity.com/dev/apikey)
- `STEAM_APP_ID` – your Steam App ID (e.g. 480 for Spacewar in dev)
- `JWT_SECRET` – used to sign the token returned by `/api/auth/steam`

## Fully retiring the website

- Keep the backend (API + DB + crons) deployed; only the “public site” goes away.
- Point `REGAGED_API_BASE` at that backend.
- Users only get the game via the Steam client; the same frontend is loaded from your backend URL when the client opens the callback with the token.
