use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};
use crate::crypto::Keystore;
use crate::blocklattice::Block;

/// Collects user interaction entropy and derives block seeds
#[wasm_bindgen]
pub struct EntropyPool {
    buffer: Vec<String>,
    max_size: usize,
}

#[wasm_bindgen]
impl EntropyPool {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        EntropyPool { buffer: Vec::with_capacity(1024), max_size: 1024 }
    }

    pub fn add_tap(&mut self, x: f64, y: f64) {
        self.buffer.push(format!("tap:{}:{}:{}", js_sys::Date::now(), x, y));
        self.trim();
    }

    pub fn add_move(&mut self, x: f64, y: f64) {
        self.buffer.push(format!("move:{}:{}:{}", js_sys::Date::now(), x, y));
        self.trim();
    }

    pub fn add_scroll(&mut self, delta: f64) {
        self.buffer.push(format!("scroll:{}:{}", js_sys::Date::now(), delta));
        self.trim();
    }

    fn trim(&mut self) {
        if self.buffer.len() > self.max_size {
            self.buffer.drain(..self.buffer.len() - self.max_size);
        }
    }

    /// Returns JSON: {"seed": "hex...", "ready": bool}
    pub fn derive_seed(&self) -> String {
        if self.buffer.len() < 10 {
            return r#"{"seed":"","ready":false}"#.to_string();
        }
        let mut data = Vec::new();
        for e in &self.buffer { data.extend_from_slice(e.as_bytes()); }
        let seed = hex::encode(Sha256::digest(&data));
        let ready = self.buffer.len() >= 64;
        serde_json::json!({"seed": seed, "ready": ready}).to_string()
    }

    pub fn count(&self) -> usize { self.buffer.len() }
    pub fn reset(&mut self) { self.buffer.clear(); }
}

/// Produce a new block from the latest block and entropy seed
pub fn produce_block(latest: &Block, ks: &Keystore, seed: &str) -> Block {
    Block::from_prev(latest, ks, seed)
}
