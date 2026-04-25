use wasm_bindgen::prelude::*;
use crate::crypto::Keystore;
use crate::blocklattice::Block;
use crate::tap::EntropyPool;

#[wasm_bindgen]
pub struct Node {
    keystore: Keystore,
    chain: Vec<Block>,
    entropy_pool: EntropyPool,
}

#[wasm_bindgen]
impl Node {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let ks = Keystore::new();
        let genesis = crate::genesis::create_genesis_block(&ks);
        Node { keystore: ks, chain: vec![genesis], entropy_pool: EntropyPool::new() }
    }

    pub fn from_data(keystore_json: &str, chain_json: &str) -> Result<Node, JsError> {
        let ks = Keystore::from_json(keystore_json)?;
        let vals: Vec<serde_json::Value> = serde_json::from_str(chain_json)
            .map_err(|e| JsError::new(&format!("Invalid chain: {}", e)))?;
        let chain: Result<Vec<Block>, _> = vals.iter()
            .map(|v| Block::from_json(&v.to_string())).collect();
        let chain = chain.map_err(|e| JsError::new(&format!("Invalid block: {:?}", e)))?;
        Ok(Node { keystore: ks, chain, entropy_pool: EntropyPool::new() })
    }

    pub fn export_keystore(&self) -> String { self.keystore.to_json() }

    pub fn export_chain(&self) -> String {
        let blocks: Vec<serde_json::Value> = self.chain.iter()
            .map(|b| serde_json::from_str(&b.to_json()).unwrap_or(serde_json::Value::Null))
            .collect();
        serde_json::to_string(&blocks).unwrap_or_default()
    }

    /// Returns JSON: {node_id, public_key, chain_len, genesis_hash, latest_hash}
    pub fn info(&self) -> String {
        serde_json::json!({
            "node_id": self.keystore.node_id(),
            "public_key": self.keystore.public_key(),
            "chain_len": self.chain.len(),
            "genesis_hash": self.chain.first().map(|b| b.hash()).unwrap_or_default(),
            "latest_hash": self.chain.last().map(|b| b.hash()).unwrap_or_default(),
        }).to_string()
    }

    pub fn get_chain(&self, start: usize, limit: usize) -> String {
        let end = (start + limit).min(self.chain.len());
        if start >= self.chain.len() { return "[]".to_string(); }
        let blocks: Vec<serde_json::Value> = self.chain[start..end].iter()
            .map(|b| serde_json::from_str(&b.to_json()).unwrap_or(serde_json::Value::Null))
            .collect();
        serde_json::to_string(&blocks).unwrap_or_default()
    }

    pub fn latest_block(&self) -> String {
        self.chain.last().map(|b| b.to_json()).unwrap_or_default()
    }

    pub fn add_tap(&mut self, x: f64, y: f64) { self.entropy_pool.add_tap(x, y); }
    pub fn add_move(&mut self, x: f64, y: f64) { self.entropy_pool.add_move(x, y); }
    pub fn add_scroll(&mut self, delta: f64) { self.entropy_pool.add_scroll(delta); }

    /// If enough entropy accumulated, produce a new block and return its JSON.
    /// Returns empty string if not ready.
    pub fn try_mine(&mut self) -> String {
        let seed_json = self.entropy_pool.derive_seed();
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&seed_json) {
            if v["ready"].as_bool().unwrap_or(false) {
                let seed = v["seed"].as_str().unwrap_or("").to_string();
                let latest = self.chain.last().unwrap();
                let new_block = crate::tap::produce_block(latest, &self.keystore, &seed);
                self.chain.push(new_block.clone());
                self.entropy_pool.reset();
                return new_block.to_json();
            }
        }
        String::new()
    }

    pub fn get_entropy(&self) -> String { self.entropy_pool.derive_seed() }
    pub fn entropy_count(&self) -> usize { self.entropy_pool.count() }
    pub fn chain_len(&self) -> usize { self.chain.len() }

    pub fn verify_block(&self, block_json: &str) -> bool {
        if let Ok(block) = Block::from_json(block_json) {
            let content = format!("{}:{}:{}", block.prev_hash(), block.timestamp(), block.seed());
            self.keystore.verify(content.as_bytes(), &block.signature())
        } else { false }
    }
}
