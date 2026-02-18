import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { getDatabase, ref, get, set, update, onValue, runTransaction } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';

const CONSTANTS = {
  BOARD_RATIO: 9 / 16,
  R: 20,
  T: 10,
  LINE_WIDTH: 3,
  SAMPLE_DISTANCE: 8,
  LIVE_STROKE_MS: 100
};

const firebaseConfig = {
  apiKey: 'AIzaSyB9B1ZXYPep-PeNeo_D35Kf1kofpB9GR3Q',
  authDomain: 'cats-cradle-10e30.firebaseapp.com',
  projectId: 'cats-cradle-10e30',
  storageBucket: 'cats-cradle-10e30.firebasestorage.app',
  messagingSenderId: '807058658558',
  appId: '1:807058658558:web:060f0292e84b0bcfde81af',
  databaseURL: 'https://cats-cradle-10e30-default-rtdb.europe-west1.firebasedatabase.app'
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const turnLabel = document.getElementById('turnLabel');
const roleLabel = document.getElementById('roleLabel');
const modeLabel = document.getElementById('modeLabel');
const roomInfo = document.getElementById('roomInfo');
const roomCodeInput = document.getElementById('roomCodeInput');
const offlineBtn = document.getElementById('offlineBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const restartBtn = document.getElementById('restartBtn');
const noMoveBtn = document.getElementById('noMoveBtn');

const state = {
  mode: 'offline',
  uid: null,
  roomCode: null,
  isHost: false,
  yourPlayer: 'p1',
  picker: 'p1',
  drawer: 'p2',
  currentNodeId: 'H',
  selectedTargetId: null,
  remaining: new Set(Array.from({ length: 12 }, (_, i) => i + 1)),
  moves: [],
  gameOver: false,
  winner: null,
  drawing: false,
  pointerId: null,
  fingerPoint: null,
  penPoint: null,
  draftPoints: [],
  boardRect: null,
  nodes: [],
  liveStroke: null,
  unsubRoom: null,
  liveStrokeAt: 0
};

const firebase = setupFirebase();
resizeCanvas();
setOfflineGame();
attachEvents();
requestAnimationFrame(loop);

function setupFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase(app);
    signInAnonymously(auth).catch(() => setStatus('Anonymous auth failed; offline still works.'));
    auth.onAuthStateChanged((u) => {
      if (u) state.uid = u.uid;
    });
    return { auth, db };
  } catch {
    setStatus('Firebase unavailable; offline mode active.');
    return null;
  }
}

function defaultGameState() {
  return {
    picker: 'p1',
    drawer: 'p2',
    currentNodeId: 'H',
    selectedTargetId: null,
    remaining: Array.from({ length: 12 }, (_, i) => i + 1),
    moves: [],
    winner: null,
    gameOver: false,
    drawDeclared: false,
    liveStroke: null,
    moveRequest: null
  };
}

function setOfflineGame() {
  state.mode = 'offline';
  state.roomCode = null;
  state.isHost = true;
  state.yourPlayer = 'p1';
  loadGame(defaultGameState());
  setStatus('Offline: Picker choose target, Drawer draw line.');
  syncHud();
}

function loadGame(g) {
  state.picker = g.picker;
  state.drawer = g.drawer;
  state.currentNodeId = g.currentNodeId;
  state.selectedTargetId = g.selectedTargetId;
  state.remaining = new Set(g.remaining);
  state.moves = g.moves || [];
  state.gameOver = Boolean(g.gameOver);
  state.winner = g.winner;
  state.liveStroke = g.liveStroke || null;
}

function setStatus(msg) { statusEl.textContent = msg; }
function syncHud() {
  const turn = state.selectedTargetId == null ? `Picker (${state.picker.toUpperCase()}) select` : `Drawer (${state.drawer.toUpperCase()}) draw`;
  turnLabel.textContent = `Turn: ${turn}`;
  roleLabel.textContent = `You: ${state.mode === 'offline' ? 'P1/P2 (local)' : state.yourPlayer.toUpperCase()}`;
  modeLabel.textContent = `Mode: ${state.mode === 'offline' ? 'Offline' : 'Online'}`;
  roomInfo.textContent = state.roomCode ? `Room ${state.roomCode} (${state.isHost ? 'Host' : 'Guest'})` : 'No room connected.';
}

function attachEvents() {
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', cancelDraw);

  offlineBtn.addEventListener('click', () => {
    leaveRoom();
    setOfflineGame();
  });
  restartBtn.addEventListener('click', restartGame);
  noMoveBtn.addEventListener('click', declareDrawNoMove);
  createRoomBtn.addEventListener('click', createRoom);
  joinRoomBtn.addEventListener('click', () => joinRoom(roomCodeInput.value));
}

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.boardRect = calcBoardRect(canvas.clientWidth, canvas.clientHeight);
  state.nodes = buildNodes(state.boardRect);
}

function calcBoardRect(w, h) {
  const ratio = CONSTANTS.BOARD_RATIO;
  let bw = w;
  let bh = bw / ratio;
  if (bh > h) {
    bh = h;
    bw = bh * ratio;
  }
  return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
}

function normToPx(nx, ny, r = state.boardRect) {
  return { x: r.x + nx * r.w, y: r.y + ny * r.h };
}

function buildNodes(board) {
  const nodes = [{ id: 'H', ...normToPx(0.5, 0.09, board), r: CONSTANTS.R }];
  const xs = [0.2, 0.5, 0.8];
  const ys = [0.28, 0.46, 0.64, 0.82];
  let id = 1;
  for (const y of ys) {
    for (const x of xs) {
      nodes.push({ id, ...normToPx(x, y, board), r: CONSTANTS.R });
      id += 1;
    }
  }
  return nodes;
}

function getNode(id) {
  return state.nodes.find((n) => String(n.id) === String(id));
}

function onPointerDown(e) {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  state.pointerId = e.pointerId;
  state.drawing = true;
  state.fingerPoint = { x: e.clientX, y: e.clientY };
  state.penPoint = fingerToPen(e.clientX, e.clientY);

  if (state.gameOver) return;

  if (state.selectedTargetId == null) {
    if (!isPickerTurnLocal()) return;
    const target = hitSelectableNode(screenToCanvas(e.clientX, e.clientY));
    if (target) {
      state.selectedTargetId = target.id;
      setStatus(`Target ${target.id} selected. Drawer draw now.`);
      persistRoomState();
    }
    return;
  }

  if (!isDrawerTurnLocal()) return;
  state.draftPoints = [state.penPoint];
}

function onPointerMove(e) {
  if (!state.drawing || state.pointerId !== e.pointerId) return;
  e.preventDefault();
  state.fingerPoint = { x: e.clientX, y: e.clientY };
  state.penPoint = fingerToPen(e.clientX, e.clientY);

  if (!isDrawerTurnLocal() || state.selectedTargetId == null || state.draftPoints.length === 0) return;
  const last = state.draftPoints[state.draftPoints.length - 1];
  if (distance(last, state.penPoint) >= CONSTANTS.SAMPLE_DISTANCE) {
    state.draftPoints.push(state.penPoint);
    pushLiveStroke();
  }
}

function onPointerUp(e) {
  if (state.pointerId !== e.pointerId) return;
  state.drawing = false;
  state.pointerId = null;
  if (!isDrawerTurnLocal() || state.selectedTargetId == null || state.draftPoints.length < 2) {
    state.draftPoints = [];
    clearLiveStroke();
    return;
  }

  const validation = validateMove({
    path: state.draftPoints,
    currentNodeId: state.currentNodeId,
    targetId: state.selectedTargetId,
    nodes: state.nodes,
    previousMoves: state.moves,
    tolerance: CONSTANTS.T
  });

  if (!validation.ok) {
    state.draftPoints = [];
    clearLiveStroke();
    setStatus(`Cancelled: ${validation.reason}`);
    return;
  }

  commitValidMove(validation.cleanedPath);
  clearLiveStroke();
}

function cancelDraw() {
  state.drawing = false;
  state.pointerId = null;
  state.draftPoints = [];
  clearLiveStroke();
}

function screenToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function fingerToPen(clientX, clientY) {
  const p = screenToCanvas(clientX, clientY);
  let dx = 0;
  let dy = -55;
  if (clientY < 90) dy = 55;
  if (clientX < 70) dx = 25;
  if (clientX > window.innerWidth - 70) dx = -25;
  return clampToBoard({ x: p.x + dx, y: p.y + dy });
}

function clampToBoard(p) {
  const b = state.boardRect;
  return {
    x: Math.max(b.x, Math.min(b.x + b.w, p.x)),
    y: Math.max(b.y, Math.min(b.y + b.h, p.y))
  };
}

function isPickerTurnLocal() {
  return state.mode === 'offline' || state.yourPlayer === state.picker;
}

function isDrawerTurnLocal() {
  return state.mode === 'offline' || state.yourPlayer === state.drawer;
}

function hitSelectableNode(p) {
  for (const n of state.nodes) {
    if (n.id === 'H') continue;
    if (!state.remaining.has(Number(n.id))) continue;
    if (distance(p, n) <= n.r + 10) return n;
  }
  return null;
}

// ---------- engine / pure validation ----------
function validateMove({ path, currentNodeId, targetId, nodes, previousMoves, tolerance }) {
  if (targetId == null) return { ok: false, reason: 'target not selected' };
  const startNode = nodes.find((n) => String(n.id) === String(currentNodeId));
  const endNode = nodes.find((n) => String(n.id) === String(targetId));
  if (!startNode || !endNode || path.length < 2) return { ok: false, reason: 'bad path' };

  const cleanedPath = simplifyPath(path, CONSTANTS.SAMPLE_DISTANCE / 2);
  const start = cleanedPath[0];
  const end = cleanedPath[cleanedPath.length - 1];

  if (!isOnBorder(start, startNode, tolerance)) return { ok: false, reason: 'start must be on current border' };
  if (!isOnBorder(end, endNode, tolerance)) return { ok: false, reason: 'end must be on target border' };

  for (const n of nodes) {
    const isStart = String(n.id) === String(startNode.id);
    const isEnd = String(n.id) === String(endNode.id);
    if (pathHitsCircle(cleanedPath, n, { allowStart: isStart, allowEnd: isEnd })) {
      return { ok: false, reason: `path touched node ${n.id}` };
    }
  }

  const newSegments = toSegments(cleanedPath);
  for (const move of previousMoves) {
    for (const oldS of toSegments(move.points)) {
      for (const s of newSegments) {
        if (segmentsIntersect(s.a, s.b, oldS.a, oldS.b)) {
          return { ok: false, reason: 'crossed previous line' };
        }
      }
    }
  }

  return { ok: true, cleanedPath };
}

function simplifyPath(path, minDist) {
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (distance(path[i], out[out.length - 1]) >= minDist) out.push(path[i]);
  }
  return out;
}

function isOnBorder(p, c, t) {
  const d = distance(p, c);
  return Math.abs(d - c.r) <= t;
}

function pathHitsCircle(path, circle, { allowStart = false, allowEnd = false }) {
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const d = distance(p, circle);
    if (d >= circle.r) continue;
    const nearStart = i <= 1;
    const nearEnd = i >= path.length - 2;
    if (allowStart && nearStart) continue;
    if (allowEnd && nearEnd) continue;
    return true;
  }
  return false;
}

function toSegments(path) {
  const segs = [];
  for (let i = 1; i < path.length; i++) segs.push({ a: path[i - 1], b: path[i] });
  return segs;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ccw(a, b, c) {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  if (samePoint(a, c) || samePoint(a, d) || samePoint(b, c) || samePoint(b, d)) return false;
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

// ---------- state transitions ----------
function commitValidMove(points) {
  const targetId = state.selectedTargetId;
  state.moves.push({ fromId: state.currentNodeId, toId: targetId, by: state.drawer, points });
  if (targetId !== 'H') state.remaining.delete(Number(targetId));
  state.currentNodeId = targetId;
  state.selectedTargetId = null;
  state.draftPoints = [];

  if (state.remaining.size === 0 && state.currentNodeId !== 'H') {
    state.selectedTargetId = 'H';
    setStatus(`All numbers done. ${state.picker.toUpperCase()} must send back to H.`);
  } else if (state.currentNodeId === 'H' && state.remaining.size === 0) {
    state.gameOver = true;
    state.winner = state.drawer;
    setStatus(`Winner: ${state.drawer.toUpperCase()} connected back to H.`);
  } else {
    [state.picker, state.drawer] = [state.drawer, state.picker];
    setStatus(`Valid move. ${state.picker.toUpperCase()} pick a target.`);
  }

  persistRoomState();
}

function restartGame() {
  loadGame(defaultGameState());
  state.draftPoints = [];
  state.gameOver = false;
  state.winner = null;
  setStatus('Game restarted.');
  persistRoomState();
}

function declareDrawNoMove() {
  state.gameOver = true;
  state.winner = null;
  setStatus('Match ended as draw (no move possible).');
  persistRoomState({ drawDeclared: true });
}

// ---------- render ----------
function loop() {
  render();
  syncHud();
  requestAnimationFrame(loop);
}

function render() {
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const b = state.boardRect;

  ctx.fillStyle = '#fffaf7';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = '#e5b08b';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);

  drawMoves(state.moves, '#2563eb');
  if (state.liveStroke?.points?.length > 1) drawMoves([{ points: state.liveStroke.points }], '#16a34a');
  if (state.draftPoints.length > 1) drawMoves([{ points: state.draftPoints }], '#dc2626');

  for (const n of state.nodes) {
    const isTarget = String(state.selectedTargetId) === String(n.id);
    const active = String(state.currentNodeId) === String(n.id);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = isTarget ? '#f97316' : active ? '#14b8a6' : '#0f172a';
    ctx.lineWidth = isTarget ? 3 : 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n.id), n.x, n.y);
  }

  if (state.penPoint) {
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.penPoint.x, state.penPoint.y, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMoves(moves, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = CONSTANTS.LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const m of moves) {
    const pts = m.points;
    if (!pts || pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const c = pts[i];
      const n = pts[i + 1];
      const mx = (c.x + n.x) / 2;
      const my = (c.y + n.y) / 2;
      ctx.quadraticCurveTo(c.x, c.y, mx, my);
    }
    ctx.stroke();
  }
}

// ---------- firebase net layer ----------
async function createRoom() {
  if (!firebase || !state.uid) return setStatus('Wait for auth and retry.');
  const code = Math.random().toString(36).slice(2, 7).toUpperCase();
  const room = {
    hostUid: state.uid,
    players: { p1: state.uid, p2: null },
    game: defaultGameState(),
    updatedAt: Date.now()
  };
  await set(ref(firebase.db, `rooms/${code}`), room);
  subscribeRoom(code);
}

async function joinRoom(raw) {
  if (!firebase || !state.uid) return setStatus('Wait for auth and retry.');
  const code = String(raw || '').trim().toUpperCase();
  if (code.length !== 5) return setStatus('Room code must be 5 chars.');
  await runTransaction(ref(firebase.db, `rooms/${code}`), (room) => {
    if (!room) return room;
    room.players ??= {};
    if (!room.players.p1) room.players.p1 = state.uid;
    else if (!room.players.p2 && room.players.p1 !== state.uid) room.players.p2 = state.uid;
    return room;
  });
  subscribeRoom(code);
}

function leaveRoom() {
  if (state.unsubRoom) {
    state.unsubRoom();
    state.unsubRoom = null;
  }
}

function subscribeRoom(code) {
  leaveRoom();
  state.mode = 'online';
  state.roomCode = code;
  state.unsubRoom = onValue(ref(firebase.db, `rooms/${code}`), (snap) => {
    if (!snap.exists()) return setStatus('Room missing.');
    const room = snap.val();
    const players = room.players || {};
    state.isHost = room.hostUid === state.uid;
    state.yourPlayer = players.p1 === state.uid ? 'p1' : 'p2';
    loadGame(room.game || defaultGameState());
    if (state.isHost && room.game?.moveRequest) handleMoveRequest(room.game.moveRequest);
  });
}

async function persistRoomState(extra = {}) {
  if (state.mode !== 'online' || !state.roomCode || !firebase) return;
  const payload = {
    picker: state.picker,
    drawer: state.drawer,
    currentNodeId: state.currentNodeId,
    selectedTargetId: state.selectedTargetId,
    remaining: [...state.remaining],
    moves: state.moves,
    winner: state.winner,
    gameOver: state.gameOver,
    liveStroke: state.liveStroke,
    moveRequest: null,
    ...extra
  };
  await update(ref(firebase.db, `rooms/${state.roomCode}`), { game: payload, updatedAt: Date.now() });
}

async function pushLiveStroke() {
  if (state.mode !== 'online' || !state.roomCode || !isDrawerTurnLocal()) return;
  const now = Date.now();
  if (now - state.liveStrokeAt < CONSTANTS.LIVE_STROKE_MS) return;
  state.liveStrokeAt = now;
  state.liveStroke = { byUid: state.uid, fromId: state.currentNodeId, toId: state.selectedTargetId, points: state.draftPoints };
  await update(ref(firebase.db, `rooms/${state.roomCode}/game`), { liveStroke: state.liveStroke });
}

async function clearLiveStroke() {
  state.liveStroke = null;
  if (state.mode === 'online' && state.roomCode && firebase) {
    await update(ref(firebase.db, `rooms/${state.roomCode}/game`), { liveStroke: null });
  }
}

async function handleMoveRequest(req) {
  if (!state.isHost || !req) return;
  const result = validateMove({
    path: req.path,
    currentNodeId: state.currentNodeId,
    targetId: req.targetId,
    nodes: state.nodes,
    previousMoves: state.moves,
    tolerance: CONSTANTS.T
  });
  if (!result.ok) {
    await update(ref(firebase.db, `rooms/${state.roomCode}/game`), { moveRequest: null, liveStroke: null });
    return;
  }
  commitValidMove(result.cleanedPath);
}
