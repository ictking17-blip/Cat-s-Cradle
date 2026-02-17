# Cat's Cradle (Firebase Realtime Database Multiplayer)

Realtime 2-player Cat's Cradle game using **Firebase Realtime Database**.

## Run locally

```bash
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

> ⚠️ Do **not** open `index.html` by double-click (`file://...`).

## Required Firebase settings

In Firebase Console for project `cats-cradle-10e30`:

1. Realtime Database must be created.
2. In Realtime Database → Rules, paste and publish:

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

## App flow (2 pages)

1. **Lobby page**: both players can Create Room or Join Room.
2. After successful create/join, app opens **Game page**.
3. Game page has no create/join controls (only game UI + copy code + leave).

## Troubleshooting

- Open browser DevTools (`F12`) and check **Console** for `[CatGame] ...` logs.
- `permission_denied` means rules are not published yet.
- Room code must be exactly 5 characters.
- `GET /favicon.ico 404` in terminal is normal.
