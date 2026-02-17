# Cat's Cradle (Firebase Realtime Database Multiplayer)

Realtime 2-player Cat's Cradle game using **Firebase Realtime Database**.

## Run locally

Serve this folder with any static server:

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

> ⚠️ Do **not** open `index.html` by double-click (`file://...`).
> Room create/join works only from `http://`/`https://`.

## Required Firebase settings (must be done)

In Firebase Console for project `cats-cradle-10e30`:

1. Go to **Realtime Database** and click **Create Database** (if not already created).
2. Select region (your project uses `europe-west1`).
3. Open **Rules** tab and paste:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

4. Click **Publish**.
5. In **Project settings → General → Your apps → Authorized domains**, make sure `localhost` is allowed.

## How to play online

1. Player 1 taps **Create Room** (a 5-char room code is generated).
2. Player 1 shares the room code.
3. Player 2 enters code and taps **Join Room**.
4. Caller selects a number node.
5. Drawer draws from current node to the selected target.
6. Invalid draw retries same turn.
7. After all numbers are connected, final return to Cat House wins.

## Troubleshooting

- `GET /favicon.ico 404` in terminal is normal.
- If buttons do not create/join room, open browser DevTools Console and check for `permission_denied` (rules not published yet).
- Room codes are exactly 5 characters.
- If numbers look distorted, reset browser zoom to 100% and hard refresh (`Ctrl+Shift+R`).
- Make sure command is run in the folder that contains `index.html`.
