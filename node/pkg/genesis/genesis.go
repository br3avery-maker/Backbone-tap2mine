package genesis

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/blocklattice"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/crypto"
)

// CreateGenesis builds the genesis block for a new node's blocklattice.
func CreateGenesis(keystore *crypto.Keystore) (*blocklattice.Block, error) {
	pubKeyHex, err := keystore.PublicKeyHex()
	if err != nil {
		return nil, err
	}

	now := time.Now().UnixMilli()

	content := fmt.Sprintf("genesis:%s:%d:%s", keystore.NodeID, now, pubKeyHex)
	hash := sha256.Sum256([]byte(content))
	hashHex := hex.EncodeToString(hash[:])

	// Sign the genesis content
	signature, err := keystore.Sign([]byte(content))
	if err != nil {
		return nil, err
	}

	block := &blocklattice.Block{
		Sequence:  0,
		PrevHash:  "",
		Hash:      hashHex,
		Timestamp: now,
		Signature: hex.EncodeToString(signature),
		TxSet:     []blocklattice.Tx{},
		Seed:      "genesis",
		NodeID:    keystore.NodeID,
	}

	return block, nil
}
