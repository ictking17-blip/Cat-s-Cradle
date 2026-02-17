# Cat's Cradle (2-Player Prototype)

A browser game prototype based on your puzzle concept.

## Run

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Current gameplay

- 12 numbered nodes + Cat House at top.
- Two human players share one screen.
- Roles alternate every successful move:
  - Player 1 calls a number, Player 2 draws.
  - Then Player 2 calls, Player 1 draws.
- A draw is invalid if it:
  - crosses any previous line,
  - touches any non-target numbered node,
  - leaves the board,
  - or does not finish on the selected target.
- Winning:
  - after all numbers are used, the next caller forces the return to Cat House,
  - the drawer who successfully connects back to Cat House wins,
  - invalid draw loses immediately.
