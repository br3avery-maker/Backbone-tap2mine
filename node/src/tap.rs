use sha2::{Sha256, Digest};
use crate::crypto::Keystore;
use crate::blocklattice::Block;

pub struct EntropyPool {
    buffer: Vec<String>,
    max_size: usize,
}

impl EntropyPool {
    pub fn new() -> Self {
        EntropyPool { buffer: Vec::with_capacity(1024), max_size: 1024 }
    }

    pub fn add_tap(&mut self, x: f64, y: f64) {
        self.buffer.push(format!("tap:{}:{}:{}", crate::now_ms(), x, y));
        self.trim();
    }

    pub fn add_move(&mut self, x: f64, y: f64) {
        self.buffer.push(format!("move:{}:{}:{}", crate::now_ms(), x, y));
        self.trim();
    }

    pub fn add_scroll(&mut self, delta: f64) {
        self.buffer.push(format!("scroll:{}:{}", crate::now_ms(), delta));
        self.trim();
    }

    fn trim(&mut self) {
        if self.buffer.len() > self.max_size {
            self.buffer.drain(..self.buffer.len() - self.max_size);
        }
    }

    /// Returns (seed_hex, is_ready)
    pub fn derive_seed(&self) -> (String, bool) {
        if self.buffer.len() < 10 {
            return (String::new(), false);
        }
        let mut data = Vec::new();
        for e in &self.buffer { data.extend_from_slice(e.as_bytes()); }
        let seed = hex::encode(Sha256::digest(&data));
        let ready = self.buffer.len() >= 64;
        (seed, ready)
    }

    pub fn count(&self) -> usize { self.buffer.len() }
    pub fn reset(&mut self) { self.buffer.clear(); }
}

/// Produce a new block from the latest block and entropy seed
pub fn produce_block(latest: &Block, ks: &Keystore, seed: &str) -> Block {
    Block::from_prev(latest, ks, seed)
}
