// Tap2Mine Frontend — pure Wasm, anonymous chains, P2P microtransactions
import init, { create_node, load_node, export_node, import_node, parse_handshake_link, generate_handshake_link, WasmNode } from '../wasm/tap2mine_node.js';

let node: WasmNode | null = null;

// --- IndexedDB helpers ---
const DB_NAME = 'tap2mine';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('node')) {
        req.result.createObjectStore('node');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNode(): Promise<void> {
  if (!node) return;
  const db = await openDB();
  const tx = db.transaction('node', 'readwrite');
  const store = tx.objectStore('node');
  store.put(export_node(node), 'full');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadStoredNode(): Promise<WasmNode | null> {
  try {
    const db = await openDB();
    const tx = db.transaction('node', 'readonly');
    const store = tx.objectStore('node');
    const req = store.get('full');
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (req.result) {
          try { resolve(import_node(req.result)); }
          catch { resolve(null); }
        } else { resolve(null); }
      };
      tx.onerror = () => resolve(null);
    });
  } catch { return null; }
}

// --- UI helpers ---
function setStatus(state: 'connected'|'disconnected'|'loading', text?: string) {
  const el = document.getElementById('status')!;
  el.textContent = text || state;
  el.className = `status ${state}`;
}

function truncate(s: string, len = 12): string {
  return (s && s.length > len) ? s.slice(0, len) + '…' : (s || '—');
}

function renderNodeInfo() {
  if (!node) return;
  const info = JSON.parse(node.info());
  document.getElementById('node-id')!.textContent = truncate(info.node_id, 16);
  document.getElementById('pub-key')!.textContent = truncate(info.public_key, 20);
  document.getElementById('chain-len')!.textContent = `${info.chain_len} blocks`;
  document.getElementById('latest-hash')!.textContent = truncate(info.latest_hash, 16);
  document.getElementById('balance')!.textContent = `${info.balance_chao} $CHAO`;
  document.getElementById('chao-address')!.textContent = info.chao_address || '—';
  document.getElementById('peers-count')!.textContent = `${info.peers} connected`;
}

function renderBlocks() {
  if (!node) return;
  const container = document.getElementById('blocks')!;
  const blocks = JSON.parse(node.get_chain(0, 100)) as Array<Record<string, unknown>>;
  if (blocks.length === 0) {
    container.innerHTML = '<p class="empty">No blocks yet</p>';
    return;
  }
  container.innerHTML = blocks.reverse().map(b => {
    const seq = b.sequence as number;
    const hash = b.hash as string;
    const ts = b.timestamp as number;
    const seed = b.seed as string;
    const type = b.block_type as string || 'mine';
    const time = new Date(ts).toLocaleTimeString();
    const typeLabels: Record<string, string> = {
      mine: '⛏ mine',
      send: '📤 send',
      receive: '📥 receive',
      handshake: '🤝 handshake'
    };
    return `<div class="block-item block-${type}">
      <span class="seq">#${seq}</span>
      <span class="block-type">${typeLabels[type] || type}</span>
      ${seq === 0 ? '<span class="genesis-badge">genesis</span>' : ''}
      <div class="hash">${truncate(hash, 32)}</div>
      <div class="time">${time}${seed ? ` · seed: ${truncate(seed, 16)}` : ''}</div>
    </div>`;
  }).join('');
}

function renderPeers() {
  if (!node) return;
  const container = document.getElementById('peer-list')!;
  const peers = JSON.parse(node.get_peers()) as Array<Record<string, string>>;
  if (peers.length === 0) {
    container.innerHTML = '<p class="empty">No peers yet. Share your handshake link to connect.</p>';
    return;
  }
  container.innerHTML = peers.map(p => `
    <div class="peer-item">
      <span class="peer-id">${truncate(p.node_id, 16)}</span>
      <span class="peer-key">${truncate(p.public_key, 12)}</span>
    </div>
  `).join('');
}

function updateEntropy() {
  if (!node) return;
  const count = node.entropy_count();
  document.getElementById('tap-count')!.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  const seed = JSON.parse(node.get_entropy()) as { seed: string; ready: boolean };
  document.getElementById('entropy-seed')!.textContent = seed.seed ? truncate(seed.seed, 32) : '—';

  // Update mining progress bar
  const progress = Math.min(100, Math.round((count / 64) * 100));
  const bar = document.getElementById('mining-progress')!;
  bar.style.width = `${progress}%`;
  if (progress >= 100) {
    bar.classList.add('ready');
  }
}

// --- Tap handling ---
function handleTap(x: number, y: number) {
  if (!node) return;
  node.add_tap(x, y);
  const area = document.getElementById('tap-area')!;
  area.classList.add('tapped');
  setTimeout(() => area.classList.remove('tapped'), 150);

  const block = node.try_mine();
  if (block) {
    renderBlocks();
    renderNodeInfo();
    saveNode();
  }
  updateEntropy();
}

// --- File export/import ---
function saveNodeFile() {
  if (!node) return;
  const json = export_node(node);
  const blob = new Blob([json], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tap2mine-node-${Date.now()}.tap2mine`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadNodeFile(file: File) {
  const text = await file.text();
  try {
    node = import_node(text);
    setStatus('connected', 'loaded');
    renderNodeInfo(); renderBlocks(); updateEntropy(); renderPeers();
    saveNode();
  } catch (e) {
    alert('Invalid .tap2mine file: ' + (e instanceof Error ? e.message : e));
  }
}

// --- Handshake / P2P ---
function showHandshakeQR() {
  if (!node) return;
  const link = generate_handshake_link(node.node_id(), node.public_key());
  document.getElementById('handshake-link')!.textContent = link;
  document.getElementById('handshake-modal')!.classList.add('active');
}

function closeHandshakeModal() {
  document.getElementById('handshake-modal')!.classList.remove('active');
}

function handleHandshakeLink() {
  if (!node) return;
  const input = (document.getElementById('handshake-input') as HTMLInputElement).value.trim();
  if (!input) return;

  const parsed = JSON.parse(parse_handshake_link(input)) as Record<string, string>;
  if (parsed.error) {
    alert('Invalid handshake link: ' + parsed.error);
    return;
  }

  node.add_peer(parsed.id, parsed.pk);
  renderNodeInfo();
  renderPeers();
  saveNode();
  closeHandshakeModal();
  alert('Peer added! You can now send and receive microtransactions.');
}

// --- Send Value ---
function showSendModal() {
  if (!node) return;
  document.getElementById('send-modal')!.classList.add('active');
  document.getElementById('max-send')!.textContent = `Max: ${node.get_balance()} $CHAO`;
}

function closeSendModal() {
  document.getElementById('send-modal')!.classList.remove('active');
}

function handleSend() {
  if (!node) return;
  const toNodeId = (document.getElementById('send-to') as HTMLInputElement).value.trim();
  const toPubkey = (document.getElementById('send-pubkey') as HTMLInputElement).value.trim();
  const amount = parseInt((document.getElementById('send-amount') as HTMLInputElement).value, 10);

  if (!toNodeId || !toPubkey || !amount || amount <= 0) {
    alert('Please fill in all fields with valid values.');
    return;
  }

  const result = JSON.parse(node.create_send(toNodeId, toPubkey, amount));
  if (result.error) {
    alert('Send failed: ' + result.error);
    return;
  }

  renderBlocks();
  renderNodeInfo();
  saveNode();
  closeSendModal();
  alert(`Sent ${amount} $CHAO to ${truncate(toNodeId, 16)}. Waiting for confirmation...`);
}

// --- Init ---
async function main() {
  setStatus('loading', 'loading wasm…');
  try {
    await init();
    const stored = await loadStoredNode();
    if (stored) { node = stored; setStatus('connected', 'restored'); }
    else { node = create_node(); setStatus('connected', 'new node'); saveNode(); }
    renderNodeInfo(); renderBlocks(); updateEntropy(); renderPeers();
  } catch (e) {
    console.error('Wasm init failed:', e);
    setStatus('disconnected', 'wasm failed');
  }
}

// --- Events ---
const tapArea = document.getElementById('tap-area')!;
tapArea.addEventListener('click', e => handleTap(e.clientX, e.clientY));
tapArea.addEventListener('touchstart', e => { e.preventDefault(); handleTap(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
document.addEventListener('mousemove', e => { if (node && Math.random() < 0.1) { node.add_move(e.clientX, e.clientY); updateEntropy(); } });
window.addEventListener('scroll', () => { if (node && Math.random() < 0.3) { node.add_scroll(window.scrollY); updateEntropy(); } }, { passive: true });
document.getElementById('refresh-chain')!.addEventListener('click', () => { renderNodeInfo(); renderBlocks(); updateEntropy(); renderPeers(); });
document.getElementById('save-node')!.addEventListener('click', saveNodeFile);
document.getElementById('load-node')!.addEventListener('change', e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) loadNodeFile(f); });

// P2P events
document.getElementById('show-handshake')!.addEventListener('click', showHandshakeQR);
document.getElementById('close-handshake')!.addEventListener('click', closeHandshakeModal);
document.getElementById('accept-handshake')!.addEventListener('click', handleHandshakeLink);
document.getElementById('show-send')!.addEventListener('click', showSendModal);
document.getElementById('close-send')!.addEventListener('click', closeSendModal);
document.getElementById('confirm-send')!.addEventListener('click', handleSend);

// Check for handshake link in URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('pk') && urlParams.has('id')) {
  const link = `tap2mine://peer?pk=${urlParams.get('pk')}&id=${urlParams.get('id')}`;
  setTimeout(() => {
    (document.getElementById('handshake-input') as HTMLInputElement).value = link;
    showHandshakeQR();
  }, 2000);
}

main();
