# Cat's Cradle (Online Multiplayer)

Realtime 2-player Cat's Cradle game for different phones over the internet.

## Local run

```bash
npm install
npm start
```

Open `http://localhost:4173`.

## How to play online

1. Player 1 taps **Create Room** and shares the room code.
2. Player 2 enters the code and taps **Join Room**.
3. Caller selects number by tapping a number node.
4. Drawer draws from current node to selected number.
5. Turns alternate after each valid draw.
6. Invalid draw retries same turn.
7. After all numbers are connected, return to Cat House to win.

## Free hosting suggestion

Use **Render** (free tier):

1. Push this repo to GitHub.
2. Create a new Web Service on Render and connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Render gives public HTTPS URL.
6. Open that URL on both phones, create/join room code, and play.

WebSocket is automatic (`ws://` locally, `wss://` on HTTPS).
