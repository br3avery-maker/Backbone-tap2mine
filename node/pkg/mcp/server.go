package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"github.com/tap2mine/node/pkg/blocklattice"
	"github.com/tap2mine/node/pkg/crypto"
	"github.com/tap2mine/node/pkg/tap"
)

// Server implements the Model Context Protocol for LLM agent integration.
type Server struct {
	keystore    *crypto.Keystore
	lattice     *blocklattice.Blocklattice
	entropyPool *tap.EntropyPool
}

// NewServer creates a new MCP server.
func NewServer(keystore *crypto.Keystore, lattice *blocklattice.Blocklattice, pool *tap.EntropyPool) *Server {
	return &Server{
		keystore:    keystore,
		lattice:     lattice,
		entropyPool: pool,
	}
}

// StartStdio runs the MCP server over stdin/stdout (stdio transport).
func (s *Server) StartStdio() error {
	scanner := bufio.NewScanner(os.Stdin)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		result, err := s.handleRequest(line)
		if err != nil {
			s.sendError(err)
			continue
		}

		if result != nil {
			s.sendResult(result)
		}
	}

	return scanner.Err()
}

type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
	ID      interface{}     `json:"id"`
}

type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *MCPError   `json:"error,omitempty"`
	ID      interface{} `json:"id"`
}

type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type ToolDefinition struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Schema      any    `json:"inputSchema"`
}

func (s *Server) handleRequest(line string) (interface{}, error) {
	var req MCPRequest
	if err := json.Unmarshal([]byte(line), &req); err != nil {
		return nil, fmt.Errorf("parse error: %w", err)
	}

	switch req.Method {
	// MCP initialization
	case "initialize":
		return s.handleInitialize(req), nil
	case "initialized":
		return nil, nil // notification, no response

	// Tool discovery
	case "tools/list":
		return s.handleToolsList(req), nil

	// Tool execution
	case "tools/call":
		return s.handleToolsCall(req), nil

	default:
		return nil, fmt.Errorf("method not found: %s", req.Method)
	}
}

func (s *Server) handleInitialize(req MCPRequest) MCPResponse {
	return MCPResponse{
		JSONRPC: "2.0",
		Result: map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
			"serverInfo": map[string]interface{}{
				"name":    "tap2mine-node",
				"version": "0.1.0-alpha",
			},
		},
		ID: req.ID,
	}
}

func (s *Server) handleToolsList(req MCPRequest) MCPResponse {
	chainInfo, _ := s.lattice.GetChainInfo()

	tools := []ToolDefinition{
		{
			Name:        "get_node_info",
			Description: fmt.Sprintf("Get Tap2Mine node status. Node ID: %s, Chain: %d blocks", s.keystore.NodeID, chainInfo.Length),
			Schema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "get_chain",
			Description: "Read blocks from the local blocklattice chain with pagination",
			Schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"start": map[string]interface{}{"type": "integer", "description": "Starting block index (default: 0)"},
					"limit": map[string]interface{}{"type": "integer", "description": "Number of blocks to return (default: 20)"},
				},
			},
		},
		{
			Name:        "get_balance",
			Description: "Get current balance (placeholder — economics not yet defined)",
			Schema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "get_entropy_seed",
			Description: "Get the current tap-derived entropy seed for block production",
			Schema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "get_peers",
			Description: "List connected P2P peers (placeholder — P2P not yet implemented)",
			Schema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "export_keystore",
			Description: "Export the node's public key and node ID for backup",
			Schema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
	}

	return MCPResponse{
		JSONRPC: "2.0",
		Result: map[string]interface{}{
			"tools": tools,
		},
		ID: req.ID,
	}
}

func (s *Server) handleToolsCall(req MCPRequest) MCPResponse {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &call); err != nil {
		return MCPResponse{
			JSONRPC: "2.0",
			Error:   &MCPError{Code: -32600, Message: "Invalid tool call"},
			ID:      req.ID,
		}
	}

	var result interface{}
	var err error

	switch call.Name {
	case "get_node_info":
		result, err = s.toolNodeInfo()
	case "get_chain":
		result, err = s.toolGetChain(call.Arguments)
	case "get_balance":
		result, err = s.toolGetBalance()
	case "get_entropy_seed":
		result, err = s.toolGetEntropySeed()
	case "get_peers":
		result, err = s.toolGetPeers()
	case "export_keystore":
		result, err = s.toolExportKeystore()
	default:
		err = fmt.Errorf("unknown tool: %s", call.Name)
	}

	if err != nil {
		return MCPResponse{
			JSONRPC: "2.0",
			Error:   &MCPError{Code: -32603, Message: err.Error()},
			ID:      req.ID,
		}
	}

	return MCPResponse{
		JSONRPC: "2.0",
		Result: map[string]interface{}{
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": marshalJSON(result),
				},
			},
		},
		ID: req.ID,
	}
}

func (s *Server) toolNodeInfo() (interface{}, error) {
	info, err := s.lattice.GetChainInfo()
	if err != nil {
		return nil, err
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

func (s *Server) toolGetChain(args json.RawMessage) (interface{}, error) {
	var p struct {
		Start int `json:"start"`
		Limit int `json:"limit"`
	}
	if args != nil {
		json.Unmarshal(args, &p)
	}
	if p.Limit <= 0 {
		p.Limit = 20
	}
	return s.lattice.GetChain(p.Start, p.Limit)
}

func (s *Server) toolGetBalance() (interface{}, error) {
	return map[string]interface{}{
		"balance": 0,
		"note":    "Balance not yet implemented",
	}, nil
}

func (s *Server) toolGetEntropySeed() (interface{}, error) {
	seed, ready := s.entropyPool.DeriveSeed()
	return map[string]interface{}{
		"seed":  seed,
		"ready": ready,
	}, nil
}

func (s *Server) toolGetPeers() (interface{}, error) {
	return []interface{}{}, nil
}

func (s *Server) toolExportKeystore() (interface{}, error) {
	pubKey, _ := s.keystore.PublicKeyHex()
	return map[string]interface{}{
		"node_id":    s.keystore.NodeID,
		"public_key": pubKey,
		"note":       "Secret key export requires passphrase (not yet implemented)",
	}, nil
}

func (s *Server) sendResult(result interface{}) {
	data, _ := json.Marshal(result)
	fmt.Fprintln(os.Stdout, string(data))
}

func (s *Server) sendError(err error) {
	resp := MCPResponse{
		JSONRPC: "2.0",
		Error:   &MCPError{Code: -32603, Message: err.Error()},
		ID:      nil,
	}
	data, _ := json.Marshal(resp)
	fmt.Fprintln(os.Stdout, string(data))
}

func marshalJSON(v interface{}) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	return string(data)
}
