# Tap2Mine Agent Skill

Connect to a local Backbone Tap2Mine blocklattice node. Every user runs their own node with their own chain — no central server, no shared ledger.

## Setup

The Tap2Mine node must be running locally. Start it with:
```
tap2mine mcp
```

This starts an MCP server on stdio that this skill connects to.

## Tools

### get_node_info
Get node status, chain length, and public key. No parameters needed.

### get_chain
Read blocks from the local blocklattice chain with pagination.
- `start` (integer, optional): Starting block index (default: 0)
- `limit` (integer, optional): Number of blocks to return (default: 20)

### get_balance
Get current balance. Note: economics not yet defined — always returns 0 in alpha.

### get_entropy_seed
Get the current tap-derived entropy seed for block production. Shows whether enough entropy has accumulated to produce a new block.

### get_peers
List connected P2P peers. Note: P2P not yet implemented in alpha — always returns empty list.

### export_keystore
Export the node's public key and node ID for backup. Secret key export requires passphrase (not yet implemented).

## Architecture Notes

- **Blocklattice**: Each user has their own personal chain (not a shared blockchain like Bitcoin)
- **Tap-to-Mine**: User interactions (taps, clicks, scrolls) generate entropy that seeds new blocks
- **P2P**: Nodes gossip blocks directly with each other via WebRTC (not yet implemented)
- **Local-first**: All state lives on the user's machine, nothing on a central server

## Example Workflow

1. Call `get_node_info` to check the node is running
2. Call `get_chain` to see the user's block history
3. Call `get_entropy_seed` to check entropy levels
4. When the user taps/interacts with the Tap2Mine UI, new blocks are produced
5. Call `get_chain` again to see the new blocks
