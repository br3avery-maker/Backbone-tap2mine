# Backbone Tap2Mine

A decentralized blocklattice network where every user runs their own node with their own chain. No central authority, no shared ledger, no server.

## Architecture

- **Blocklattice** — Each user has a personal chain (like Nano's architecture)
- **Tap-to-Mine** — User interactions generate entropy that seeds new blocks
- **P2P** — Nodes gossip blocks directly via WebRTC (coming soon)
- **Anonymous by default** — Each chain exists in isolation until you choose to share
- **Wasm-native** — Compiled to WebAssembly, runs entirely in the browser
- **Zero install** — Open the IPFS link and start tapping
- **File ownership** — Save your node as a `.tap2mine` file, load it anywhere

## Quick Start

### Open the Site

Once deployed to IPFS, just open the link. No install, no config, no account.

### Tap to Mine

- Tap the entropy area to generate entropy
- When enough entropy accumulates, a new block is mined
- Each tap adds coordinates + timestamps to the entropy pool
- Blocks are signed with your Ed25519 key and appended to your chain

### Save Your Node

Click **💾 Save Node File** to download your entire node (keys + chain) as a `.tap2mine` file. Keep this file safe — it's your identity.

### Load Your Node

Click **📂 Load Node File** to import a `.tap2mine` file and restore your node anywhere.

### Build (for development)

```bash
cd node
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/tap2mine_node.wasm

# Generate JS bindings
wasm-bindgen target/wasm32-unknown-unknown/release/tap2mine_node.wasm \
  --out-dir ../frontend/wasm --target web
```

## Wasm API

| Function | Description |
|----------|-------------|
| `create_node()` | Create new node with keys + genesis block |
| `load_node(keystore, chain)` | Restore from IndexedDB data |
| `export_node(node)` | Serialize full node for `.tap2mine` file |
| `import_node(json)` | Load node from `.tap2mine` file content |
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
| Storage | IndexedDB (browser) + `.tap2mine` files |
| P2P | WebRTC (via web-sys) — coming soon |
| Frontend | Vite + TypeScript |
| Deploy | Static → IPFS |

## Milestones

### Complete

- [x] M1: Node Init — Key generation + genesis block in Wasm
- [x] M2: Tap Engine — Entropy collection + block production
- [x] M3: Wasm API — All functions exported via wasm-bindgen
- [x] M5: Storage — IndexedDB + .tap2mine file export/import
- [x] M6: Frontend — Static dashboard loading Wasm
- [x] M3.5: Agent Skill — MCP server + OpenClaw skill
- [x] M4: P2P Sync — WebRTC block gossip
- [x] M7: IPFS Ready — Deployable static build

## License

MIT
