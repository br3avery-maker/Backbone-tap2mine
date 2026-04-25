# Backbone Tap2Mine — Core Workflow

## Architecture

- **Blocklattice** — every user runs their own node with their own chain. No central authority, no shared ledger, no server.
- **Dual-target Rust** — same core code compiles to both WebAssembly (browser UI) and native binary (persistent node).
- **Static site on IPFS** — the Wasm-powered frontend is a static site: HTML/CSS/JS + `.wasm` file, deployable to IPFS, GitHub Pages, any CDN.
- **Native node** — a CLI binary that stores keys and blockchain on the user's filesystem. Fully owned by the user. Exposes localhost JSON-RPC API that the Wasm frontend can talk to.
- **P2P gossip** — nodes communicate directly (WebRTC), no bootstrap or relay server

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Core | Rust — shared between all targets |
| Wasm target | wasm32-unknown-unknown → `.wasm` for browser |
| Native target | x86_64/aarch64 → CLI binary with filesystem + HTTP |
| Crypto | Ed25519 (ed25519-dalek), SHA-256 (sha2) |
| Wasm storage | IndexedDB via web-sys |
| Native storage | Filesystem (`~/.tap2mine/`) |
| P2P | WebRTC DataChannels (via web-sys for Wasm, native for binary) |
| Wasm API | Direct JS ↔ Wasm function calls |
| Native API | JSON-RPC over HTTP (localhost only) |

---

## Phase 1: Identity & Genesis

### Step 1: Key Generation
On first load/run, the node generates:
- Ed25519 keypair (public key = node identity, private key = signing authority)
- UUID node identifier
- **Wasm:** Keystore persisted to IndexedDB
- **Native:** Keystore saved to `~/.tap2mine/keystore.json`

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
When entropy threshold is reached (>= 64 events):
- Build block: `{ prev_hash, sequence, signature, timestamp, tx_set, seed }`
- Sign with Ed25519 private key
- Append to blocklattice chain
- Increment sequence

---

## Phase 3: Dual-Target API

### Step 5: Wasm API (Browser)
The compiled `.wasm` module exports directly to JavaScript:
- `create_node()` — generate keys + genesis block
- `load_node(keystore_json, chain_json)` — restore from IndexedDB
- `node.info()` → JSON — node status, chain length
- `node.get_chain(start, limit)` → JSON — read blocks
- `node.add_tap(x, y)` — feed entropy from UI events
- `node.try_mine()` → JSON — produce block if entropy ready
- `node.get_entropy()` → JSON — current seed status
- `node.export_keystore()` → JSON — backup
- `node.verify_block(block_json)` → bool — validate signature

### Step 6: Native CLI (Filesystem)
```bash
tap2mine init              # Generate keys + genesis, save to disk
tap2mine serve --port 8765 # Start JSON-RPC API on localhost
tap2mine info              # Show node status
tap2mine tap               # Tap-to-mine mode (Enter to simulate)
tap2mine reset             # Delete all node data
```

The native binary stores data in `~/.tap2mine/`:
- `keystore.json` — Ed25519 keypair + node ID
- `chain.json` — full blocklattice chain

---

## Phase 4: P2P Gossip & Sync

### Step 7: Peer Discovery
- WebRTC DataChannels for direct peer-to-peer connections
- STUN: public STUN servers for NAT traversal
- No central signaling server — peers exchange offers out-of-band

### Step 8: Block Gossip & Validation
- Broadcast new blocks to connected peers
- Receive blocks, validate (Ed25519 signature + prev_hash chain + sequence)
- Maintain healing log of all observed blocks for reverse sync

---

## Phase 4.5: Agent Skill & LLM API

### Step 9: MCP Server
Expose the node's functions as **MCP (Model Context Protocol)** tools for LLM agents:
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
- **Peer status** — connected peers, sync progress
- **Transaction sender** — compose and sign transactions
- **Keystore management** — export/import/backup
- **Node info** — uptime, block count, chain health

All interactions are direct JS → Wasm function calls. No HTTP server needed.

Built with Vite + TypeScript, output is pure static files → deployable to IPFS.

---

## Build

```bash
# Wasm module (for browser)
cd node
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/tap2mine_node.wasm (~300KB)

# Generate JS bindings
wasm-bindgen target/wasm32-unknown-unknown/release/tap2mine_node.wasm \
  --out-dir ../frontend/wasm --target web

# Native binary (for persistent node)
cargo build --features native --release
# Output: target/release/tap2mine
```

---

## Milestones

| # | Milestone | Status | Done when... |
|---|-----------|--------|-------------|
| M1 | Node Init | ✅ | Wasm + native both generate keys + genesis |
| M2 | Tap Engine | ✅ | `add_tap()` → entropy → `try_mine()` produces blocks |
| M3 | Wasm API | ✅ | All functions exported via wasm-bindgen |
| M3.1 | Native Binary | ✅ | `tap2mine init/serve/info/tap` CLI with filesystem |
| M3.5 | Agent Skill | ⏳ | MCP tool definitions + OpenClaw skill |
| M4 | P2P Sync | ⏳ | Two nodes sync blocks over WebRTC |
| M5 | Storage | ✅ | Wasm→IndexedDB, Native→filesystem |
| M6 | Frontend | ✅ | Static site loads Wasm, shows chain + tap |
| M7 | IPFS Ready | ⏳ | `npm run build` produces deployable static output |
