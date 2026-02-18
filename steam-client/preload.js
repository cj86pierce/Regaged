const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("regagedElectron", { platform: process.platform });
