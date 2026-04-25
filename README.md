# Backbone Tap2Mine

A decentralized blocklattice network where every user runs their own node with their own chain. No central authority, no shared ledger, no server.

## Architecture

- **Blocklattice** — Each user has a personal chain (like Nano's architecture)
- **Tap-to-Mine** — User interactions generate entropy that seeds new blocks
- **P2P** — Nodes gossip blocks directly via WebRTC (coming soon)
- **Local-first** — All state lives on the user's machine
- **LLM-ready** — MCP server for AI agent integration

## Quick Start

### Node (Go)

```bash
cd node

# Initialize node (generates keys + genesis block)
./tap2mine init

# Show node info
./tap2mine info

# Start JSON-RPC API server
./tap2mine serve

# Tap-to-mine mode (CLI)
./tap2mine tap

# Start MCP server for LLM agents
./tap2mine mcp
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # Development server
npm run build  # Static output → IPFS
```

## Commands

| Command | Description |
|---------|-------------|
| `tap2mine init` | Initialize node (keys + genesis) |
| `tap2mine serve` | Start JSON-RPC API on localhost:8765 |
| `tap2mine info` | Show node status and chain info |
| `tap2mine tap` | Enter tap-to-mine mode (simulated) |
| `tap2mine mcp` | Start MCP server for LLM integration |

## API

The JSON-RPC API is available at `http://localhost:8765/rpc` when running `tap2mine serve`.

Full API schema: `http://localhost:8765/api/schema.json`

### Methods

- `NodeInfo` — Node status and chain info
- `GetChain(start, limit)` — Read blocks with pagination
- `GetBalance()` — Current balance (placeholder)
- `GetPeers()` — Connected P2P peers (placeholder)
- `GetEntropySeed()` — Current tap-derived entropy seed
- `ExportKeystore()` — Encrypted wallet backup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Node | Go (Ed25519, SHA-256) |
| Storage | Filesystem (block files) |
| API | JSON-RPC over HTTP |
| Agent | MCP (Model Context Protocol) |
| Frontend | Vite + TypeScript |
| Deploy | Static → IPFS |

## Milestones

- [x] M1: Node Init — Key generation + genesis block
- [x] M2: Tap Engine — Entropy collection + block production
- [x] M3: API Server — JSON-RPC localhost server
- [x] M3.5: Agent Skill — MCP server + OpenClaw skill
- [ ] M4: P2P Sync — WebRTC block gossip
- [ ] M5: Frontend — Static dashboard connected to local node
- [ ] M6: IPFS Ready — Deployable static build
- [ ] M7: Binary Release — Cross-platform binaries

## License

MIT
