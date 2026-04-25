package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const DefaultConfigName = "node.json"

type Config struct {
	DataDir string `json:"data_dir"`
	APIPort int    `json:"api_port"`
	MCPPort int    `json:"mcp_port"`
	P2PPort int    `json:"p2p_port"`
}

func Load() (*Config, error) {
	configPath := ConfigPath()

	cfg := &Config{
		DataDir: DefaultDataDir(),
		APIPort: 8765,
		MCPPort: 8766,
		P2PPort: 8767,
	}

	if data, err := os.ReadFile(configPath); err == nil {
		if err := json.Unmarshal(data, cfg); err != nil {
			return nil, err
		}
	}

	// Ensure data dir exists
	if err := os.MkdirAll(cfg.DataDir, 0700); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Save() error {
	configPath := ConfigPath()
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0600)
}

func (c *Config) IsInitialized() bool {
	keystorePath := filepath.Join(c.DataDir, "keystore.json")
	_, err := os.Stat(keystorePath)
	return err == nil
}

func (c *Config) KeystorePath() string {
	return filepath.Join(c.DataDir, "keystore.json")
}

func (c *Config) ChainPath() string {
	return filepath.Join(c.DataDir, "chain")
}

func ConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".tap2mine", DefaultConfigName)
}

func DefaultDataDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".tap2mine", "data")
}
