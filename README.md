# Backbone Tap2Mine

A decentralized blocklattice network where every user runs their own node with their own chain. No central authority, no shared ledger, no server.

## Architecture

- **Blocklattice** — Each user has a personal chain (like Nano's architecture)
- **Tap-to-Mine** — User interactions generate entropy that seeds new blocks
- **P2P** — Nodes gossip blocks directly via WebRTC (coming soon)
- **Local-first** — All state lives in the browser (IndexedDB)
- **Wasm-native** — Compiled to WebAssembly, runs entirely in the browser
- **LLM-ready** — MCP server for AI agent integration

## Quick Start

### Build the Wasm Module

```bash
cd node
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/tap2mine_node.wasm (~600KB)
```

### Use in the Browser

```javascript
import init, { create_node, load_node } from './tap2mine_node.js';

await init();

// Create a new node (generates keys + genesis block)
const node = create_node();

// Check node info
console.log(JSON.parse(node.info()));

// Feed tap entropy
node.add_tap(event.clientX, event.clientY);

// Try to mine a block (returns block JSON if enough entropy)
const newBlock = node.try_mine();
if (newBlock) console.log('New block:', JSON.parse(newBlock));
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Static output → IPFS
```

## Wasm API

| Function | Description |
|----------|-------------|
| `create_node()` | Create new node with keys + genesis block |
| `load_node(keystore, chain)` | Restore node from saved data |
| `node.info()` | Node status and chain info (JSON) |
| `node.get_chain(start, limit)` | Read blocks with pagination (JSON array) |
| `node.add_tap(x, y)` | Feed tap entropy |
| `node.add_move(x, y)` | Feed mouse move entropy |
| `node.add_scroll(delta)` | Feed scroll entropy |
| `node.try_mine()` | Produce block if entropy ready (JSON or empty) |
| `node.get_entropy()` | Current seed status (JSON) |
| `node.export_keystore()` | Backup keystore (JSON) |
| `node.verify_block(json)` | Validate block signature (bool) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Node | Rust → WebAssembly |
| Crypto | Ed25519 (ed25519-dalek), SHA-256 |
| Storage | IndexedDB (browser) |
| P2P | WebRTC (via web-sys) |
| Frontend | Vite + TypeScript |
| Deploy | Static → IPFS |

## Milestones

- [x] M1: Node Init — Key generation + genesis block in Wasm
- [x] M2: Tap Engine — Entropy collection + block production
- [x] M3: Wasm API — All functions exported via wasm-bindgen
- [ ] M3.5: Agent Skill — MCP server + OpenClaw skill
- [ ] M4: P2P Sync — WebRTC block gossip
- [ ] M5: IndexedDB — Persistent storage
- [ ] M6: Frontend — Static dashboard loading Wasm
- [ ] M7: IPFS Ready — Deployable static build

## License

MIT
