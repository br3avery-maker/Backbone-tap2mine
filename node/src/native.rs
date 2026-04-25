//! Native (non-Wasm) module: filesystem persistence, HTTP API, P2P.
//! Only compiled when NOT targeting wasm32.

use std::fs;
use std::path::PathBuf;
use crate::Node;

const DEFAULT_DATA_DIR: &str = ".tap2mine";

pub fn data_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(DEFAULT_DATA_DIR)
}

pub fn keystore_path() -> PathBuf {
    data_dir().join("keystore.json")
}

pub fn chain_path() -> PathBuf {
    data_dir().join("chain.json")
}

/// Save the node state to disk.
pub fn save_node(node: &Node) -> Result<(), String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Create data dir: {}", e))?;

    fs::write(keystore_path(), node.export_keystore())
        .map_err(|e| format!("Write keystore: {}", e))?;
    fs::write(chain_path(), node.export_chain())
        .map_err(|e| format!("Write chain: {}", e))?;

    Ok(())
}

/// Load node state from disk, or create a new one.
pub fn load_or_create() -> Result<Node, String> {
    let ks_path = keystore_path();
    let ch_path = chain_path();

    if ks_path.exists() && ch_path.exists() {
        let ks = fs::read_to_string(&ks_path)
            .map_err(|e| format!("Read keystore: {}", e))?;
        let ch = fs::read_to_string(&ch_path)
            .map_err(|e| format!("Read chain: {}", e))?;
        Node::from_data(&ks, &ch)
    } else {
        Ok(Node::new())
    }
}

/// Start the HTTP JSON-RPC server on localhost.
pub async fn serve(node: std::sync::Arc<tokio::sync::Mutex<Node>>, port: u16) -> Result<(), String> {
    use axum::{
        routing::post,
        Json, Router,
        extract::State,
    };
    use serde_json::json;

    #[derive(serde::Deserialize)]
    struct RpcRequest {
        method: String,
        params: Option<serde_json::Value>,
        id: serde_json::Value,
    }

    async fn handle_rpc(
        State(node): State<std::sync::Arc<tokio::sync::Mutex<Node>>>,
        Json(req): Json<RpcRequest>,
    ) -> Json<serde_json::Value> {
        let n = node.lock().await;

        let result = match req.method.as_str() {
            "NodeInfo" => Some(json!({
                "node_id": n.keystore().node_id(),
                "public_key": n.keystore().public_key(),
                "chain_len": n.chain_len(),
                "genesis_hash": n.chain().first().map(|b| b.hash.clone()).unwrap_or_default(),
                "latest_hash": n.chain().last().map(|b| b.hash.clone()).unwrap_or_default(),
            })),
            "GetChain" => {
                let start = req.params.as_ref().and_then(|p| p["start"].as_u64()).unwrap_or(0) as usize;
                let limit = req.params.as_ref().and_then(|p| p["limit"].as_u64()).unwrap_or(20) as usize;
                Some(serde_json::from_str::<serde_json::Value>(&n.get_chain_json(start, limit)).unwrap_or(json!([])))
            }
            "GetEntropySeed" => {
                Some(serde_json::from_str::<serde_json::Value>(&n.get_entropy_json()).unwrap_or(json!({})))
            }
            "GetBalance" => Some(json!({"balance": 0, "note": "Not yet implemented"})),
            "GetPeers" => Some(json!([])),
            "ExportKeystore" => Some(json!({
                "node_id": n.keystore().node_id(),
                "public_key": n.keystore().public_key(),
                "note": "Use file-based backup (keystore.json in data dir)"
            })),
            _ => None,
        };

        let response = if let Some(r) = result {
            json!({"jsonrpc": "2.0", "result": r, "id": req.id})
        } else {
            json!({"jsonrpc": "2.0", "error": {"code": -32601, "message": format!("Method not found: {}", req.method)}, "id": req.id})
        };

        Json(response)
    }

    let app = Router::new()
        .route("/rpc", post(handle_rpc))
        .with_state(node);

    let addr = format!("127.0.0.1:{}", port);
    println!("Starting JSON-RPC server on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Bind {}: {}", addr, e))?;

    axum::serve(listener, app).await
        .map_err(|e| format!("Server error: {}", e))?;

    Ok(())
}
