// Tap2Mine Frontend — loads Wasm node and provides UI
import init, { create_node, load_node, WasmNode } from '../wasm/tap2mine_node.js';

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
  store.put(node.export_keystore(), 'keystore');
  store.put(node.export_chain(), 'chain');
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
    const ksReq = store.get('keystore');
    const chReq = store.get('chain');
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (ksReq.result && chReq.result) {
          try { resolve(load_node(ksReq.result, chReq.result)); }
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
    return `<div class="block-item">
      <span class="seq">#${seq}</span>
      ${seq === 0 ? '<span class="genesis-badge">genesis</span>' : ''}
      <div class="hash">${truncate(hash, 32)}</div>
      <div class="time">${new Date(ts).toLocaleTimeString()}${seed ? ` · seed: ${truncate(seed, 16)}` : ''}</div>
    </div>`;
  }).join('');
}

function updateEntropy() {
  if (!node) return;
  const count = node.entropy_count();
  document.getElementById('tap-count')!.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  const seed = JSON.parse(node.get_entropy()) as { seed: string; ready: boolean };
  document.getElementById('entropy-seed')!.textContent = seed.seed ? truncate(seed.seed, 32) : '—';
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

// --- Export / Import ---
function exportKeystore() {
  if (!node) return;
  const blob = new Blob([node.export_keystore()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tap2mine-keystore-${Date.now()}.json`;
  a.click();
}

async function importKeystore(file: File) {
  const text = await file.text();
  try {
    node = create_node();
    setStatus('connected', 'imported');
    renderNodeInfo(); renderBlocks(); saveNode();
    alert('Keystore imported (new chain)');
  } catch { alert('Invalid keystore file'); }
}

// --- Init ---
async function main() {
  setStatus('loading', 'loading wasm…');
  try {
    await init();
    const stored = await loadStoredNode();
    if (stored) { node = stored; setStatus('connected', 'restored'); }
    else { node = create_node(); setStatus('connected', 'new node'); saveNode(); }
    renderNodeInfo(); renderBlocks(); updateEntropy();
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
document.getElementById('refresh-chain')!.addEventListener('click', () => { renderNodeInfo(); renderBlocks(); updateEntropy(); });
document.getElementById('export-wallet')!.addEventListener('click', exportKeystore);
document.getElementById('import-wallet')!.addEventListener('change', e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) importKeystore(f); });

main();
