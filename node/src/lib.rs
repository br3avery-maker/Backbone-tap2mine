mod crypto;
mod blocklattice;
mod genesis;
mod tap;
mod api;

pub use api::Node;
pub use crypto::Keystore;
pub use blocklattice::Block;
pub use tap::EntropyPool;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn init() {
    web_sys::console::log_1(&"Tap2Mine Wasm initialized".into());
}

#[wasm_bindgen]
pub fn create_node() -> Node { Node::new() }

#[wasm_bindgen]
pub fn load_node(keystore_json: &str, chain_json: &str) -> Result<Node, JsError> {
    Node::from_data(keystore_json, chain_json)
}
