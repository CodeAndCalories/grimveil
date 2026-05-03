import express          from 'express';
import cors             from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID }  from 'crypto';
import { MSG }         from '../shared/Protocol.js';
import { setupAccounts } from './accounts.js';

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true, players: registry.size }));
setupAccounts(app);

// ── Player registry: playerId → { x, y, zone, name, ws } ─────────────────────
const registry = new Map();

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(zone, obj, excludeWs = null) {
  const data = JSON.stringify(obj);
  registry.forEach(p => {
    if (p.zone === zone && p.ws !== excludeWs && p.ws.readyState === 1)
      p.ws.send(data);
  });
}

function worldState(zone) {
  const players = [];
  registry.forEach((p, playerId) => {
    if (p.zone === zone)
      players.push({ playerId, x: p.x, y: p.y, name: p.name });
  });
  return { type: MSG.WORLD_STATE, players };
}

// ── WebSocket handling ────────────────────────────────────────────────────────
wss.on('connection', ws => {
  const playerId = randomUUID();
  console.log(`[WS] connected: ${playerId.slice(0, 8)}`);

  // Ping/pong keepalive every 30 s
  const pingTimer = setInterval(() => {
    if (ws.readyState === 1) ws.ping();
    else clearInterval(pingTimer);
  }, 30_000);
  ws.on('pong', () => {});

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {

      case MSG.PLAYER_JOIN: {
        const { x = 20, y = 14, zone = 'overworld', name = 'Adventurer' } = msg;
        registry.set(playerId, { x, y, zone, name: String(name).slice(0, 20), ws });
        send(ws, worldState(zone));
        broadcast(zone, { type: MSG.PLAYER_UPDATE, playerId, x, y, name }, ws);
        console.log(`[WS] join: ${name} @ ${zone}`);
        break;
      }

      case MSG.PLAYER_MOVE: {
        const p = registry.get(playerId);
        if (!p) break;
        const { x, y, zone } = msg;
        if (zone !== p.zone) {
          broadcast(p.zone, { type: MSG.PLAYER_LEAVE, playerId }, ws);
          p.zone = zone;
          send(ws, worldState(zone));
        }
        p.x = x; p.y = y;
        broadcast(p.zone, { type: MSG.PLAYER_UPDATE, playerId, x, y }, ws);
        break;
      }

      case MSG.PLAYER_LEAVE: {
        const p = registry.get(playerId);
        if (p) broadcast(p.zone, { type: MSG.PLAYER_LEAVE, playerId }, ws);
        registry.delete(playerId);
        break;
      }

      case MSG.PLAYER_CHAT: {
        const p = registry.get(playerId);
        if (!p || !msg.text) break;
        const text = String(msg.text).slice(0, 200);
        broadcast(p.zone, { type: MSG.PLAYER_CHAT, playerId, name: p.name, text });
        break;
      }
    }
  });

  ws.on('close', () => {
    clearInterval(pingTimer);
    const p = registry.get(playerId);
    if (p) broadcast(p.zone, { type: MSG.PLAYER_LEAVE, playerId }, ws);
    registry.delete(playerId);
    console.log(`[WS] disconnected: ${playerId.slice(0, 8)}`);
  });

  ws.on('error', err => console.warn('[WS] error:', err.message));
});

server.listen(PORT, () => {
  console.log(`Grimveil server → http://localhost:${PORT}`);
  console.log(`  POST /register  POST /login  GET /health`);
});
