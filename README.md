# Cat's Cradle Duel

Plain HTML/CSS/JS implementation with a locked 9:16 board, offline-first rules engine, and Firebase-ready online room sync.

## Files in repo root
- `index.html`
- `style.css`
- `app.js`
- `README.md`

## GitHub Pages setup
1. Push these files to `main` branch root.
2. GitHub → **Settings** → **Pages**.
3. Source: **Deploy from a branch**.
4. Branch: `main`, folder `/root`.

## Locked game spec implemented
- Portrait board with fixed 9:16 ratio.
- Cat House `H` node at top center.
- 12 numbered nodes arranged 4×3.
- Turn model: Picker selects target, Drawer draws from current to target.
- Offset pen cursor always on, adaptive to finger location.
- Validation engine as pure functions in order:
  - target selected
  - start on current border (tolerance)
  - end on target border (tolerance)
  - no entering node circles except start/end allowances
  - no crossing previous segments
- Cancel on lift before valid target border completion.
- Draw button: **No move possible → Draw**.
- Win flow: after last number, must connect back to `H`.

## Architecture (do-not-break layering)
- **engine/** concept inside `app.js`: `validateMove`, geometry helpers.
- **input/** concept: pointer + adaptive offset pen conversion.
- **render/** concept: board, nodes, moves, pen cursor.
- **net/** concept: Firebase anonymous auth + RTDB room sync + live stroke replace mode.

## Constants
- Node radius `R = 20px`
- Border tolerance `T = 10px`
- Line width `3px`
- Sample distance `8px`
- Live stroke update interval `100ms`

## Notes
- `touch-action: none` disables page pan/zoom while playing.
- Board coordinates are pixel-rendered and normalized placement is used for layout.
- Firebase rules are not locked down in this prototype; secure rules should be added before public release.
