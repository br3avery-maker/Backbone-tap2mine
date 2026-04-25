package main

import (
	"fmt"
	"os"

	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/config"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/genesis"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/crypto"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/blocklattice"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/tap"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/api"
	"github.com/br3avery-maker/Backbone-tap2mine/node/pkg/mcp"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
		os.Exit(1)
	}

	switch os.Args[1] {
	case "init":
		cmdInit(cfg)
	case "serve":
		cmdServe(cfg)
	case "info":
		cmdInfo(cfg)
	case "tap":
		cmdTap(cfg)
	case "mcp":
		cmdMCP(cfg)
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func cmdInit(cfg *config.Config) {
	fmt.Println("Initializing Backbone Tap2Mine node...")

	// Check if already initialized
	if cfg.IsInitialized() {
		fmt.Println("Node already initialized. Use 'tap2mine reset' to start over.")
		os.Exit(1)
	}

	// Generate keypair
	keystore, err := crypto.GenerateKeystore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating keys: %v\n", err)
		os.Exit(1)
	}

	pubKeyHex, err := keystore.PublicKeyHex()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting public key: %v\n", err)
		os.Exit(1)
	}

	// Create genesis block
	genBlock, err := genesis.CreateGenesis(keystore)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error creating genesis block: %v\n", err)
		os.Exit(1)
	}

	// Initialize blocklattice
	lattice, err := blocklattice.New(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing blocklattice: %v\n", err)
		os.Exit(1)
	}
	defer lattice.Close()

	err = lattice.Append(genBlock)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error writing genesis block: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Node initialized successfully!\n")
	fmt.Printf("  Node ID:  %s\n", keystore.NodeID)
	fmt.Printf("  Pub Key:  %s\n", pubKeyHex)
	fmt.Printf("  Data Dir: %s\n", cfg.DataDir)
	fmt.Printf("  Genesis:  %s\n", genBlock.Hash)
}

func cmdServe(cfg *config.Config) {
	if !cfg.IsInitialized() {
		fmt.Println("Node not initialized. Run 'tap2mine init' first.")
		os.Exit(1)
	}

	keystore, err := crypto.LoadKeystore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading keystore: %v\n", err)
		os.Exit(1)
	}

	lattice, err := blocklattice.New(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening blocklattice: %v\n", err)
		os.Exit(1)
	}
	defer lattice.Close()

	entropyPool := tap.NewEntropyPool()

	fmt.Printf("Starting Tap2Mine node on :%d\n", cfg.APIPort)
	fmt.Printf("  Node ID: %s\n", keystore.NodeID)
	fmt.Printf("  Chain:   %d blocks\n", lattice.Length())
	fmt.Printf("  API:     http://localhost:%d/rpc\n", cfg.APIPort)

	server := api.NewServer(cfg.APIPort, keystore, lattice, entropyPool)
	if err := server.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "API server error: %v\n", err)
		os.Exit(1)
	}
}

func cmdInfo(cfg *config.Config) {
	if !cfg.IsInitialized() {
		fmt.Println("Node not initialized. Run 'tap2mine init' first.")
		os.Exit(1)
	}

	keystore, err := crypto.LoadKeystore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading keystore: %v\n", err)
		os.Exit(1)
	}

	lattice, err := blocklattice.New(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening blocklattice: %v\n", err)
		os.Exit(1)
	}
	defer lattice.Close()

	pubKeyHex, _ := keystore.PublicKeyHex()
	chainInfo, _ := lattice.GetChainInfo()

	fmt.Printf("Tap2Mine Node Info\n")
	fmt.Printf("==================\n")
	fmt.Printf("  Node ID:    %s\n", keystore.NodeID)
	fmt.Printf("  Public Key: %s\n", pubKeyHex)
	fmt.Printf("  Chain Len:  %d blocks\n", chainInfo.Length)
	fmt.Printf("  Genesis:    %s\n", chainInfo.GenesisHash)
	fmt.Printf("  Latest:     %s\n", chainInfo.LatestHash)
	fmt.Printf("  Data Dir:   %s\n", cfg.DataDir)
}

func cmdTap(cfg *config.Config) {
	if !cfg.IsInitialized() {
		fmt.Println("Node not initialized. Run 'tap2mine init' first.")
		os.Exit(1)
	}

	keystore, err := crypto.LoadKeystore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading keystore: %v\n", err)
		os.Exit(1)
	}

	lattice, err := blocklattice.New(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening blocklattice: %v\n", err)
		os.Exit(1)
	}
	defer lattice.Close()

	entropyPool := tap.NewEntropyPool()

	// Simulate tap events from stdin (for CLI testing)
	fmt.Println("Tap-to-Mine mode — press Enter to simulate taps (Ctrl+C to stop)")
	fmt.Println("Each tap adds entropy. Blocks are created when entropy threshold is reached.")

	tap.SimulateTaps(entropyPool, func(seed string) {
		block, err := tap.ProduceBlock(lattice, keystore, seed)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error producing block: %v\n", err)
			return
		}
		fmt.Printf("⛏ New block #%-4d  seed: %s...  hash: %s\n",
			block.Sequence, seed[:16], block.Hash[:16])
	})
}

func cmdMCP(cfg *config.Config) {
	if !cfg.IsInitialized() {
		fmt.Println("Node not initialized. Run 'tap2mine init' first.")
		os.Exit(1)
	}

	keystore, err := crypto.LoadKeystore(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading keystore: %v\n", err)
		os.Exit(1)
	}

	lattice, err := blocklattice.New(cfg.DataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error opening blocklattice: %v\n", err)
		os.Exit(1)
	}
	defer lattice.Close()

	entropyPool := tap.NewEntropyPool()

	fmt.Println("Starting MCP server (stdio transport)...")
	fmt.Printf("  Node ID: %s\n", keystore.NodeID)
	fmt.Printf("  Chain:   %d blocks\n", lattice.Length())

	mcpServer := mcp.NewServer(keystore, lattice, entropyPool)
	if err := mcpServer.StartStdio(); err != nil {
		fmt.Fprintf(os.Stderr, "MCP server error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`Backbone Tap2Mine — Blocklattice Node

Usage:
  tap2mine init       Initialize node (generate keys + genesis block)
  tap2mine serve      Start JSON-RPC API server on localhost
  tap2mine info       Show node status and chain info
  tap2mine tap        Enter tap-to-mine mode (simulated)
  tap2mine mcp        Start MCP server for LLM agent integration
  tap2mine help       Show this help message`)
}
