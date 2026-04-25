#!/bin/bash
# Build the Wasm module and copy to frontend
set -e

echo "🔨 Building Wasm module..."
cd node
cargo build --target wasm32-unknown-unknown --release

# Generate wasm-bindgen JS glue
echo "📦 Generating JS bindings..."
wasm-bindgen target/wasm32-unknown-unknown/release/tap2mine_node.wasm \
  --out-dir ../frontend/wasm \
  --target web

# Optimize the wasm binary
echo "⚡ Optimizing..."
wasm-opt -Oz ../frontend/wasm/tap2mine_node_bg.wasm -o ../frontend/wasm/tap2mine_node_bg.wasm

echo "✅ Done! Wasm module copied to frontend/wasm/"
echo "   Run: cd frontend && npm run dev"
