/**
 * Tap2Mine Signaling Relay — Cloudflare Worker
 *
 * Ephemeral message relay for WebRTC P2P bootstrap.
 * Messages expire after 60 seconds. No database, no auth, no persistence.
 *
 * Deploy: npx wrangler deploy
 */

const MESSAGE_TTL = 60_000; // 60 seconds
const MAX_MESSAGES_PER_NODE = 100;
const CLEANUP_INTERVAL = 30_000;

// In-memory stores (scoped to this worker isolate)
const inbox = new Map();
const tokens = new Map();

function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function cleanup() {
  const now = Date.now();
  for (const [nodeId, messages] of inbox) {
    const fresh = messages.filter(m => now - m.timestamp < MESSAGE_TTL);
    if (fresh.length === 0) inbox.delete(nodeId);
    else inbox.set(nodeId, fresh);
  }
}

// Background cleanup — runs per-isolate
setInterval(cleanup, CLEANUP_INTERVAL);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // ── Register a node ──
      if (url.pathname === '/v1/register' && request.method === 'POST') {
        const nodeId = url.searchParams.get('node_id');
        if (!nodeId) return jsonResponse({ error: 'Missing node_id' }, 400);

        let token = tokens.get(nodeId);
        if (!token) {
          token = generateToken();
          tokens.set(nodeId, token);
        }
        if (!inbox.has(nodeId)) inbox.set(nodeId, []);

        return jsonResponse({ token, nodeId });
      }

      // ── Send a message ──
      if (url.pathname === '/v1/send' && request.method === 'POST') {
        const body = await request.json();
        const { token, to_node_id, message } = body;

        if (!token || !to_node_id || !message) {
          return jsonResponse({ error: 'Missing token, to_node_id, or message' }, 400);
        }

        // Verify token (if the target has one, it must match)
        const storedToken = tokens.get(to_node_id);
        if (storedToken && storedToken !== token) {
          return jsonResponse({ error: 'Invalid token' }, 403);
        }

        const messages = inbox.get(to_node_id) || [];
        messages.push({
          from: body.from_node_id || 'unknown',
          data: message,
          timestamp: Date.now(),
        });

        if (messages.length > MAX_MESSAGES_PER_NODE) {
          messages.splice(0, messages.length - MAX_MESSAGES_PER_NODE);
        }

        inbox.set(to_node_id, messages);
        return jsonResponse({ ok: true });
      }

      // ── Poll for messages ──
      if (url.pathname === '/v1/poll' && request.method === 'POST') {
        const body = await request.json();
        const { token, since = 0 } = body;

        if (!token) return jsonResponse({ error: 'Missing token' }, 400);

        // Find node_id for this token
        let nodeId = null;
        for (const [id, tok] of tokens) {
          if (tok === token) { nodeId = id; break; }
        }
        if (!nodeId) return jsonResponse({ error: 'Invalid token' }, 401);

        const messages = inbox.get(nodeId) || [];
        const newMessages = messages.filter(m => m.timestamp > since);

        return jsonResponse({ messages: newMessages, since: Date.now() });
      }

      // ── Health check ──
      if (url.pathname === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'ok',
          nodes: tokens.size,
          queued: inbox.size,
        });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};
