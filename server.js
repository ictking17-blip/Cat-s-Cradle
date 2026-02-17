const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 4173;
const HOUSE = { id: 'H', x: 350, y: 140, r: 24 };
const POINTS = createGridPoints();
const rooms = new Map();

function createGridPoints() {
  const columns = 3;
  const rows = 4;
  const left = 140;
  const right = 560;
  const top = 360;
  const bottom = 1140;
  const xStep = (right - left) / (columns - 1);
  const yStep = (bottom - top) / (rows - 1);
  const points = [];
  let id = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      points.push({ id, x: left + xStep * col, y: top + yStep * row, r: 15 });
      id++;
    }
  }
  return points;
}

function initGame() {
  return {
    visited: [],
    lines: [],
    currentId: 'H',
    caller: 'p1',
    drawer: 'p2',
    selectedTarget: null,
    gameOver: false,
    status: 'Player 1: select a number for Player 2 to draw.'
  };
}

function label(id) { return id === 'p1' ? 'Player 1' : 'Player 2'; }
function pointById(id) { return id === 'H' ? HOUSE : POINTS.find((p) => p.id === id); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointOnCircle(center, approachPoint, radius) {
  const dx = center.x - approachPoint.x;
  const dy = center.y - approachPoint.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: center.x - (dx / len) * radius, y: center.y - (dy / len) * radius };
}

function toSegments(path) {
  const segs = [];
  for (let i = 1; i < path.length; i++) segs.push({ a: path[i - 1], b: path[i] });
  return segs;
}
function ccw(a, b, c) { return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x); }
function segmentsIntersect(a, b, c, d) {
  if ((a.x === c.x && a.y === c.y) || (a.x === d.x && a.y === d.y) || (b.x === c.x && b.y === c.y) || (b.x === d.x && b.y === d.y)) return false;
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function isValidPath(room, path, fromId, toId) {
  for (const p of path) if (p.x < 15 || p.y < 15 || p.x > 700 - 15 || p.y > 1560 - 15) return false;
  const blocked = POINTS.filter((p) => p.id !== fromId && p.id !== toId);
  for (const p of path) {
    for (const n of blocked) if (dist(p, n) < n.r + 5) return false;
    if (fromId !== 'H' && toId !== 'H' && dist(p, HOUSE) < HOUSE.r + 6) return false;
  }

  const segs = toSegments(path);
  for (const line of room.game.lines) {
    const prev = toSegments(line.points);
    for (const s1 of segs) for (const s2 of prev) if (segmentsIntersect(s1.a, s1.b, s2.a, s2.b)) return false;
  }
  return true;
}

function send(ws, payload) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload)); }
function roomSnapshot(room, yourRole) {
  return { type: 'state', roomCode: room.code, yourRole, players: { p1: Boolean(room.players.p1), p2: Boolean(room.players.p2) }, game: room.game };
}
function broadcast(room) {
  if (room.players.p1) send(room.players.p1, roomSnapshot(room, 'p1'));
  if (room.players.p2) send(room.players.p2, roomSnapshot(room, 'p2'));
}

function createRoom(ws) {
  let code = '';
  while (!code || rooms.has(code)) code = Math.random().toString(36).slice(2, 7).toUpperCase();
  const room = { code, players: { p1: ws, p2: null }, game: initGame() };
  ws.roomCode = code;
  ws.role = 'p1';
  rooms.set(code, room);
  room.game.status = 'Waiting for Player 2 to join room...';
  broadcast(room);
}

function joinRoom(ws, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) return send(ws, { type: 'error', message: 'Room code not found.' });
  if (room.players.p2) return send(ws, { type: 'error', message: 'Room already has 2 players.' });
  room.players.p2 = ws;
  ws.roomCode = code;
  ws.role = 'p2';
  room.game.status = `${label(room.game.caller)}: select a number for ${label(room.game.drawer)}.`;
  broadcast(room);
}

function handleSelect(room, ws, targetId) {
  const game = room.game;
  if (game.gameOver || game.selectedTarget != null) return;
  if (ws.role !== game.caller) return;
  if (game.visited.includes(targetId)) return;
  if (!POINTS.find((p) => p.id === targetId)) return;

  game.selectedTarget = targetId;
  game.status = `${label(game.caller)} selected ${targetId}. ${label(game.drawer)} draw from ${game.currentId} to ${targetId}.`;
  broadcast(room);
}

function handleSubmitPath(room, ws, payloadPath) {
  const game = room.game;
  if (game.gameOver || game.selectedTarget == null) return;
  if (ws.role !== game.drawer) return;
  const from = pointById(game.currentId);
  const target = pointById(game.selectedTarget);
  const path = Array.isArray(payloadPath) ? payloadPath.map((p) => ({ x: Number(p.x), y: Number(p.y) })) : [];
  if (path.length < 2) {
    game.status = `Too short. Retry same turn: ${label(game.drawer)} draw again.`;
    return broadcast(room);
  }
  if (dist(path[0], from) > 1) path.unshift({ x: from.x, y: from.y });
  const end = path[path.length - 1];
  if (dist(end, target) > target.r + 16) {
    game.status = `Path must end on ${game.selectedTarget === 'H' ? 'Cat House' : `number ${game.selectedTarget}`}. Retry same turn.`;
    return broadcast(room);
  }

  const prev = path[path.length - 2] || path[0];
  path.push(pointOnCircle(target, prev, target.r));

  if (!isValidPath(room, path, game.currentId, game.selectedTarget)) {
    game.status = 'Line crossed/touched blocked area. Retry same turn.';
    return broadcast(room);
  }

  game.lines.push({ fromId: game.currentId, toId: game.selectedTarget, drawer: game.drawer, points: path });
  if (game.selectedTarget !== 'H') game.visited.push(game.selectedTarget);
  game.currentId = game.selectedTarget;

  if (game.selectedTarget === 'H' && game.visited.length === POINTS.length) {
    game.gameOver = true;
    game.status = `${label(game.drawer)} wins by connecting back to Cat House!`;
    game.selectedTarget = 'H';
    return broadcast(room);
  }

  game.selectedTarget = null;
  [game.caller, game.drawer] = [game.drawer, game.caller];

  if (game.visited.length === POINTS.length) {
    game.selectedTarget = 'H';
    game.status = `${label(game.caller)} selected Cat House. ${label(game.drawer)} draw from ${game.currentId} back to Cat House.`;
  } else {
    game.status = `${label(game.caller)}: select a number for ${label(game.drawer)}.`;
  }
  broadcast(room);
}

const server = http.createServer((req, res) => {
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(filePath).replace(/^\.\.(\/|\\|$)/, '');
  const full = path.join(__dirname, safePath);
  if (!full.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(full);
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'text/plain';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  send(ws, { type: 'connected' });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.type === 'create_room') return createRoom(ws);
    if (msg.type === 'join_room') return joinRoom(ws, msg.roomCode);

    const room = rooms.get(ws.roomCode);
    if (!room) return;
    if (msg.type === 'select_target') return handleSelect(room, ws, msg.targetId);
    if (msg.type === 'submit_path') return handleSubmitPath(room, ws, msg.path);
    if (msg.type === 'restart') {
      room.game = initGame();
      room.game.status = room.players.p1 && room.players.p2
        ? `${label(room.game.caller)}: select a number for ${label(room.game.drawer)}.`
        : 'Waiting for Player 2 to join room...';
      broadcast(room);
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    room.players[ws.role] = null;
    room.game = initGame();
    room.game.status = 'A player disconnected. Waiting for players...';

    if (!room.players.p1 && !room.players.p2) {
      rooms.delete(room.code);
    } else if (!room.players.p1 && room.players.p2) {
      room.players.p1 = room.players.p2;
      room.players.p1.role = 'p1';
      room.players.p2 = null;
      room.game.status = 'Player 1 slot reassigned. Waiting for Player 2 to join room...';
      broadcast(room);
    } else {
      broadcast(room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
