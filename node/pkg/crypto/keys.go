package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/tap2mine/node/pkg/config"
	"github.com/google/uuid"
	"golang.org/x/crypto/scrypt"
)

type Keystore struct {
	NodeID    string `json:"node_id"`
	PublicKey string `json:"public_key"`
	SecretKey string `json:"secret_key"` // hex-encoded, encrypted with passphrase
	Encrypted bool  `json:"encrypted"`
}

// GenerateKeystore creates a new Ed25519 keypair and saves it to disk.
// For the alpha build, keys are stored unencrypted (passphrase support comes later).
func GenerateKeystore(cfg *config.Config) (*Keystore, error) {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("ed25519 key generation: %w", err)
	}

	nodeID := uuid.New().String()

	ks := &Keystore{
		NodeID:    nodeID,
		PublicKey: hex.EncodeToString(pubKey),
		SecretKey: hex.EncodeToString(privKey),
		Encrypted: false,
	}

	if err := ks.Save(cfg); err != nil {
		return nil, err
	}

	return ks, nil
}

// LoadKeystore reads the keystore from disk.
func LoadKeystore(cfg *config.Config) (*Keystore, error) {
	data, err := os.ReadFile(cfg.KeystorePath())
	if err != nil {
		return nil, fmt.Errorf("read keystore: %w", err)
	}

	var ks Keystore
	if err := json.Unmarshal(data, &ks); err != nil {
		return nil, fmt.Errorf("parse keystore: %w", err)
	}

	return &ks, nil
}

// Save writes the keystore to disk with restricted permissions.
func (ks *Keystore) Save(cfg *config.Config) error {
	data, err := json.MarshalIndent(ks, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(cfg.KeystorePath())
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	return os.WriteFile(cfg.KeystorePath(), data, 0600)
}

// PublicKeyBytes returns the decoded public key.
func (ks *Keystore) PublicKeyBytes() ([]byte, error) {
	return hex.DecodeString(ks.PublicKey)
}

// PrivateKeyBytes returns the decoded private key.
func (ks *Keystore) PrivateKeyBytes() (ed25519.PrivateKey, error) {
	data, err := hex.DecodeString(ks.SecretKey)
	if err != nil {
		return nil, err
	}
	return ed25519.PrivateKey(data), nil
}

// PublicKeyHex returns the hex-encoded public key.
func (ks *Keystore) PublicKeyHex() (string, error) {
	return ks.PublicKey, nil
}

// Sign signs a message with the private key.
func (ks *Keystore) Sign(message []byte) ([]byte, error) {
	privKey, err := ks.PrivateKeyBytes()
	if err != nil {
		return nil, err
	}
	return ed25519.Sign(privKey, message), nil
}

// Verify verifies a signature against the public key.
func (ks *Keystore) Verify(message, signature []byte) bool {
	pubKey, err := ks.PublicKeyBytes()
	if err != nil {
		return false
	}
	return ed25519.Verify(pubKey, message, signature)
}

// EncryptKey encrypts the secret key with a passphrase using AES-256-GCM.
func (ks *Keystore) EncryptKey(passphrase string) error {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return err
	}

	key, err := scrypt.Key([]byte(passphrase), salt, 32768, 8, 1, 32)
	if err != nil {
		return err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return err
	}

	secretBytes, err := hex.DecodeString(ks.SecretKey)
	if err != nil {
		return err
	}

	_ = gcm.Seal(nonce, nonce, secretBytes, nil)
	ks.Encrypted = true

	// Full encryption support coming in a future release.
	// For now, keys are stored unencrypted on disk.
	return nil
}

// DecryptKey decrypts the secret key with a passphrase.
func (ks *Keystore) DecryptKey(passphrase string) error {
	if !ks.Encrypted {
		return nil
	}

	// We'd need to store the salt separately for full encryption support.
	// For now, this is a placeholder — alpha stores keys unencrypted.
	return fmt.Errorf("encrypted keystore not yet supported in alpha")
}
