const RPC_URL = "http://localhost:8765/rpc";

let tapCount = 0;
let nodeInfo: NodeInfo | null = null;

interface NodeInfo {
  node_id: string;
  public_key: string;
  chain_len: number;
  genesis: string;
  latest_hash: string;
}

interface Block {
  sequence: number;
  prev_hash: string;
  hash: string;
  timestamp: number;
  signature: string;
  tx_set: Array<unknown>;
  seed: string;
  node_id: string;
}

async function rpc(method: string, params: Record<string, unknown> = {}) {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    return data.result;
  } catch (err) {
    setStatus(false);
    throw err;
  }
}

function setStatus(connected: boolean) {
  const el = document.getElementById("status")!;
  el.textContent = connected ? "connected" : "disconnected";
  el.className = `status ${connected ? "connected" : "disconnected"}`;
}

async function loadNodeInfo() {
  try {
    nodeInfo = await rpc("NodeInfo") as NodeInfo;
    document.getElementById("node-id")!.textContent = truncate(nodeInfo.node_id);
    document.getElementById("chain-len")!.textContent = `${nodeInfo.chain_len} blocks`;
    document.getElementById("genesis-hash")!.textContent = truncate(nodeInfo.genesis);
    document.getElementById("latest-hash")!.textContent = truncate(nodeInfo.latest_hash);
    setStatus(true);
  } catch {
    document.getElementById("node-id")!.textContent = "—";
    document.getElementById("chain-len")!.textContent = "—";
    document.getElementById("genesis-hash")!.textContent = "—";
    document.getElementById("latest-hash")!.textContent = "—";
  }
}

async function loadChain() {
  try {
    const blocks = await rpc("GetChain", { start: 0, limit: 50 }) as Block[];
    renderBlocks(blocks);
  } catch {
    // Node might not be running
  }
}

function renderBlocks(blocks: Block[]) {
  const container = document.getElementById("blocks")!;

  if (blocks.length === 0) {
    container.innerHTML = '<p class="empty">No blocks yet</p>';
    return;
  }

  container.innerHTML = blocks
    .reverse()
    .map((b) => {
      const time = new Date(b.timestamp).toLocaleTimeString();
      const isGenesis = b.sequence === 0;
      return `
        <div class="block-item">
          <span class="seq">#${b.sequence}</span>
          ${isGenesis ? ' <span class="genesis-badge">genesis</span>' : ''}
          <div class="hash">${truncate(b.hash, 32)}</div>
          <div class="time">${time}${b.seed ? ` · seed: ${truncate(b.seed, 16)}` : ""}</div>
        </div>
      `;
    })
    .join("");
}

function truncate(str: string, len = 12): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + "…";
}

// Tap interaction
const tapArea = document.getElementById("tap-area")!;

tapArea.addEventListener("click", () => {
  tapCount++;
  document.getElementById("tap-count")!.textContent = `${tapCount} tap${tapCount !== 1 ? "s" : ""}`;

  // Visual feedback
  tapArea.style.borderColor = "var(--accent)";
  tapArea.style.boxShadow = "0 0 30px var(--accent-glow)";
  setTimeout(() => {
    tapArea.style.borderColor = "";
    tapArea.style.boxShadow = "";
  }, 200);

  // Add entropy event to the node
  addEntropyEvent(tapCount);
});

async function addEntropyEvent(count: number) {
  try {
    const seed = await rpc("GetEntropySeed") as { seed: string; ready: boolean };
    document.getElementById("entropy-seed")!.textContent = seed.seed ? truncate(seed.seed, 32) : "—";
  } catch {
    // Node not running
  }
}

// Initialize
document.getElementById("refresh-chain")!.addEventListener("click", () => {
  loadNodeInfo();
  loadChain();
});

// Auto-refresh every 5 seconds
setInterval(() => {
  loadNodeInfo();
  loadChain();
}, 5000);

// Initial load
loadNodeInfo();
loadChain();
