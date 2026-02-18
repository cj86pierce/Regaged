const { app, BrowserWindow } = require("electron");
const path = require("path");

// Base URL of your deployed Regaged backend (same origin as API). No trailing slash.
// Set via env REGAGED_API_BASE, or edit this default for the built exe:
const API_BASE = process.env.REGAGED_API_BASE || "https://regaged.vercel.app";

// Your Steam App ID from Steamworks. Use 480 only for local testing (Spacewar); set your real App ID before publishing.
const STEAM_APP_ID = process.env.STEAM_APP_ID || "480";

let mainWindow = null;

async function getSteamToken() {
  try {
    // Load from app directory so it works when run via npm start or from built exe
    const steamworksPath = path.join(__dirname, "node_modules", "steamworks.js");
    let steamworks;
    try {
      steamworks = require(steamworksPath);
    } catch (e) {
      console.error("Steamworks not found. Run 'npm install' in the steam-client folder.", e.message);
      return null;
    }
    steamworks.init(parseInt(STEAM_APP_ID, 10));
    // getAuthTicketForWebApi(identity) – identity is your backend; empty string is valid for Web API validation
    const ticket = await steamworks.auth.getAuthTicketForWebApi("");
    if (!ticket) {
      console.error("Steam: no session ticket (not running under Steam?)");
      return null;
    }
    const ticketHex = ticket.getBytes().toString("hex");
    ticket.cancel();
    const res = await fetch(`${API_BASE}/api/auth/steam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: ticketHex }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Steam auth failed:", data?.error || res.status);
      return null;
    }
    return data.token;
  } catch (e) {
    console.error("Steam auth error:", e);
    return null;
  }
}

function createWindow(token) {
  const url = token
    ? `${API_BASE}/auth/steam-callback?token=${encodeURIComponent(token)}`
    : API_BASE;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    title: "Regaged",
  });
  mainWindow.loadURL(url);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  const token = await getSteamToken();
  createWindow(token);
});

app.on("window-all-closed", () => app.quit());
