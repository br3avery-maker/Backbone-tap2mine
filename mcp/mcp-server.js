#!/usr/bin/env node
/**
 * Tap2Mine MCP Server
 * 
 * Exposes the Tap2Mine Wasm node as MCP (Model Context Protocol) tools.
 * Run with: node mcp-server.js
 * 
 * Tools available to LLM agents:
 * - create_node: Create a new anonymous blocklattice node
 * - node_info: Get node status and chain info
 * - get_chain: Read blocks from the chain
 * - add_tap: Feed tap entropy to the node
 * - try_mine: Attempt to mine a block from accumulated entropy
 * - get_entropy: Check current entropy status
 * - export_node: Export full node as .tap2mine file content
 * - import_node: Load a node from .tap2mine file content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Simple in-memory node state
let nodeState = null;

const server = new McpServer({
  name: "tap2mine",
  version: "0.1.0-alpha",
});

// --- Tool: create_node ---
server.tool(
  "create_node",
  "Create a new anonymous Tap2Mine blocklattice node with Ed25519 keys and genesis block",
  {},
  async () => {
    // In a full implementation, this would call the Wasm module via wasmtime or similar
    // For now, return the structure that the Wasm module would produce
    const nodeId = crypto.randomUUID();
    nodeState = {
      nodeId,
      publicKey: "pending_wasm_integration",
      chain: [{
        sequence: 0,
        prev_hash: "",
        hash: "genesis_" + crypto.randomUUID(),
        timestamp: Date.now(),
        signature: "",
        tx_set: [],
        seed: "genesis",
        nodeId,
      }],
      entropyBuffer: [],
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          node_id: nodeId,
          chain_len: 1,
          genesis_hash: nodeState.chain[0].hash,
          message: "Node created. Start tapping to mine blocks."
        }, null, 2),
      }],
    };
  }
);

// --- Tool: node_info ---
server.tool(
  "node_info",
  "Get Tap2Mine node status, chain length, and public key",
  {},
  async () => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          node_id: nodeState.nodeId,
          public_key: nodeState.publicKey,
          chain_len: nodeState.chain.length,
          genesis_hash: nodeState.chain[0]?.hash,
          latest_hash: nodeState.chain[nodeState.chain.length - 1]?.hash,
          entropy_events: nodeState.entropyBuffer.length,
        }, null, 2),
      }],
    };
  }
);

// --- Tool: get_chain ---
server.tool(
  "get_chain",
  "Read blocks from the blocklattice chain with pagination",
  {
    start: { type: "number", description: "Starting block index (default: 0)" },
    limit: { type: "number", description: "Number of blocks to return (default: 20)" },
  },
  async ({ start = 0, limit = 20 }) => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    const blocks = nodeState.chain.slice(start, start + limit);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(blocks, null, 2),
      }],
    };
  }
);

// --- Tool: add_tap ---
server.tool(
  "add_tap",
  "Feed tap entropy into the node. Call this when the user taps/clicks. Coordinates and timestamp add entropy.",
  {
    x: { type: "number", description: "X coordinate of the tap" },
    y: { type: "number", description: "Y coordinate of the tap" },
  },
  async ({ x, y }) => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    nodeState.entropyBuffer.push({
      type: "tap",
      timestamp: Date.now(),
      x, y,
    });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          entropy_count: nodeState.entropyBuffer.length,
          ready: nodeState.entropyBuffer.length >= 64,
          message: nodeState.entropyBuffer.length >= 64 
            ? "Entropy threshold reached! Call try_mine to produce a block."
            : `Need ${64 - nodeState.entropyBuffer.length} more events to mine.`,
        }, null, 2),
      }],
    };
  }
);

// --- Tool: try_mine ---
server.tool(
  "try_mine",
  "Attempt to mine a new block from accumulated entropy. Returns the new block if enough entropy, or empty if not ready.",
  {},
  async () => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    if (nodeState.entropyBuffer.length < 64) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mined: false,
            entropy_count: nodeState.entropyBuffer.length,
            needed: 64 - nodeState.entropyBuffer.length,
            message: "Not enough entropy. More taps needed.",
          }, null, 2),
        }],
      };
    }
    
    // Simulate block production (full implementation uses Wasm)
    const latest = nodeState.chain[nodeState.chain.length - 1];
    const seed = crypto.randomUUID(); // Simplified — Wasm uses SHA-256 of entropy
    
    const newBlock = {
      sequence: latest.sequence + 1,
      prev_hash: latest.hash,
      hash: crypto.randomUUID(), // Simplified — Wasm uses SHA-256
      timestamp: Date.now(),
      signature: "pending_wasm_signing",
      tx_set: [],
      seed,
      nodeId: nodeState.nodeId,
    };
    
    nodeState.chain.push(newBlock);
    nodeState.entropyBuffer = [];
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          mined: true,
          block: newBlock,
          message: `Block #${newBlock.sequence} mined!`,
        }, null, 2),
      }],
    };
  }
);

// --- Tool: get_entropy ---
server.tool(
  "get_entropy",
  "Check the current entropy status and whether the node is ready to mine",
  {},
  async () => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    const count = nodeState.entropyBuffer.length;
    const ready = count >= 64;
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          entropy_count: count,
          threshold: 64,
          ready,
          remaining: ready ? 0 : 64 - count,
          percentage: Math.min(100, Math.round((count / 64) * 100)),
        }, null, 2),
      }],
    };
  }
);

// --- Tool: export_node ---
server.tool(
  "export_node",
  "Export the full node (keys + chain) as a .tap2mine file content for backup",
  {},
  async () => {
    if (!nodeState) {
      return {
        content: [{ type: "text", text: "No node found. Use create_node first." }],
        isError: true,
      };
    }
    
    const exportData = {
      version: 1,
      keystore: {
        node_id: nodeState.nodeId,
        public_key: nodeState.publicKey,
        note: "Secret key requires Wasm module for full export",
      },
      chain: nodeState.chain,
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(exportData, null, 2),
      }],
    };
  }
);

// --- Tool: import_node ---
server.tool(
  "import_node",
  "Load a node from .tap2mine file content (JSON string)",
  {
    data: { type: "string", description: "JSON content of a .tap2mine file" },
  },
  async ({ data }) => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.keystore?.node_id || !Array.isArray(parsed.chain)) {
        return {
          content: [{ type: "text", text: "Invalid .tap2mine file format." }],
          isError: true,
        };
      }
      
      nodeState = {
        nodeId: parsed.keystore.node_id,
        publicKey: parsed.keystore.public_key || "unknown",
        chain: parsed.chain,
        entropyBuffer: [],
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            imported: true,
            node_id: nodeState.nodeId,
            chain_len: nodeState.chain.length,
            message: "Node loaded successfully.",
          }, null, 2),
        }],
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Invalid JSON: ${e.message}` }],
        isError: true,
      };
    }
  }
);

// Start the MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Tap2Mine MCP server running on stdio");
}

main().catch(console.error);
