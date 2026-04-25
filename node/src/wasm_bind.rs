//! Wasm-bindgen bindings for the browser frontend.
//! Exports the Node as a WasmNode class with a clean JS API.

use wasm_bindgen::prelude::*;
use crate::Node;

#[wasm_bindgen(start)]
pub fn init_wasm() {
    web_sys::console::log_1(&"Tap2Mine Wasm initialized".into());
}

/// Wasm wrapper around the core Node.
/// The core Node has no wasm_bindgen attributes; this struct bridges them.
#[wasm_bindgen]
pub struct WasmNode {
    inner: Node,
}

#[wasm_bindgen]
impl WasmNode {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmNode { inner: Node::new() }
    }

    pub fn info(&self) -> String { self.inner.info_json() }
    pub fn get_chain(&self, start: usize, limit: usize) -> String {
        self.inner.get_chain_json(start, limit)
    }
    pub fn latest_block(&self) -> String { self.inner.latest_block_json() }
    pub fn export_keystore(&self) -> String { self.inner.export_keystore() }
    pub fn export_chain(&self) -> String { self.inner.export_chain() }
    pub fn get_entropy(&self) -> String { self.inner.get_entropy_json() }
    pub fn entropy_count(&self) -> usize { self.inner.entropy_count() }
    pub fn chain_len(&self) -> usize { self.inner.chain_len() }
    pub fn get_balance(&self) -> u64 { self.inner.get_balance() }
    pub fn get_peers(&self) -> String { self.inner.get_peers_json() }
    pub fn node_id(&self) -> String { self.inner.node_id().to_string() }
    pub fn public_key(&self) -> String { self.inner.public_key().to_string() }

    pub fn add_tap(&mut self, x: f64, y: f64) { self.inner.add_tap(x, y); }
    pub fn add_move(&mut self, x: f64, y: f64) { self.inner.add_move(x, y); }
    pub fn add_scroll(&mut self, delta: f64) { self.inner.add_scroll(delta); }
    pub fn try_mine(&mut self) -> String { self.inner.try_mine() }
    pub fn verify_block(&self, block_json: &str) -> bool { self.inner.verify_block(block_json) }

    // --- P2P / Transactions ---

    /// Create a SEND block to send value to another node.
    /// Returns the block JSON or an error message.
    pub fn create_send(&mut self, to_node_id: &str, to_pubkey: &str, amount: u64) -> String {
        match self.inner.create_send(to_node_id, to_pubkey, amount) {
            Ok(json) => json,
            Err(e) => format!("{{\"error\":\"{}\"}}", e),
        }
    }

    /// Receive a SEND block from a peer and create a RECEIVE confirmation.
    /// Returns the receive block JSON or an error.
    pub fn receive_send(&mut self, send_block_json: &str) -> String {
        match self.inner.receive_send(send_block_json) {
            Ok(json) => json,
            Err(e) => format!("{{\"error\":\"{}\"}}", e),
        }
    }

    /// Add a peer to known peers
    pub fn add_peer(&mut self, node_id: &str, public_key: &str) -> String {
        match self.inner.add_peer(node_id, public_key) {
            Ok(json) => json,
            Err(e) => format!("{{\"error\":\"{}\"}}", e),
        }
    }
}

#[wasm_bindgen]
pub fn create_node() -> WasmNode {
    WasmNode::new()
}

#[wasm_bindgen]
pub fn load_node(keystore_json: &str, chain_json: &str) -> Result<WasmNode, JsError> {
    Node::from_data(keystore_json, chain_json)
        .map(|inner| WasmNode { inner })
        .map_err(|e| JsError::new(&e))
}

/// Serialize the full node state into a single JSON string for file export.
#[wasm_bindgen]
pub fn export_node(node: &WasmNode) -> String {
    serde_json::json!({
        "version": 1,
        "keystore": serde_json::from_str::<serde_json::Value>(&node.inner.export_keystore()).unwrap_or(serde_json::Value::Null),
        "chain": serde_json::from_str::<serde_json::Value>(&node.inner.export_chain()).unwrap_or(serde_json::Value::Null),
    }).to_string()
}

/// Load a node from a .tap2mine file content (JSON string).
#[wasm_bindgen]
pub fn import_node(data_json: &str) -> Result<WasmNode, JsError> {
    let data: serde_json::Value = serde_json::from_str(data_json)
        .map_err(|e| JsError::new(&format!("Invalid node file: {}", e)))?;

    let version = data["version"].as_u64().unwrap_or(0);
    if version != 1 {
        return Err(JsError::new(&format!("Unsupported version: {}", version)));
    }

    let ks = data["keystore"].to_string();
    let chain = data["chain"].to_string();

    Node::from_data(&ks, &chain)
        .map(|inner| WasmNode { inner })
        .map_err(|e| JsError::new(&format!("Invalid node data: {}", e)))
}

/// Parse a tap2mine:// handshake link or QR code content.
/// Returns JSON with node_id, public_key, and optional WebRTC offer.
#[wasm_bindgen]
pub fn parse_handshake_link(link: &str) -> String {
    // Accept formats:
    // tap2mine://peer?pk=<pubkey>&id=<node_id>&rtc=<sdp>
    // https://tap2mine.app/join?pk=<pubkey>&id=<node_id>&rtc=<sdp>
    let url = if link.starts_with("tap2mine://") {
        link.replace("tap2mine://", "http://")
    } else {
        link.to_string()
    };

    // Simple query string parsing
    let query = if let Some(pos) = url.find('?') {
        &url[pos + 1..]
    } else {
        return "{\"error\": \"No query parameters found\"}".to_string();
    };

    let mut params = serde_json::Map::new();
    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            params.insert(key.to_string(), serde_json::Value::String(
                url_decode(value)
            ));
        }
    }

    if params.contains_key("pk") && params.contains_key("id") {
        params.insert("type".to_string(), serde_json::Value::String("peer_handshake".to_string()));
        serde_json::Value::Object(params).to_string()
    } else {
        "{\"error\": \"Missing required parameters: pk and id\"}".to_string()
    }
}

/// Generate a handshake link for sharing with peers.
#[wasm_bindgen]
pub fn generate_handshake_link(node_id: &str, public_key: &str) -> String {
    // URL-encode the parameters
    let encoded_id = url_encode(node_id);
    let encoded_pk = url_encode(public_key);
    format!("tap2mine://peer?pk={}&id={}", encoded_pk, encoded_id)
}

fn url_decode(s: &str) -> String {
    percent_encoding::percent_decode_str(s)
        .decode_utf8_lossy()
        .to_string()
}

fn url_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC)
        .to_string()
}
