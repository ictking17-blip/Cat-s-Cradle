# Cat's Cradle (Firebase Online Multiplayer)

Realtime 2-player Cat's Cradle game using **Firebase Firestore** (no custom Node server required).

## Run locally

Because Firebase SDK is loaded via browser modules, run any static server:

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

## Firebase setup required

This project is wired to your Firebase app config (`cats-cradle-10e30`).

1. In Firebase Console, enable **Cloud Firestore** (production or test mode).
2. Set Firestore rules for the `rooms` collection (example starter rules):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
    }
  }
}
```

> For production, tighten these rules with auth/validation.

## Deploy (free)

Best simple option: **Firebase Hosting**

1. `npm i -g firebase-tools`
2. `firebase login`
3. `firebase init hosting` (select existing project `cats-cradle-10e30`)
4. Set public dir to `.` and configure as single-page app: `No`
5. `firebase deploy`

Then open hosting URL on both phones and play with room codes.
