import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = process.env.PORT || 3001;

app.use(express.json());
app.get('/health', (_, res) => res.json({ ok: true }));

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] client connected: ${ip}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log(`[WS] message from ${ip}:`, msg);
      // TODO: route msg.type to game logic
    } catch (e) {
      console.warn('[WS] bad message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] client disconnected: ${ip}`);
  });
});

server.listen(PORT, () => {
  console.log(`Grimveil server running on http://localhost:${PORT}`);
});
