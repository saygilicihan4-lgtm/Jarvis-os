# Pairing repair v202

The worker previously skipped every explicit pairing code whenever a saved device token existed. An expired or obsolete token therefore prevented repair through a fresh owner-issued code.

An explicit `JARVIS_PAIR_CODE` is now exchanged once per process, even with a saved token. The server still validates the one-time code; no authentication or device approval checks were removed. The previous credential is retained on rejected, malformed or unavailable responses. Exchange has a ten-second timeout. A fresh code and restart are required after failure, avoiding repeated consumption attempts on every heartbeat.

Connections now includes an explicit **Create PC pairing code** button, calling the existing authenticated `/api/pairing/create` endpoint. Opening the dialog does not issue credentials. The response stays in the dialog and is removed on close; it is not logged or saved. Failed/unauthenticated requests display an error, not a code. The code is single-use and server-expires after five minutes.

Windows launcher: `start-worker-windows.bat --repair-pairing` prompts for that fresh code even if the token file exists. Silent repair without an explicit code stops instead of blocking on input. Do not share device tokens or pairing codes in logs or screenshots.

Validated locally: production function regression tests, JavaScript syntax, whitespace checks. Physical Windows launcher execution and a live PC pairing are not verified. The production health endpoint showed zero approved/online devices during investigation; this patch alone cannot start software on an unconnected PC and is not proof of that PC's exact failure cause.
