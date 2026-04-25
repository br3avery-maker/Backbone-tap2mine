package tap

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"sync"
	"time"

	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/blocklattice"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/crypto"
)

const (
	EntropyBufferSize = 1024
	SeedThreshold     = 256 // bytes of entropy needed to produce a block
)

// EntropyEvent represents a raw user interaction event.
type EntropyEvent struct {
	Type      string  `json:"type"`      // tap, click, move, scroll, keypress
	Timestamp int64   `json:"timestamp"` // unix ms
	X         float64 `json:"x,omitempty"`
	Y         float64 `json:"y,omitempty"`
	Pressure  float64 `json:"pressure,omitempty"`
	Key       string  `json:"key,omitempty"`
}

// EntropyPool collects raw events and derives block seeds.
type EntropyPool struct {
	mu     sync.Mutex
	buffer []EntropyEvent
}

// NewEntropyPool creates a new empty entropy pool.
func NewEntropyPool() *EntropyPool {
	return &EntropyPool{
		buffer: make([]EntropyEvent, 0, EntropyBufferSize),
	}
}

// AddEvent adds a user interaction event to the entropy buffer.
func (ep *EntropyPool) AddEvent(event EntropyEvent) {
	ep.mu.Lock()
	defer ep.mu.Unlock()

	ep.buffer = append(ep.buffer, event)

	// Keep buffer bounded
	if len(ep.buffer) > EntropyBufferSize {
		ep.buffer = ep.buffer[len(ep.buffer)-EntropyBufferSize:]
	}
}

// DeriveSeed computes a SHA-256 seed from the current entropy buffer.
// Returns the hex-encoded seed and whether enough entropy has accumulated.
func (ep *EntropyPool) DeriveSeed() (string, bool) {
	ep.mu.Lock()
	defer ep.mu.Unlock()

	if len(ep.buffer) < 10 {
		return "", false // Not enough entropy yet
	}

	// Serialize events into a byte stream
	data := make([]byte, 0, len(ep.buffer)*40)
	for _, e := range ep.buffer {
		data = append(data, []byte(fmt.Sprintf("%s:%d:%f:%f:%f:%s",
			e.Type, e.Timestamp, e.X, e.Y, e.Pressure, e.Key))...)
	}

	hash := sha256.Sum256(data)
	seed := hex.EncodeToString(hash[:])

	return seed, len(ep.buffer) >= SeedThreshold/4 // rough threshold: ~64 events
}

// AddRandomEntropy adds a timestamp-based entropy sample (used when no real events).
func (ep *EntropyPool) AddRandomEntropy() {
	ep.AddEvent(EntropyEvent{
		Type:      "timer",
		Timestamp: time.Now().UnixNano(),
		X:         float64(time.Now().Nanosecond()) * math.Pi,
		Y:         float64(time.Now().UnixMilli()) * math.E,
	})
}

// SimulateTaps reads from stdin for CLI testing — each Enter press simulates a tap burst.
func SimulateTaps(pool *EntropyPool, onBlock func(seed string)) {
	reader := bufio.NewReader(os.Stdin)

	for {
		fmt.Print("⚡ tap (Enter): ")
		_, err := reader.ReadString('\n')
		if err != nil {
			break
		}

		// Simulate a burst of micro-events from one tap
		for i := 0; i < 8; i++ {
			pool.AddEvent(EntropyEvent{
				Type:      "tap",
				Timestamp: time.Now().UnixNano(),
				X:         float64(i) * 13.7,
				Y:         float64(i) * 7.3,
				Pressure:  0.3 + float64(i)*0.1,
			})
			time.Sleep(time.Millisecond)
		}

		pool.AddRandomEntropy()

		seed, ready := pool.DeriveSeed()
		if ready {
			onBlock(seed)
			// Reset buffer after block production
			pool.mu.Lock()
			pool.buffer = pool.buffer[:0]
			pool.mu.Unlock()
		} else {
			fmt.Println("  (collecting entropy...)")
		}
	}
}

// ProduceBlock creates a new block using the provided seed.
func ProduceBlock(lattice *blocklattice.Blocklattice, keystore *crypto.Keystore, seed string) (*blocklattice.Block, error) {
	latest, err := lattice.Latest()
	if err != nil {
		return nil, fmt.Errorf("get latest block: %w", err)
	}

	now := time.Now().UnixMilli()
	content := fmt.Sprintf("%s:%d:%s", latest.Hash, now, seed)

	hashBytes := sha256.Sum256([]byte(content))
	hashHex := hex.EncodeToString(hashBytes[:])

	signature, err := keystore.Sign([]byte(content))
	if err != nil {
		return nil, err
	}

	block := &blocklattice.Block{
		Sequence:  latest.Sequence + 1,
		PrevHash:  latest.Hash,
		Hash:      hashHex,
		Timestamp: now,
		Signature: hex.EncodeToString(signature),
		TxSet:     []blocklattice.Tx{},
		Seed:      seed,
		NodeID:    keystore.NodeID,
	}

	if err := lattice.Append(block); err != nil {
		return nil, err
	}

	return block, nil
}
