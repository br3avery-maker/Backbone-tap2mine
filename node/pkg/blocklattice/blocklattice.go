package blocklattice

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Block represents a single block in a user's personal blocklattice chain.
type Block struct {
	Sequence  int64    `json:"sequence"`
	PrevHash  string   `json:"prev_hash"`
	Hash      string   `json:"hash"`
	Timestamp int64    `json:"timestamp"`
	Signature string   `json:"signature"`
	TxSet     []Tx     `json:"tx_set"`
	Seed      string   `json:"seed"`
	NodeID    string   `json:"node_id"`
}

// Tx represents a transaction within a block.
type Tx struct {
	From      string `json:"from"`
	To        string `json:"to"`
	Amount    int64  `json:"amount"`
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
}

// ChainInfo provides a summary of the chain state.
type ChainInfo struct {
	Length      int64  `json:"length"`
	GenesisHash string `json:"genesis_hash"`
	LatestHash  string `json:"latest_hash"`
	NodeID      string `json:"node_id"`
}

// Blocklattice stores blocks in a file-based chain (alpha implementation).
// Production would use BadgerDB or BoltDB.
type Blocklattice struct {
	dir   string
	mu    sync.RWMutex
	blocks []*Block
}

// New opens or creates a blocklattice store at the given directory.
func New(dir string) (*Blocklattice, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}

	bl := &Blocklattice{
		dir:    dir,
		blocks: make([]*Block, 0),
	}

	// Load existing blocks
	if err := bl.load(); err != nil {
		return nil, err
	}

	return bl, nil
}

// Append adds a new block to the chain.
func (bl *Blocklattice) Append(block *Block) error {
	bl.mu.Lock()
	defer bl.mu.Unlock()

	// Validate chain continuity
	if len(bl.blocks) > 0 {
		latest := bl.blocks[len(bl.blocks)-1]
		if block.PrevHash != latest.Hash {
			return fmt.Errorf("prev_hash mismatch: expected %s, got %s", latest.Hash, block.PrevHash)
		}
		if block.Sequence != latest.Sequence+1 {
			return fmt.Errorf("sequence mismatch: expected %d, got %d", latest.Sequence+1, block.Sequence)
		}
	} else {
		// First block must be genesis
		if block.Sequence != 0 {
			return fmt.Errorf("first block must be genesis (sequence 0), got %d", block.Sequence)
		}
	}

	bl.blocks = append(bl.blocks, block)
	return bl.persist(block)
}

// GetChain returns a range of blocks from the chain.
func (bl *Blocklattice) GetChain(start, limit int) ([]Block, error) {
	bl.mu.RLock()
	defer bl.mu.RUnlock()

	if start < 0 {
		start = 0
	}
	if start >= len(bl.blocks) {
		return nil, nil
	}

	end := start + limit
	if end > len(bl.blocks) {
		end = len(bl.blocks)
	}

	result := make([]Block, 0, end-start)
	for _, b := range bl.blocks[start:end] {
		result = append(result, *b)
	}

	return result, nil
}

// GetBlock returns a block by sequence number.
func (bl *Blocklattice) GetBlock(seq int64) (*Block, error) {
	bl.mu.RLock()
	defer bl.mu.RUnlock()

	if seq < 0 || seq >= int64(len(bl.blocks)) {
		return nil, fmt.Errorf("block not found: sequence %d", seq)
	}

	return bl.blocks[seq], nil
}

// Latest returns the most recent block.
func (bl *Blocklattice) Latest() (*Block, error) {
	bl.mu.RLock()
	defer bl.mu.RUnlock()

	if len(bl.blocks) == 0 {
		return nil, fmt.Errorf("chain is empty")
	}

	return bl.blocks[len(bl.blocks)-1], nil
}

// Length returns the number of blocks in the chain.
func (bl *Blocklattice) Length() int {
	bl.mu.RLock()
	defer bl.mu.RUnlock()
	return len(bl.blocks)
}

// GetChainInfo returns a summary of the chain.
func (bl *Blocklattice) GetChainInfo() (*ChainInfo, error) {
	bl.mu.RLock()
	defer bl.mu.RUnlock()

	info := &ChainInfo{
		Length: int64(len(bl.blocks)),
	}

	if len(bl.blocks) > 0 {
		info.GenesisHash = bl.blocks[0].Hash
		info.LatestHash = bl.blocks[len(bl.blocks)-1].Hash
		info.NodeID = bl.blocks[0].NodeID
	}

	return info, nil
}

// Close persists any remaining state (currently a no-op for file-based storage).
func (bl *Blocklattice) Close() error {
	return nil
}

// persist writes a single block to disk.
func (bl *Blocklattice) persist(block *Block) error {
	filename := filepath.Join(bl.dir, fmt.Sprintf("block_%06d.json", block.Sequence))
	data, err := json.MarshalIndent(block, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filename, data, 0600)
}

// load reads all blocks from disk into memory.
func (bl *Blocklattice) load() error {
	entries, err := os.ReadDir(bl.dir)
	if err != nil {
		return err
	}

	// Load all blocks into a map first, then build sorted slice
	blockMap := make(map[int64]*Block)
	var maxSeq int64 = -1

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		// Only load block files (block_NNNNNN.json pattern)
		if !strings.HasPrefix(entry.Name(), "block_") || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		data, err := os.ReadFile(filepath.Join(bl.dir, entry.Name()))
		if err != nil {
			continue
		}

		var block Block
		if err := json.Unmarshal(data, &block); err != nil {
			continue
		}

		blockMap[block.Sequence] = &block
		if block.Sequence > maxSeq {
			maxSeq = block.Sequence
		}
	}

	// Build sorted slice
	for seq := int64(0); seq <= maxSeq; seq++ {
		if b, ok := blockMap[seq]; ok {
			bl.blocks = append(bl.blocks, b)
		}
	}

	return nil
}
