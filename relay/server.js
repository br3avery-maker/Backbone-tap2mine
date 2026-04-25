/**
 * Tap2Mine Signaling Relay
 *
 * Ephemeral message relay for WebRTC P2P bootstrap.
 * Messages expire after 60 seconds. No database, no auth, no persistence.
 * The relay never sees the actual P2P data — just SDP offers/answers.
 *
 * API:
 *   POST /v1/register?node_id=xxx  → returns a session token
 *   POST /v1/send                  → { token, to_node_id, message }
 *   POST /v1/poll                  → { token, since } → messages
 *
 * Deploy anywhere: Node.js, Fly.io, Cloudflare Workers, Raspberry Pi.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT) || 3001;
const MESSAGE_TTL = 60_000; // 60 seconds
const MAX_MESSAGES_PER_NODE = 100;

// In-memory message store
// Structure: Map<node_id, [{ from, data, timestamp }]>
const inbox = new Map();
const tokens = new Map(); // node_id → token

function generateToken() {
  return randomBytes(16).toString('hex');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function cleanup() {
  const now = Date.now();
  for (const [nodeId, messages] of inbox) {
    const fresh = messages.filter(m => now - m.timestamp < MESSAGE_TTL);
    if (fresh.length === 0) inbox.delete(nodeId);
    else inbox.set(nodeId, fresh);
  }
}

// Cleanup every 30 seconds
setInterval(cleanup, 30_000);

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    // ── Register a node ──
    if (url.pathname === '/v1/register' && req.method === 'POST') {
      const nodeId = url.searchParams.get('node_id');
      if (!nodeId) return jsonResponse(res, 400, { error: 'Missing node_id' });

      const token = tokens.get(nodeId) || generateToken();
      tokens.set(nodeId, token);
      if (!inbox.has(nodeId)) inbox.set(nodeId, []);

      return jsonResponse(res, 200, { token, nodeId });
    }

    // ── Send a message to another node ──
    if (url.pathname === '/v1/send' && req.method === 'POST') {
      const body = await parseBody(req);
      const { token, to_node_id, message } = body;

      if (!token || !to_node_id || !message) {
        return jsonResponse(res, 400, { error: 'Missing token, to_node_id, or message' });
      }

      // Verify token
      const storedToken = tokens.get(to_node_id);
      if (storedToken && storedToken !== token) {
        return jsonResponse(res, 403, { error: 'Invalid token' });
      }

      // Store the message
      const messages = inbox.get(to_node_id) || [];
      messages.push({
        from: body.from_node_id || 'unknown',
        data: message,
        timestamp: Date.now(),
      });

      // Cap message count per node
      if (messages.length > MAX_MESSAGES_PER_NODE) {
        messages.splice(0, messages.length - MAX_MESSAGES_PER_NODE);
      }

      inbox.set(to_node_id, messages);
      return jsonResponse(res, 200, { ok: true });
    }

    // ── Poll for messages ──
    if (url.pathname === '/v1/poll' && req.method === 'POST') {
      const body = await parseBody(req);
      const { token, since = 0 } = body;

      if (!token) return jsonResponse(res, 400, { error: 'Missing token' });

      // Find the node_id for this token
      let nodeId = null;
      for (const [id, tok] of tokens) {
        if (tok === token) { nodeId = id; break; }
      }
      if (!nodeId) return jsonResponse(res, 401, { error: 'Invalid token' });

      const messages = inbox.get(nodeId) || [];
      const newMessages = messages.filter(m => m.timestamp > since);

      return jsonResponse(res, 200, {
        messages: newMessages,
        since: Date.now(),
      });
    }

    // ── Health check ──
    if (url.pathname === '/health' && req.method === 'GET') {
      return jsonResponse(res, 200, {
        status: 'ok',
        nodes: tokens.size,
        queued: inbox.size,
        uptime: process.uptime(),
      });
    }

    // ── Unknown route ──
    jsonResponse(res, 404, { error: 'Not found' });

  } catch (err) {
    jsonResponse(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Tap2Mine Relay listening on :${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
