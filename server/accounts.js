import jwt      from 'jsonwebtoken';
import bcrypt   from 'bcryptjs';
import { randomUUID } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'grimveil-dev-secret-change-in-prod';

// In-memory store: username → { username, passwordHash, playerId }
const store = new Map();

export function setupAccounts(app) {
  app.post('/register', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required.' });
    if (username.length < 3 || username.length > 20)
      return res.status(400).json({ error: 'Username must be 3–20 characters.' });
    if (store.has(username.toLowerCase()))
      return res.status(409).json({ error: 'Username already taken.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const playerId     = randomUUID();
    store.set(username.toLowerCase(), { username, passwordHash, playerId });

    const token = jwt.sign({ playerId, username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[Accounts] registered: ${username} (${playerId})`);
    res.json({ token, playerId, username });
  });

  app.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    const user = store.get(username?.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ playerId: user.playerId, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[Accounts] login: ${user.username}`);
    res.json({ token, playerId: user.playerId, username: user.username });
  });
}

export function verifyToken(token) {
  try   { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}
