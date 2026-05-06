import { MSG }          from '../../shared/Protocol.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';

// ── State ─────────────────────────────────────────────────────────────────────
let _ws         = null;
let _playerId   = null;
let _connected  = false;
let _sendTimer  = null;

// Pending position to send on next 100 ms tick
let _pendingX = null, _pendingY = null, _pendingZone = null;
let _lastSentX = null, _lastSentY = null, _lastSentZone = null;

const _remotePlayers = new Map(); // playerId → RemotePlayer

// ── Public API ────────────────────────────────────────────────────────────────

export function getRemotePlayers() { return _remotePlayers; }
export function isOnline()          { return _connected; }
export function getPlayerId()        { return _playerId; }

/**
 * connect(wsUrl, { x, y, zone, name, playerId })
 * Gracefully falls back to offline mode if the server is unreachable.
 */
export function connect(wsUrl, opts = {}) {
  const { x = 20, y = 14, zone = 'overworld', name = 'Adventurer', playerId = null } = opts;
  _playerId = playerId;
  _pendingX = x; _pendingY = y; _pendingZone = zone;

  try {
    _ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn('[Net] offline — cannot reach', wsUrl);
    return;
  }

  _ws.addEventListener('open', () => {
    _connected = true;
    console.log('[Net] connected to', wsUrl);
    _send(MSG.PLAYER_JOIN, { x, y, zone, name });
    // Start 100 ms position-send loop
    _sendTimer = setInterval(_flushPosition, 100);
  });

  _ws.addEventListener('close', () => {
    _connected = false;
    _remotePlayers.clear();
    if (_sendTimer) { clearInterval(_sendTimer); _sendTimer = null; }
    console.log('[Net] disconnected');
  });

  _ws.addEventListener('error', () => {
    // Logged by 'close' handler; no extra action needed
    console.warn('[Net] connection error — running offline');
  });

  _ws.addEventListener('message', e => {
    try { _handle(JSON.parse(e.data)); } catch (_) {}
  });
}

/** Call every frame from the update loop to advance lerp on all remote players */
export function tick(dt) {
  _remotePlayers.forEach(rp => rp.tick(dt));
}

/** Queue the player's current tile position; sent at most every 100 ms */
export function updatePosition(x, y, zone) {
  _pendingX = x; _pendingY = y; _pendingZone = zone;
}

export function disconnect() {
  if (_ws) { _send(MSG.PLAYER_LEAVE, {}); _ws.close(); }
  if (_sendTimer) clearInterval(_sendTimer);
  _remotePlayers.clear();
}

// ── Internals ─────────────────────────────────────────────────────────────────

function _flushPosition() {
  if (!_connected || _pendingX === null) return;
  if (_pendingX === _lastSentX && _pendingY === _lastSentY && _pendingZone === _lastSentZone) return;
  _lastSentX = _pendingX; _lastSentY = _pendingY; _lastSentZone = _pendingZone;
  _send(MSG.PLAYER_MOVE, { x: _pendingX, y: _pendingY, zone: _pendingZone });
}

function _send(type, payload = {}) {
  if (_ws?.readyState === WebSocket.OPEN)
    _ws.send(JSON.stringify({ type, ...payload }));
}

function _handle(msg) {
  switch (msg.type) {

    case MSG.WORLD_STATE: {
      _remotePlayers.clear();
      (msg.players || []).forEach(p => {
        if (p.playerId !== _playerId)
          _remotePlayers.set(p.playerId, new RemotePlayer(p.playerId, p.x, p.y, p.name, p.zone));
      });
      break;
    }

    case MSG.PLAYER_UPDATE: {
      if (msg.playerId === _playerId) break;
      const rp = _remotePlayers.get(msg.playerId);
      if (rp) {
        rp.setTarget(msg.x, msg.y, msg.zone);
      } else {
        _remotePlayers.set(
          msg.playerId,
          new RemotePlayer(msg.playerId, msg.x, msg.y, msg.name || 'Adventurer', msg.zone || 'overworld')
        );
      }
      break;
    }

    case MSG.PLAYER_LEAVE:
      _remotePlayers.delete(msg.playerId);
      break;

    case MSG.PLAYER_CHAT:
      // Lazy import avoids circular deps; chat.js is pure UI
      import('../ui/chat.js').then(({ chat }) => {
        if (msg.text) chat(`[${msg.name || '?'}] ${msg.text}`, 'info');
      });
      break;
  }
}
