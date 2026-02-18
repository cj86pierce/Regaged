# Getting Regaged on Steam

Step-by-step from zero to having your game on the Steam store.

---

## 1. Create a Steamworks partner account

1. Go to **[partner.steamgames.com](https://partner.steamgames.com)** and sign in with your Steam account.
2. Pay the **Steamworks fee** (one-time, currently **$100 USD**). This is a deposit; you get it back once your game makes a certain amount in sales (see Steam’s current terms).
3. Complete any identity/bank/tax forms Steam asks for.

---

## 2. Create your app and get IDs

1. In the Steamworks partner site: **Apps & Packages** → **Add New App** (or similar).
2. Choose **“Game”** (or “Application” if that’s the only option).
3. Fill in the basic info (name, type). You can change most of this later.
4. After it’s created, open your app. On the **App Admin** or **Installation**-style page you’ll see:
   - **App ID** (e.g. `1234567`). You’ll use this everywhere below.

---

## 3. Get a Steam Web API key (for your backend)

1. Go to **[steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)** (logged into Steam).
2. Register a key (domain can be your site or “localhost” for dev).
3. Copy the **Key** and save it; you’ll use it as `STEAM_WEB_API_KEY` on your Regaged backend.

---

## 4. Configure your Regaged backend

On the server where your Regaged API runs (e.g. Vercel env vars):

- **STEAM_WEB_API_KEY** = the key from step 3  
- **STEAM_APP_ID** = your game’s App ID from step 2  
- **JWT_SECRET** = a long random string (you should already have this for Steam auth)

Redeploy so the new env vars are active.

---

## 5. Set your App ID in the Steam client

Before building the client, the app must use your real Steam App ID.

**Option A – Env var (good for local testing)**  
In PowerShell:

```powershell
$env:STEAM_APP_ID = "YOUR_APP_ID"
```

**Option B – Hardcode for the built exe (recommended for release)**  
Edit `steam-client/main.js` and set the default:

```js
const STEAM_APP_ID = process.env.STEAM_APP_ID || "YOUR_APP_ID";  // e.g. "1234567"
```

Then where you call `steamworks.init`, use `parseInt(STEAM_APP_ID, 10)`.

(If you already have a constant at the top, just set that to your App ID.)

---

## 6. Build the Windows client

From the Steam client folder:

```powershell
cd c:\dev\regaged\tengaged-mvp\steam-client
npm run build:win
```

Output is under **`dist/`**, for example:

- **`Regaged Setup x.x.x.exe`** – installer (good for Steam)
- Or a portable exe / unpacked folder, depending on your `package.json` config.

Test the built exe locally: run it **from Steam** (add as “Non-Steam game” and launch from library) and confirm it logs in and loads Regaged.

---

## 7. Create a depot and upload the build (Steamworks)

1. In Steamworks: open your app → **Builds** / **Depots** (or **Steamworks Settings** → **Depots**).
2. **Create a depot** (e.g. “Windows”):
   - **Depot ID**: Steam will assign one, or you can choose.
   - **Operating System**: Windows.
   - **Content path**: Can leave default or set to a folder you’ll upload (see below).
3. **Upload the content** for that depot. Two common ways:

   **A. Steamworks web upload**  
   - In the depot or “Upload” section, use “Upload build” / “Upload depot content.”
   - Select the **contents** of your built game (e.g. the folder that contains your exe and the rest of the files electron-builder produced).  
   - For an installer build, you usually upload the **unpacked** app (the folder electron-builder outputs that contains the exe and `resources/`, etc.), not only the installer exe, so Steam can patch and install correctly. Check Steam’s current “Uploading to Steam” doc for the exact layout they expect.

   **B. SteamCMD**  
   - Install SteamCMD, then use it to upload the same folder to your depot (see [Steam’s Uploading docs](https://partner.steamgames.com/doc/sdk/uploading)).

4. **Create a build** that uses this depot:
   - **Builds** → **Add new build** (or equivalent).
   - Attach the depot you just uploaded.
   - Set a **build ID** (e.g. version number).
   - Don’t set it “live” until you’re ready.

5. When everything looks good, **set the build live** for the default branch (e.g. “default” or “main”). That’s the build players will get when they install your game.

---

## 8. Steam SDK DLLs (if the game won’t start)

If the built game fails to start with a missing-DLL or Steam init error:

1. Download the **Steamworks SDK** from the Steamworks partner site (Downloads or SDK section).
2. From the SDK, copy the right **redistributable** files (e.g. `sdk/redistributable_bin/win64/steam_api64.dll`) into the same folder as your game’s exe in the built app (or the root of what you upload to the depot).
3. Rebuild / re-upload and test again.

The **steamworks.js** npm package may also ship DLLs under `node_modules/steamworks.js/dist/win64/`. If electron-builder doesn’t pack those next to the exe, you can add an **extraResources** (or copy step) in `package.json` so the built app includes them. Only do this if you hit a missing-DLL error.

---

## 9. Store page and release

1. In Steamworks, open **Store Presence** (or **Store** → your app).
2. Fill in:
   - Short/long description, capsules, trailers, screenshots.
   - **Price** (or “Free to play”).
   - System requirements (e.g. Windows 10+, 64-bit).
3. When the build is uploaded and set live, choose **Release** (or “Publish”) so the store page goes public and users can install the game.

---

## Quick checklist

- [ ] Steamworks account created, fee paid  
- [ ] App created, **App ID** noted  
- [ ] **Steam Web API key** created, saved  
- [ ] Backend env: `STEAM_WEB_API_KEY`, `STEAM_APP_ID`, `JWT_SECRET`  
- [ ] `steam-client/main.js` (or env) uses your **App ID**  
- [ ] `npm run build:win` runs and produces a working exe  
- [ ] Depot created, build uploaded, build set live  
- [ ] Store page filled, game released  

For exact UI and labels, Steam sometimes changes the partner site; use **[partner.steamgames.com](https://partner.steamgames.com)** and their **Uploading** / **Depots** / **Builds** docs as the source of truth.
