// WebSocket client stub — ready for future multiplayer integration
// import { MSG } from '../../shared/Protocol.js';

let _ws = null;

export function connect(url) {
  _ws = new WebSocket(url);
  _ws.addEventListener('open',    () => console.log('[WS] connected'));
  _ws.addEventListener('close',   () => console.log('[WS] disconnected'));
  _ws.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      console.log('[WS] message:', msg);
      // TODO: route msg.type to game systems
    } catch (_) {}
  });
}

export function send(type, payload = {}) {
  if (_ws?.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify({ type, ...payload }));
  }
}
