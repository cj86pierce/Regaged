fetch("/api/dev/fill-game", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-dev-secret": "regaged-dev-9f3b"
  },
  body: JSON.stringify({ gameId: "cmkhxi9q70000l8041w9uyunp" })
}).then(r => r.json()).then(console.log)
