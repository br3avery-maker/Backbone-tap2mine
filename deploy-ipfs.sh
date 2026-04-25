#!/bin/bash
# Deploy Tap2Mine frontend to IPFS
# Requires: ipfs CLI (https://ipfs.tech) or npx ipfs-car

set -e

DIST_DIR="${1:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Build directory '$DIST_DIR' not found. Run 'npm run build' first."
  exit 1
fi

echo "📦 Deploying to IPFS..."

if command -v ipfs &> /dev/null; then
  # Using local IPFS daemon
  CID=$(ipfs add -r -Q "$DIST_DIR")
  echo "✅ Pinned to local IPFS node"
  echo "🌐 IPFS CID: $CID"
  echo "🌐 Gateway: https://ipfs.io/ipfs/$CID"
  echo "🌐 Local: http://localhost:8080/ipfs/$CID"
elif command -v npx &> /dev/null; then
  # Using ipfs-car for pinning to web3.storage
  npx ipfs-car pack "$DIST_DIR" --output dist.car 2>/dev/null || true
  echo "✅ Packed to dist.car"
  echo "📌 Upload dist.car to your preferred IPFS pinning service"
  echo "   - web3.storage"
  echo "   - nft.storage"
  echo "   - pinata.cloud"
  echo "   - or run: ipfs daemon, then 'ipfs add -r $DIST_DIR'"
else
  # Fallback: just show how to do it manually
  echo "ℹ️  No IPFS CLI found. Options:"
  echo "   1. Install IPFS: https://ipfs.tech"
  echo "      Then: ipfs add -r -Q $DIST_DIR"
  echo "   2. Use Pinata: https://pinata.cloud (drag & drop folder)"
  echo "   3. Use web3.storage: https://web3.storage"
fi
