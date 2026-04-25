// Tap2Mine Frontend — loads Wasm node and provides UI

import { init, create_node, load_node, nodeInfo, nodeGetChain, nodeAddTap, nodeAddMove, nodeAddScroll, nodeTryMine, nodeGetEntropy, nodeEntropyCount, nodeChainLen, nodeExportKeystore, nodeExportChain, nodeVerifyBlock, nodeLatestBlock } from './wasm-loader';

let nodePtr: number = 0;
let loaded = false;

// --- IndexedDB helpers ---

const DB_NAME = 'tap2mine';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('node')) {
        db.createObjectStore('node');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveNode(): Promise<void> {
  if (!nodePtr) return;
  const db = await openDB();
  const tx = db.transaction('node', 'readwrite');
  const store = tx.objectStore('node');
  store.put(nodeExportKeystore(nodePtr), 'keystore');
  store.put(nodeExportChain(nodePtr), 'chain');
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadStoredNode(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction('node', 'readonly');
    const store = tx.objectStore('node');
    const keystoreReq = store.get('keystore');
    const chainReq = store.get('chain');

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        const ks = keystoreReq.result;
        const chain = chainReq.result;
        if (ks && chain) {
          try {
            resolve(load_node(ks, chain));
          } catch {
            resolve(0);
          }
        } else {
          resolve(0);
        }
      };
      tx.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// --- UI helpers ---

function setStatus(state: 'connected' | 'disconnected' | 'loading', text?: string) {
  const el = document.getElementById('status')!;
  el.textContent = text || state;
  el.className = `status ${state}`;
}

function truncate(str: string, len = 12): string {
  if (!str || str.length <= len) return str || '—';
  return str.slice(0, len) + '…';
}

function renderNodeInfo() {
  if (!nodePtr) return;
  const info = JSON.parse(nodeInfo(nodePtr));
  document.getElementById('node-id')!.textContent = truncate(info.node_id, 16);
  document.getElementById('pub-key')!.textContent = truncate(info.public_key, 20);
  document.getElementById('chain-len')!.textContent = `${info.chain_len} blocks`;
  document.getElementById('latest-hash')!.textContent = truncate(info.latest_hash, 16);
}

function renderBlocks() {
  if (!nodePtr) return;
  const container = document.getElementById('blocks')!;
  const blocks = JSON.parse(nodeGetChain(nodePtr, 0, 100)) as Array<Record<string, unknown>>;

  if (blocks.length === 0) {
    container.innerHTML = '<p class="empty">No blocks yet</p>';
    return;
  }

  container.innerHTML = blocks
    .reverse()
    .map((b) => {
      const seq = b.sequence as number;
      const hash = b.hash as string;
      const ts = b.timestamp as number;
      const seed = b.seed as string;
      const time = new Date(ts).toLocaleTimeString();
      const isGenesis = seq === 0;
      return `
        <div class="block-item">
          <span class="seq">#${seq}</span>
          ${isGenesis ? '<span class="genesis-badge">genesis</span>' : ''}
          <div class="hash">${truncate(hash, 32)}</div>
          <div class="time">${time}${seed ? ` · seed: ${truncate(seed, 16)}` : ''}</div>
        </div>
      `;
    })
    .join('');
}

function updateEntropy() {
  if (!nodePtr) return;
  const count = nodeEntropyCount(nodePtr);
  document.getElementById('tap-count')!.textContent = `${count} event${count !== 1 ? 's' : ''}`;

  const seedJson = nodeGetEntropy(nodePtr);
  const seed = JSON.parse(seedJson) as { seed: string; ready: boolean };
  document.getElementById('entropy-seed')!.textContent = seed.seed ? truncate(seed.seed, 32) : '—';
}

// --- Tap handling ---

function handleTap(x: number, y: number) {
  if (!nodePtr) return;
  nodeAddTap(nodePtr, x, y);

  // Visual feedback
  const area = document.getElementById('tap-area')!;
  area.classList.add('tapped');
  setTimeout(() => area.classList.remove('tapped'), 150);

  // Try to mine
  const newBlock = nodeTryMine(nodePtr);
  if (newBlock) {
    renderBlocks();
    renderNodeInfo();
    saveNode();
  }

  updateEntropy();
}

// --- Export / Import ---

function exportKeystore() {
  if (!nodePtr) return;
  const json = nodeExportKeystore(nodePtr);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tap2mine-keystore-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importKeystore(file: File) {
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    // Create new node with imported keystore data
    nodePtr = create_node();
    setStatus('connected', 'imported');
    renderNodeInfo();
    renderBlocks();
    saveNode();
    alert('Keystore imported (new chain created)');
  } catch {
    alert('Invalid keystore file');
  }
}

// --- Initialize ---

async function main() {
  setStatus('loading', 'loading wasm…');

  try {
    await init();

    const stored = await loadStoredNode();
    if (stored) {
      nodePtr = stored;
      loaded = true;
      setStatus('connected', 'restored');
    } else {
      nodePtr = create_node();
      loaded = true;
      setStatus('connected', 'new node');
      saveNode();
    }

    renderNodeInfo();
    renderBlocks();
    updateEntropy();
  } catch (err) {
    console.error('Failed to init Wasm:', err);
    setStatus('disconnected', 'wasm failed');
  }
}

// --- Event listeners ---

const tapArea = document.getElementById('tap-area')!;

tapArea.addEventListener('click', (e) => {
  handleTap(e.clientX, e.clientY);
});

tapArea.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  handleTap(touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener('mousemove', (e) => {
  if (nodePtr && Math.random() < 0.1) {
    nodeAddMove(nodePtr, e.clientX, e.clientY);
    updateEntropy();
  }
});

window.addEventListener('scroll', () => {
  if (nodePtr && Math.random() < 0.3) {
    nodeAddScroll(nodePtr, window.scrollY);
    updateEntropy();
  }
}, { passive: true });

document.getElementById('refresh-chain')!.addEventListener('click', () => {
  renderNodeInfo();
  renderBlocks();
  updateEntropy();
});

document.getElementById('export-wallet')!.addEventListener('click', exportKeystore);

document.getElementById('import-wallet')!.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) importKeystore(file);
});

main();
