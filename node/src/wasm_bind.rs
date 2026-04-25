//! Wasm-bindgen bindings for the browser frontend.
//! Only compiled when targeting wasm32.

use wasm_bindgen::prelude::*;
use crate::Node;

#[wasm_bindgen(start)]
pub fn init_wasm() {
    web_sys::console::log_1(&"Tap2Mine Wasm initialized".into());
}

/// Wasm wrapper around the core Node.
/// The native Node has no wasm_bindgen attributes; this struct bridges them.
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

    pub fn add_tap(&mut self, x: f64, y: f64) { self.inner.add_tap(x, y); }
    pub fn add_move(&mut self, x: f64, y: f64) { self.inner.add_move(x, y); }
    pub fn add_scroll(&mut self, delta: f64) { self.inner.add_scroll(delta); }
    pub fn try_mine(&mut self) -> String { self.inner.try_mine() }
    pub fn verify_block(&self, block_json: &str) -> bool { self.inner.verify_block(block_json) }
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
