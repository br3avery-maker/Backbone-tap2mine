# Backbone Tap2Mine — Core Workflow

## Architecture

- **Blocklattice** — every user runs their own node with their own chain. No central authority, no shared ledger, no server.
- **Local-first** — keys, blockchain data, and node state live on the user's machine (filesystem)
- **P2P gossip** — nodes communicate directly (WebRTC / libp2p), no bootstrap or relay server
- **Static UI on IPFS** — the frontend is a static web app distributed via IPFS that talks to the user's local node via localhost JSON-RPC

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Node runtime | Go (single binary, easy distribution) |
| Crypto | Ed25519 (signing), SHA-256 (hashing) |
| Local storage | Filesystem + BadgerDB or BoltDB (embedded, no external deps) |
| P2P | WebRTC DataChannels or libp2p |
| API | JSON-RPC over HTTP (localhost only) |
| Frontend | Vite + TypeScript + vanilla JS/React |
| Deploy | Static build → IPFS |

---

## Phase 1: Identity & Genesis

### Step 1: Key Generation
On first run, the node generates:
- Ed25519 keypair (public key = node identity, private key = signing authority)
- UUID node identifier
- Encrypted keystore file saved to disk (AES encrypted with user passphrase)

**Artifacts:** `keystore.json`, `node_id`

### Step 2: Genesis Block
Create the root of the user's personal blocklattice chain:
```json
{
  "sequence": 0,
  "prev_hash": null,
  "timestamp": "<unix_ms>",
  "signature": "<ed25519_sig>",
  "tx_set": []
}
```

**Artifact:** Genesis block written to local DB

---

## Phase 2: Tap-to-Mine (Entropy Engine)

### Step 3: Touch/Event Capture
User interactions (tap, click, mouse move, scroll) feed raw event data into an entropy buffer:
- Coordinates, timestamps, pressure (if available)
- Buffer size: ~1024 events (FIFO)
- Derive `block_seed` via SHA-256 of accumulated entropy

**Artifact:** In-memory entropy buffer → `block_seed`

### Step 4: Block Production
When triggered (timed interval or seed threshold):
- Build block: `{ prev_hash, sequence, signature, timestamp, tx_set, seed }`
- Sign with private key
- Append to local blocklattice DB
- Increment sequence

**Artifact:** New block persisted locally

---

## Phase 3: Local Node API

### Step 5: JSON-RPC over HTTP (localhost)
The node exposes a JSON-RPC server bound to `localhost:PORT`:
- `NewTx(signed_tx)` — validate and append to block
- `GetChain(start, limit)` — read blocks from local DB
- `GetBalance()` — current balance (placeholder until economics defined)
- `GetPeers()` — list connected peers
- `SyncChunk(block_range)` — sync from a peer
- `ExportKeystore()` — download encrypted backup
- `ImportKeystore(file)` — restore from backup
- `GetEntropySeed()` — current tap-derived seed
- `NodeInfo()` — node status, chain length, uptime

**Artifact:** `node/api/` — HTTP server with JSON-RPC handlers

---

## Phase 4: P2P Gossip & Sync

### Step 6: Peer Discovery
- WebRTC DataChannels for direct peer-to-peer connections
- STUN: public STUN servers for NAT traversal (e.g., `stun:stun.l.google.com:19302`)
- No central signaling server — peers exchange offers out-of-band (QR code, link share, manual SDP exchange) or via a lightweight distributed signaling approach

### Step 7: Block Gossip
- Broadcast new blocks to connected peers
- Receive blocks, validate, merge into local view
- Maintain a healing log of all observed blocks for reverse sync

### Step 8: Validation
Each incoming block is validated:
- Signature verified against claimed public key
- `prev_hash` chains correctly
- Sequence is monotonically increasing
- No double-spends in mempool
- Invalid blocks are rejected and logged

**Artifacts:** `node/p2p/` — WebRTC gossip engine, validation logic

---

## Phase 5: Frontend (Static Site)

### Step 9: Web Dashboard
The static web app connects to `localhost:<port>` and provides:
- **Chain explorer** — visualize your blocklattice
- **Tap-to-mine visualizer** — show entropy accumulation in real-time
- **Peer status** — connected peers, sync progress
- **Transaction sender** — compose and sign transactions
- **Keystore management** — export/import/backup
- **Node info** — uptime, block count, chain health

Built with Vite + TypeScript, output is pure static files → deployable to IPFS.

### Step 10: UI Generation
Hand the JSON-RPC contract to an LLM to generate polished UI components (React widgets, dashboard layouts, animations). The API contract is the source of truth.

---

## Milestones

| # | Milestone | Done when... |
|---|-----------|-------------|
| M1 | Node Init | `go run main.go init` generates keys + genesis block |
| M2 | Tap Engine | User taps → entropy → new blocks appear in local DB |
| M3 | API Server | `go run main.go serve` starts localhost JSON-RPC |
| M4 | P2P Sync | Two nodes on same machine sync blocks over WebRTC |
| M5 | Frontend | Static site connects to local node, shows chain + tap activity |
| M6 | IPFS Ready | `npm run build` produces static output, published to IPFS |
| M7 | Binary Release | `go build` produces distributable binary for Linux/macOS/Windows |
