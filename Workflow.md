# Backbone Tap2Mine — Core Workflow

## Architecture

- **Blocklattice** — every user runs their own node with their own chain. No central authority, no shared ledger, no server.
- **Browser-native** — the node is compiled to WebAssembly and runs entirely in the browser. No install, no CLI, no local server.
- **P2P gossip** — nodes communicate directly (WebRTC), no bootstrap or relay server
- **Static site on IPFS** — a single `.wasm` file + static HTML/CSS/JS, deployable to IPFS, GitHub Pages, any CDN

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Node runtime | Rust → WebAssembly (wasm32-unknown-unknown) |
| Crypto | Ed25519 (ed25519-dalek), SHA-256 (sha2) |
| Local storage | IndexedDB via web-sys |
| P2P | WebRTC DataChannels (via web-sys) |
| API | Direct JS ↔ Wasm function calls (no HTTP needed) |
| Agent Interface | MCP server via `wasm-bindgen` exports |
| Frontend | Vite + TypeScript + vanilla JS/React |
| Build | `cargo build --target wasm32-unknown-unknown` |
| Deploy | Static build → IPFS |

---

## Phase 1: Identity & Genesis

### Step 1: Key Generation
On first load, the Wasm node generates:
- Ed25519 keypair (public key = node identity, private key = signing authority)
- UUID node identifier
- Keystore persisted to IndexedDB

**Artifacts:** `Keystore` (Wasm struct), stored in IndexedDB

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

**Artifact:** Genesis block appended to in-memory chain, synced to IndexedDB

---

## Phase 2: Tap-to-Mine (Entropy Engine)

### Step 3: Touch/Event Capture
User interactions (tap, click, mouse move, scroll) feed directly into the Wasm entropy pool:
- Coordinates, timestamps passed via `wasm-bindgen` function calls
- Buffer size: ~1024 events (FIFO)
- Derive `block_seed` via SHA-256 of accumulated entropy

**Artifact:** `EntropyPool` (Wasm struct)

### Step 4: Block Production
When entropy threshold is reached (≥64 events):
- Build block: `{ prev_hash, sequence, signature, timestamp, tx_set, seed }`
- Sign with Ed25519 private key (inside Wasm)
- Append to blocklattice chain in memory → sync to IndexedDB
- Increment sequence

**Artifact:** New block persisted in IndexedDB

---

## Phase 3: Wasm API (Direct JS ↔ Rust)

### Step 5: Wasm Export Functions
The compiled `.wasm` module exports these functions directly to JavaScript:
- `create_node()` — generate keys + genesis block
- `load_node(keystore_json, chain_json)` — restore from IndexedDB
- `node.info()` → JSON — node status, chain length
- `node.get_chain(start, limit)` → JSON — read blocks
- `node.add_tap(x, y)` — feed entropy from UI events
- `node.try_mine()` → JSON — produce block if entropy ready (or empty string)
- `node.get_entropy()` → JSON — current seed status
- `node.export_keystore()` → JSON — backup
- `node.verify_block(block_json)` → bool — validate signature

No HTTP, no JSON-RPC server. Direct function calls between JS and Wasm.

**Artifact:** `node/src/api/` — Node struct with wasm-bindgen exports

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

**Artifacts:** `node/src/p2p/` — WebRTC engine, validation logic

---

## Phase 4.5: Agent Skill & LLM API

### Step 8.5: MCP Server
Expose the node's functions as **MCP (Model Context Protocol)** tools:
- `get_node_info` — node status, chain length
- `get_chain` — read blocks with pagination
- `get_balance` — current balance (placeholder)
- `get_peers` — connected peers (placeholder)
- `get_entropy_seed` — current tap-derived seed
- `export_keystore` — encrypted backup
- `import_keystore` — restore from backup

The MCP server runs as a separate Go binary that talks to the Wasm node via stdio, or as a standalone wrapper.

**Artifact:** `node/src/mcp/` — MCP tool definitions

### Step 8.6: OpenClaw / Agent Skill
Package as an agent skill for the LLM hackathon:
- SKILL.md declares available tools
- LLM agents call node operations through the Wasm API or MCP transport
- Skill config: `~/.openclaw/skills/tap2mine/SKILL.md`

**Artifact:** `node/skill/` — agent skill package

### Step 8.7: API Contract (Machine-Readable)
Publish the Wasm function signatures as an **OpenAPI spec**:
- Auto-generates client libraries in any language
- Served alongside the static site

**Artifact:** `docs/api-schema.json` — OpenAPI 3.1 spec

---

## Phase 5: Frontend (Static Site)

### Step 9: Web Dashboard
The static web app loads the `.wasm` module and provides:
- **Chain explorer** — visualize your blocklattice
- **Tap-to-mine visualizer** — show entropy accumulation in real-time
- **Peer status** — connected peers, sync progress
- **Transaction sender** — compose and sign transactions
- **Keystore management** — export/import/backup
- **Node info** — uptime, block count, chain health

All interactions are direct JS → Wasm function calls. No HTTP server needed.

Built with Vite + TypeScript, output is pure static files → deployable to IPFS.

### Step 10: UI Generation
Hand the Wasm API contract to an LLM to generate polished UI components (React widgets, dashboard layouts, animations). The API is the source of truth.

---

## Build

```bash
cd node
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/tap2mine_node.wasm
# Size: ~600KB (optimized with wasm-opt)
```

---

## Milestones

| # | Milestone | Status | Done when... |
|---|-----------|--------|-------------|
| M1 | Node Init | ✅ | Wasm `create_node()` generates keys + genesis |
| M2 | Tap Engine | ✅ | `add_tap()` → entropy → `try_mine()` produces blocks |
| M3 | Wasm API | ✅ | All functions exported via wasm-bindgen, JS ↔ Wasm working |
| M3.5 | Agent Skill | ⏳ | MCP tool definitions + OpenClaw skill |
| M4 | P2P Sync | ⏳ | Two browser tabs sync blocks over WebRTC |
| M5 | IndexedDB | ⏳ | Chain + keystore persisted to IndexedDB |
| M6 | Frontend | ⏳ | Static site loads Wasm, shows chain + tap activity |
| M7 | IPFS Ready | ⏳ | `npm run build` produces deployable static output |
