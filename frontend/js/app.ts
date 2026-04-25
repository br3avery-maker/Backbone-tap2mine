// Tap2Mine Frontend — pure Wasm, anonymous chains, P2P microtransactions
import init, { create_node, load_node, export_node, import_node, parse_handshake_link, generate_handshake_link, WasmNode } from '../wasm/tap2mine_node.js';
import { WebRTCPeerManager, PeerMessage } from './webrtc';

let node: WasmNode | null = null;
let peerManager: WebRTCPeerManager | null = null;

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
  document.getElementById('chao-address')!.textContent = info.chao_address || '—';
  document.getElementById('pub-key')!.textContent = truncate(info.public_key, 20);
  document.getElementById('chain-len')!.textContent = `${info.chain_len} blocks`;
  document.getElementById('balance')!.textContent = `${info.balance_chao} $CHAO`;
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
  if (!node || !peerManager) return;
  const container = document.getElementById('peer-list')!;
  const peers = peerManager.getConnectedPeers();
  if (peers.length === 0) {
    container.innerHTML = '<p class="empty">No connected peers</p>';
    return;
  }
  container.innerHTML = peers.map(p => `
    <div class="peer-item">
      <span class="peer-id">${truncate(p.nodeId, 16)}</span>
      <span class="peer-state">${p.state}</span>
      <button class="btn btn-small btn-disconnect" data-peer="${p.nodeId}">✕</button>
    </div>
  `).join('');

  // Bind disconnect buttons
  container.querySelectorAll('.btn-disconnect').forEach(btn => {
    btn.addEventListener('click', () => {
      const peerId = (btn as HTMLElement).dataset.peer!;
      peerManager?.disconnect(peerId);
      node?.add_peer(peerId, ''); // Record disconnection
      renderPeers();
      renderNodeInfo();
    });
  });
}

function updateEntropy() {
  if (!node) return;
  const count = node.entropy_count();
  document.getElementById('tap-count')!.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  const seed = JSON.parse(node.get_entropy()) as { seed: string; ready: boolean };
  document.getElementById('entropy-seed')!.textContent = seed.seed ? truncate(seed.seed, 32) : '—';

  const progress = Math.min(100, Math.round((count / 64) * 100));
  const bar = document.getElementById('mining-progress')!;
  bar.style.width = `${progress}%`;
  if (progress >= 100) bar.classList.add('ready');
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
}

async function loadNodeFile(file: File) {
  const text = await file.text();
  try {
    node = import_node(text);
    setStatus('connected', 'loaded');
    renderAll();
    saveNode();
  } catch (e) {
    alert('Invalid .tap2mine file');
  }
}

// --- Peer Message Handler ---
function handlePeerMessage(peerId: string, message: PeerMessage) {
  if (!node) return;

  switch (message.type) {
    case 'transaction': {
      const txData = message.data as Record<string, unknown>;
      if (txData.block_type === 'send') {
        // Received a send from peer — create receive confirmation
        const result = node.receive_send(JSON.stringify(txData));
        const parsed = JSON.parse(result);
        if (parsed.error) {
          console.error('Failed to receive transaction:', parsed.error);
        } else {
          // Send acknowledgment back
          peerManager?.send(peerId, { type: 'handshake_ack', data: { received: true } });
          renderBlocks();
          renderNodeInfo();
          saveNode();
        }
      }
      break;
    }
    case 'ping':
      peerManager?.send(peerId, { type: 'pong', data: {} });
      break;
    case 'pong':
      console.log('Peer pong received');
      break;
    case 'handshake_ack':
      console.log('Peer confirmed receipt');
      break;
  }
}

// --- WebRTC Connection UI ---
function showConnectModal() {
  document.getElementById('connect-modal')!.classList.add('active');
  // Reset form
  document.getElementById('connect-mode')!.value = 'create';
  document.getElementById('connect-step')!.textContent = '1';
  showConnectStep(1);
}

function closeConnectModal() {
  document.getElementById('connect-modal')!.classList.remove('active');
}

function showConnectStep(step: number) {
  document.getElementById('connect-step')!.textContent = String(step);
  document.querySelectorAll('.connect-step').forEach(el => {
    (el as HTMLElement).style.display = 'none';
  });
  document.getElementById(`connect-step-${step}`)!.style.display = 'block';
}

async function handleCreateOffer() {
  if (!node || !peerManager) return;

  const offer = await peerManager.createOffer(node.node_id());
  document.getElementById('offer-text')!.textContent = offer;
  document.getElementById('copy-offer')!.onclick = () => {
    navigator.clipboard.writeText(offer);
    alert('Offer copied to clipboard!');
  };
  showConnectStep(2);
}

async function handleAcceptOffer() {
  if (!node || !peerManager) return;

  const offerText = (document.getElementById('answer-offer-input') as HTMLTextAreaElement).value.trim();
  if (!offerText) { alert('Paste the offer text'); return; }

  try {
    const answer = await peerManager.acceptOffer(offerText, node.node_id());
    document.getElementById('answer-text')!.textContent = answer;
    document.getElementById('copy-answer')!.onclick = () => {
      navigator.clipboard.writeText(answer);
      alert('Answer copied! Send it back to the peer.');
    };
    showConnectStep(3);
  } catch (e) {
    alert('Invalid offer: ' + (e instanceof Error ? e.message : e));
  }
}

async function handleAcceptAnswer() {
  if (!peerManager) return;

  const answerText = (document.getElementById('offer-answer-input') as HTMLTextAreaElement).value.trim();
  if (!answerText) { alert('Paste the answer text'); return; }

  try {
    await peerManager.acceptAnswer(answerText);
    showConnectStep(4);
    renderPeers();
    renderNodeInfo();
  } catch (e) {
    alert('Invalid answer: ' + (e instanceof Error ? e.message : e));
  }
}

// --- Send Value ---
function showSendModal() {
  if (!node) return;
  document.getElementById('send-modal')!.classList.add('active');
  document.getElementById('max-send')!.textContent = `Max: ${node.get_balance()} $CHAO`;

  // Populate peer dropdown
  const select = document.getElementById('send-to-peer') as HTMLSelectElement;
  if (peerManager) {
    const peers = peerManager.getConnectedPeers();
    select.innerHTML = peers.length === 0
      ? '<option value="">No connected peers</option>'
      : peers.map(p => `<option value="${p.nodeId}">${truncate(p.nodeId, 20)} (${p.chaoAddress || p.public_key ? '✓' : '?'})</option>`).join('');
  }
}

function closeSendModal() {
  document.getElementById('send-modal')!.classList.remove('active');
}

function handleSend() {
  if (!node || !peerManager) return;
  const toPeerId = (document.getElementById('send-to-peer') as HTMLSelectElement).value;
  const amount = parseInt((document.getElementById('send-amount') as HTMLInputElement).value, 10);

  if (!toPeerId || !amount || amount <= 0) {
    alert('Please select a peer and enter a valid amount.');
    return;
  }

  const peer = peerManager.getPeer(toPeerId);
  if (!peer) {
    alert('Peer not found');
    return;
  }

  const result = JSON.parse(node.create_send(toPeerId, peer.publicKey || '', amount));
  if (result.error) {
    alert('Send failed: ' + result.error);
    return;
  }

  // Send the block over WebRTC
  const sent = peerManager.send(toPeerId, {
    type: 'transaction',
    data: result,
  });

  renderBlocks();
  renderNodeInfo();
  saveNode();
  closeSendModal();

  if (sent) {
    alert(`Sent ${amount} $CHAO to ${truncate(toPeerId, 16)}. Awaiting confirmation...`);
  } else {
    alert(`Block created but peer is disconnected. Transaction saved to your chain.`);
  }
}

// --- Helper ---
function renderAll() {
  renderNodeInfo();
  renderBlocks();
  renderPeers();
  updateEntropy();
}

// --- Init ---
async function main() {
  setStatus('loading', 'loading wasm…');
  try {
    await init();
    const stored = await loadStoredNode();
    if (stored) { node = stored; setStatus('connected', 'restored'); }
    else { node = create_node(); setStatus('connected', 'new node'); saveNode(); }

    // Initialize WebRTC peer manager
    peerManager = new WebRTCPeerManager(handlePeerMessage);

    renderAll();
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

document.getElementById('refresh-chain')!.addEventListener('click', renderAll);
document.getElementById('save-node')!.addEventListener('click', saveNodeFile);
document.getElementById('load-node')!.addEventListener('change', e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) loadNodeFile(f); });

// P2P events
document.getElementById('show-connect')!.addEventListener('click', showConnectModal);
document.getElementById('close-connect')!.addEventListener('click', closeConnectModal);
document.getElementById('create-offer-btn')!.addEventListener('click', handleCreateOffer);
document.getElementById('accept-offer-btn')!.addEventListener('click', handleAcceptOffer);
document.getElementById('accept-answer-btn')!.addEventListener('click', handleAcceptAnswer);
document.getElementById('close-connect-final')!.addEventListener('click', closeConnectModal);

// Mode switch in connect modal
document.getElementById('connect-mode')!.addEventListener('change', e => {
  const mode = (e.target as HTMLSelectElement).value;
  if (mode === 'create') {
    showConnectStep(1);
  } else {
    showConnectStep(2);
  }
});

document.getElementById('show-send')!.addEventListener('click', showSendModal);
document.getElementById('close-send')!.addEventListener('click', closeSendModal);
document.getElementById('confirm-send')!.addEventListener('click', handleSend);

// Auto-detect handshake links in URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('pk') && urlParams.has('id')) {
  setTimeout(() => {
    showConnectModal();
    showConnectStep(2);
    (document.getElementById('connect-mode') as HTMLSelectElement).value = 'answer';
    showConnectStep(2);
  }, 2000);
}

main();
