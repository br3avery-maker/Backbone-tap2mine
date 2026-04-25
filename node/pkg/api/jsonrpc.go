package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync/atomic"

	"github.com/tap2mine/node/pkg/blocklattice"
	"github.com/tap2mine/node/pkg/crypto"
	"github.com/tap2mine/node/pkg/tap"
)

// Server is the JSON-RPC HTTP server.
type Server struct {
	port        int
	keystore    *crypto.Keystore
	lattice     *blocklattice.Blocklattice
	entropyPool *tap.EntropyPool
	requests    atomic.Int64
}

// NewServer creates a new API server.
func NewServer(port int, keystore *crypto.Keystore, lattice *blocklattice.Blocklattice, pool *tap.EntropyPool) *Server {
	return &Server{
		port:        port,
		keystore:    keystore,
		lattice:     lattice,
		entropyPool: pool,
	}
}

// Start begins serving JSON-RPC requests.
func (s *Server) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/rpc", s.handleRPC)
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/api/schema.json", s.handleSchema)

	addr := fmt.Sprintf(":%d", s.port)
	return http.ListenAndServe(addr, mux)
}

// JSON-RPC request/response types.
type RPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
	ID      interface{}     `json:"id"`
}

type RPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (s *Server) handleRPC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	var req RPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.sendError(w, nil, -32700, "Parse error")
		return
	}

	s.requests.Add(1)

	var result interface{}
	var rpcErr *RPCError

	switch req.Method {
	case "NodeInfo":
		result, rpcErr = s.nodeInfo()
	case "GetChain":
		result, rpcErr = s.getChain(req.Params)
	case "GetBalance":
		result, rpcErr = s.getBalance()
	case "GetPeers":
		result, rpcErr = s.getPeers()
	case "GetEntropySeed":
		result, rpcErr = s.getEntropySeed()
	case "ExportKeystore":
		result, rpcErr = s.exportKeystore()
	default:
		rpcErr = &RPCError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", req.Method)}
	}

	resp := RPCResponse{
		JSONRPC: "2.0",
		Result:  result,
		Error:   rpcErr,
		ID:      req.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "ok",
		"requests": s.requests.Load(),
	})
}

func (s *Server) handleSchema(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(schemaSpec())
}

func (s *Server) sendError(w http.ResponseWriter, id interface{}, code int, msg string) {
	resp := RPCResponse{
		JSONRPC: "2.0",
		Error:   &RPCError{Code: code, Message: msg},
		ID:      id,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(resp)
}

// RPC method implementations.

func (s *Server) nodeInfo() (interface{}, *RPCError) {
	info, err := s.lattice.GetChainInfo()
	if err != nil {
		return nil, &RPCError{Code: -32000, Message: err.Error()}
	}
	pubKey, _ := s.keystore.PublicKeyHex()
	return map[string]interface{}{
		"node_id":     info.NodeID,
		"public_key":  pubKey,
		"chain_len":   info.Length,
		"genesis":     info.GenesisHash,
		"latest_hash": info.LatestHash,
	}, nil
}

func (s *Server) getChain(params json.RawMessage) (interface{}, *RPCError) {
	var args struct {
		Start int `json:"start"`
		Limit int `json:"limit"`
	}
	if params != nil {
		json.Unmarshal(params, &args)
	}
	if args.Limit <= 0 {
		args.Limit = 20
	}

	blocks, err := s.lattice.GetChain(args.Start, args.Limit)
	if err != nil {
		return nil, &RPCError{Code: -32000, Message: err.Error()}
	}
	return blocks, nil
}

func (s *Server) getBalance() (interface{}, *RPCError) {
	// Placeholder — economics not yet defined
	return map[string]interface{}{
		"balance": 0,
		"note":    "Balance not yet implemented",
	}, nil
}

func (s *Server) getPeers() (interface{}, *RPCError) {
	// Placeholder — P2P not yet implemented
	return []interface{}{}, nil
}

func (s *Server) getEntropySeed() (interface{}, *RPCError) {
	seed, ready := s.entropyPool.DeriveSeed()
	return map[string]interface{}{
		"seed":  seed,
		"ready": ready,
	}, nil
}

func (s *Server) exportKeystore() (interface{}, *RPCError) {
	pubKey, _ := s.keystore.PublicKeyHex()
	return map[string]interface{}{
		"node_id":    s.keystore.NodeID,
		"public_key": pubKey,
		"note":       "Secret key export requires passphrase (not yet implemented)",
	}, nil
}

func schemaSpec() map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.1.0",
		"info": map[string]interface{}{
			"title":       "Backbone Tap2Mine JSON-RPC API",
			"description": "Local blocklattice node API — accessible at localhost:<port>/rpc",
			"version":     "0.1.0-alpha",
		},
		"methods": []map[string]interface{}{
			{
				"name":        "NodeInfo",
				"description": "Get node status, chain length, and public key",
				"params":      map[string]interface{}{},
				"returns":     map[string]interface{}{"node_id": "string", "public_key": "string", "chain_len": "int", "genesis": "string", "latest_hash": "string"},
			},
			{
				"name":        "GetChain",
				"description": "Read blocks from the local chain with pagination",
				"params":      map[string]interface{}{"start": "int (default 0)", "limit": "int (default 20)"},
				"returns":     "[]Block",
			},
			{
				"name":        "GetBalance",
				"description": "Get current balance (placeholder)",
				"params":      map[string]interface{}{},
				"returns":     map[string]interface{}{"balance": "int"},
			},
			{
				"name":        "GetPeers",
				"description": "List connected P2P peers (placeholder)",
				"params":      map[string]interface{}{},
				"returns":     "[]Peer",
			},
			{
				"name":        "GetEntropySeed",
				"description": "Get current tap-derived entropy seed",
				"params":      map[string]interface{}{},
				"returns":     map[string]interface{}{"seed": "string", "ready": "bool"},
			},
			{
				"name":        "ExportKeystore",
				"description": "Export encrypted wallet backup",
				"params":      map[string]interface{}{},
				"returns":     map[string]interface{}{"node_id": "string", "public_key": "string"},
			},
		},
	}
}
