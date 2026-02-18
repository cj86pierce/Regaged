# Moving Regaged fully to Steam

This doc describes what was done and how to finish retiring the public site so the game is **only** playable via the Steam client.

## What’s in place

### Backend (API)

- **Steam auth**
  - `User.steamId` in DB (migration `20260218000000_add_steam_id`).
  - `POST /api/auth/steam`: accepts `{ ticket }` (hex), verifies with Steam Web API, creates/finds user, returns `{ token, userId, username }` (JWT).
  - Env: `STEAM_WEB_API_KEY`, `STEAM_APP_ID`, `JWT_SECRET`.

- **Dual auth**
  - All API routes use `getCurrentUserId(req)`, which accepts:
    1. `Authorization: Bearer <jwt>` (Steam client)
    2. Cookie `regaged_token` (browser after Steam callback)
    3. NextAuth session (legacy site login)
  - Server components use `getCurrentUserIdFromHeaders()` so Steam cookie auth works on SSR.

- **Steam callback (browser)**
  - `GET /auth/steam-callback?token=JWT`: sets `regaged_token` cookie and redirects to `/`. Used when the Steam client opens the game in a window.

- **Steam-only users**
  - Users created via Steam get `emailVerifiedAt` set so they bypass email verification for enrollment.

### Steam client

- **Location:** `steam-client/`
- **Flow:** Under Steam, gets auth ticket → `POST /api/auth/steam` → receives JWT → opens `API_BASE/auth/steam-callback?token=JWT` so the game loads in the window with cookie auth.
- **Config:** `REGAGED_API_BASE` (and optionally `STEAM_APP_ID`) in env or in code.

## What to do to “get rid of the site”

1. **Keep the backend**
   - Deploy API + DB + crons as you do now (e.g. Vercel + Postgres). This is the only server; there is no separate “website” server.

2. **Point Steam client at that backend**
   - Set `REGAGED_API_BASE` to your deployed backend URL (e.g. `https://your-app.vercel.app`). The Steam app loads that URL in a window after setting the token via the callback.

3. **Optional: stop offering web sign-up**
   - Remove or hide links to `/register` and `/login` so new users only come via Steam. You can leave the routes in place for support or remove them later.

4. **Optional: retire “marketing” or public home**
   - You can replace the public home page with a simple “Play Regaged on Steam” message and a link to the Steam store. The rest of the app (enroll, games, profile, shop) stays; users reach it only via the Steam client after the callback.

5. **Run DB migration**
   - Ensure the `steamId` column exists:
     ```bash
     npx prisma migrate deploy
     ```
   - Or apply `prisma/migrations/20260218000000_add_steam_id/migration.sql` manually.

6. **Publish on Steam**
   - Use your Steamworks App ID in the Steam client and in backend `STEAM_APP_ID`.
   - Build the client (e.g. `npm run build:win` in `steam-client/`) and publish via Steamworks.

## Summary

- **Site** = same Next.js app; it becomes the UI that only the Steam client opens (after token is set). You can stop advertising the URL and treat it as “Steam only.”
- **Backend** = unchanged hosting; only auth now supports Steam (JWT + cookie) in addition to NextAuth.
- **Steam client** = the only official way to play; it launches the game in a window using your backend URL and Steam auth.

No separate “website” is required; the “site” is just that one deployed app, used only via the Steam client (and optionally by you for admin/support).
