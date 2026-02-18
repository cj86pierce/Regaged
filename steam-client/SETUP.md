# Step 4: Steam client – set API, run, and build

## 1. Set your backend URL

Your Steam app must know where your Regaged API lives.

**Option A – Environment variable (good for local runs)**

In PowerShell (Windows):

```powershell
cd c:\dev\regaged\tengaged-mvp\steam-client
$env:REGAGED_API_BASE = "https://your-actual-app.vercel.app"
```

Replace `https://your-actual-app.vercel.app` with your real backend URL (no trailing slash).

**Option B – Hardcode in the app (good for the built exe)**

Edit `main.js` and change the default:

```js
const API_BASE = process.env.REGAGED_API_BASE || "https://your-actual-app.vercel.app";
```

Then the built `.exe` will use that URL without needing an env var.

---

## 2. Install and run locally

```powershell
cd c:\dev\regaged\tengaged-mvp\steam-client
npm install
npm start
```

- **If you’re not running under Steam:** auth will fail; the window will open your backend URL and you’ll see the normal site (login/register). Good for checking that the URL and window work.
- **If you want to test Steam login:** you must launch the app **from Steam** (see step 3).

---

## 3. Run under Steam (for real Steam login)

Steam must be running and must launch your game so it can get an auth ticket.

**Quick test (no Steamworks partner yet):**

1. Build the app once (step 4 below) so you have an `.exe`, e.g.  
   `dist\Regaged 0.1.0.exe` or the one inside the installer.
2. In Steam: **Games → Add a non-Steam game to my library**.
3. Browse to that `.exe` and add it.
4. Launch “Regaged” from your Steam library.  
   The app will get a ticket (using Steam’s default test app) and try to log in. Your backend must have `STEAM_WEB_API_KEY` and `STEAM_APP_ID` set; for this test you can use App ID `480` (Spacewar) and a Web API key from [Steam API Key](https://steamcommunity.com/dev/apikey).

**When you have a real Steam App ID:** set `STEAM_APP_ID` in the client (env or in code) and use the same App ID in your backend and in Steamworks.

---

## 4. Build the Windows app

In the same folder:

```powershell
npm run build:win
```

- Output goes to **`dist/`**.
- You get an installer (e.g. `Regaged Setup 0.1.0.exe`) and/or a portable exe, depending on your `package.json` config.

To make the **built exe** use your URL without env vars, set the default in `main.js` as in Option B above, then run `npm run build:win` again.

---

## 5. Publish to Steam (when ready)

1. **Steamworks partner:** [partner.steamgames.com](https://partner.steamgames.com) – pay the fee and create your app to get an **App ID**.
2. **Backend:** set `STEAM_APP_ID` and `STEAM_WEB_API_KEY` (from Steamworks) in your Regaged backend env.
3. **Client:** set that same `STEAM_APP_ID` in the Steam client (env or in `main.js`).
4. **Steam build:** in `package.json`, under `build.steam`, you can enable publish and set your App ID; then run `npm run build:steam` (or use the same `dist/` output and upload it in Steamworks).
5. **Upload:** in Steamworks, use “Builds” / “Upload build” and upload the contents of `dist/` (or the installer) as your Windows depot.

If you tell me your backend URL and whether you’re testing locally or building for Steam, I can give you the exact line to put in `main.js` and the exact commands to run.
