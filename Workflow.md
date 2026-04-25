# Backbone Tap2Mine — Core Workflow

## Architecture

- **Blocklattice** — every user runs their own node with their own chain. No central authority, no shared ledger, no server.
- **Pure Wasm** — the entire node runs in the browser via WebAssembly. Zero install, zero backend.
- **Anonymous by default** — each chain exists in isolation until the user chooses to share it.
- **Static site on IPFS** — HTML/CSS/JS + `.wasm` file, deployable to IPFS, GitHub Pages, any CDN.
- **File ownership** — users save their node as a `.tap2mine` file. Load it anywhere, anytime.
- **P2P gossip** — nodes communicate directly (WebRTC), no bootstrap or relay server (coming soon)

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Node | Rust → WebAssembly (wasm32-unknown-unknown) |
| Crypto | Ed25519 (ed25519-dalek), SHA-256 (sha2) |
| Storage | IndexedDB (automatic) + `.tap2mine` files (manual backup) |
| P2P | WebRTC DataChannels (via web-sys) — coming soon |
| API | Direct JS ↔ Wasm function calls |
| Frontend | Vite + TypeScript + vanilla JS |
| Deploy | Static build → IPFS |

---

## Phase 1: Identity & Genesis

### Step 1: Key Generation
On first load, the Wasm node generates:
- Ed25519 keypair (public key = node identity, private key = signing authority)
- UUID node identifier
- Auto-saved to IndexedDB
- **User owns it:** export as `.tap2mine` file at any time

### Step 2: Genesis Block
Create the root of the user's personal blocklattice chain:
```json
{
  "sequence": 0,
  "prev_hash": "",
  "timestamp": "<unix_ms>",
  "signature": "<ed25519_sig>",
  "tx_set": [],
  "seed": "genesis"
}
```

---

## Phase 2: Tap-to-Mine (Entropy Engine)

### Step 3: Touch/Event Capture
User interactions (tap, click, mouse move, scroll) feed directly into the entropy pool:
- Coordinates, timestamps collected
- Buffer size: ~1024 events (FIFO)
- Derive `block_seed` via SHA-256 of accumulated entropy

### Step 4: Block Production
When entropy threshold is reached (≥ 64 events):
- Build block: `{ prev_hash, sequence, signature, timestamp, tx_set, seed }`
- Sign with Ed25519 private key (inside Wasm)
- Append to blocklattice chain in memory → sync to IndexedDB
- Increment sequence

---

## Phase 3: Wasm API (Direct JS ↔ Rust)

### Step 5: Wasm Export Functions
The compiled `.wasm` module exports these functions directly to JavaScript:
- `create_node()` — generate keys + genesis block
- `load_node(keystore_json, chain_json)` — restore from IndexedDB
- `export_node(node)` — serialize full node for `.tap2mine` file
- `import_node(data_json)` — load node from `.tap2mine` file content
- `node.info()` → JSON — node status, chain length
- `node.get_chain(start, limit)` → JSON — read blocks
- `node.add_tap(x, y)` — feed entropy from UI events
- `node.try_mine()` → JSON — produce block if entropy ready
- `node.get_entropy()` → JSON — current seed status
- `node.export_keystore()` → JSON — backup
- `node.verify_block(block_json)` → bool — validate signature

No HTTP, no JSON-RPC server. Direct function calls between JS and Wasm.

---

## Phase 4: P2P Gossip & Sync

### Step 6: Peer Discovery
- WebRTC DataChannels via web-sys bindings
- STUN: public STUN servers for NAT traversal
- Signaling: out-of-band (QR code, link share, manual SDP exchange)

### Step 7: Block Gossip
- Broadcast new blocks to connected peers
- Receive blocks, validate (Ed25519 signature + prev_hash chain + sequence), merge
- Maintain healing log of all observed blocks for reverse sync

### Step 8: Validation
Each incoming block is validated inside Wasm:
- Signature verified against claimed public key
- `prev_hash` chains correctly
- Sequence is monotonically increasing
- No double-spends
- Invalid blocks rejected

---

## Phase 4.5: Agent Skill & LLM API

### Step 9: MCP Server
Expose the node's functions as **MCP (Model Context Protocol)** tools:
- `get_node_info` — node status, chain length
- `get_chain` — read blocks with pagination
- `get_balance` — current balance (placeholder)
- `get_peers` — connected peers (placeholder)
- `get_entropy_seed` — current tap-derived seed
- `export_keystore` — backup
- `import_keystore` — restore

### Step 10: OpenClaw / Agent Skill
Package as an agent skill for the LLM hackathon.

---

## Phase 5: Frontend (Static Site)

### Step 11: Web Dashboard
The static web app loads the `.wasm` module and provides:
- **Chain explorer** — visualize your blocklattice
- **Tap-to-mine visualizer** — show entropy accumulation in real-time
- **Peer status** — connected peers, sync progress (coming)
- **Transaction sender** — compose and sign transactions (coming)
- **Node file management** — save/load `.tap2mine` files
- **Node info** — uptime, block count, chain health

All interactions are direct JS → Wasm function calls. No HTTP server needed.

Built with Vite + TypeScript, output is pure static files → deployable to IPFS.

---

## File Format: `.tap2mine`

```json
{
  "version": 1,
  "keystore": {
    "node_id": "uuid",
    "public_key": "hex...",
    "secret_key": "hex..."
  },
  "chain": [
    { "sequence": 0, "prev_hash": "", "hash": "...", "timestamp": 0, "signature": "...", "tx_set": [], "seed": "genesis", "node_id": "uuid" }
  ]
}
```

A single file containing the user's complete node identity and chain. Portable, self-contained, fully owned by the user.

---

## Build

```bash
cd node
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/tap2mine_node.wasm (~310KB)

# Generate JS bindings
wasm-bindgen target/wasm32-unknown-unknown/release/tap2mine_node.wasm \
  --out-dir ../frontend/wasm --target web
```

---

## Milestones

| # | Milestone | Status | Done when... |
|---|-----------|--------|-------------|
| M1 | Node Init | ✅ | Wasm `create_node()` generates keys + genesis |
| M2 | Tap Engine | ✅ | `add_tap()` → entropy → `try_mine()` produces blocks |
| M3 | Wasm API | ✅ | All functions exported via wasm-bindgen |
| M3.5 | Agent Skill | ⏳ | MCP tool definitions + OpenClaw skill |
| M4 | P2P Sync | ⏳ | Two browser nodes sync blocks over WebRTC |
| M5 | Storage | ✅ | IndexedDB auto-save + `.tap2mine` file export/import |
| M6 | Frontend | ✅ | Static site loads Wasm, shows chain + tap activity |
| M7 | IPFS Ready | ⏳ | `npm run build` produces deployable static output |
