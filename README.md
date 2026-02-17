# Cat's Cradle (2-Player Prototype)

A browser game prototype based on your puzzle concept.

## Run

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## How to play

- Two human players share one screen.
- Mobile-friendly layout tuned for tall Android screens (including 1080x2436 class devices) while staying playable across different phone sizes.
- Caller selects target by clicking the number node on the board.
- Drawer draws from current node to selected target.
- Roles alternate each valid move:
  - Player 1 calls → Player 2 draws
  - Player 2 calls → Player 1 draws
- Invalid draw (crossing lines, touching blocked nodes, out of bounds) does **not** end game; same drawer retries the same turn.
- After all numbers are connected, final forced target is Cat House; successful return wins.
