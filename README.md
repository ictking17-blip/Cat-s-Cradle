# Cat's Cradle (Firebase Realtime Database Multiplayer)

Realtime 2-player Cat's Cradle game using **Firebase Realtime Database**.

## Run locally

Serve this folder with any static server:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## How to play online

1. Player 1 taps **Create Room** and shares the room code.
2. Player 2 enters the same code and taps **Join Room**.
3. Caller selects a number node.
4. Drawer draws from current node to selected target.
5. Turns alternate after valid moves.
6. Invalid draw retries same turn.
7. After all numbers are connected, final return to Cat House wins.

## Realtime Database rules (what to paste)

In Firebase Console → Realtime Database → Rules, paste this while testing:

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

> This is open test mode. For production, tighten rules.

## Deploy (free)

Use **Firebase Hosting**:

1. `npm i -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` (select project `cats-cradle-10e30`)
4. Public directory: `.`
5. Single-page app rewrite: `No`
6. `firebase deploy`

Then open the hosting URL on both phones and play with room codes.
