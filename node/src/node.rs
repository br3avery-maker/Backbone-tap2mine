use crate::crypto::Keystore;
use crate::blocklattice::Block;
use crate::tap::EntropyPool;

/// The core node — shared between Wasm (browser) and native (CLI daemon).
/// All state is in-memory. Persistence is handled by the calling layer.
pub struct Node {
    keystore: Keystore,
    chain: Vec<Block>,
    entropy_pool: EntropyPool,
}

impl Node {
    pub fn new() -> Self {
        let ks = Keystore::new();
        let genesis = crate::blocklattice::create_genesis(&ks);
        Node {
            keystore: ks,
            chain: vec![genesis],
            entropy_pool: EntropyPool::new(),
        }
    }

    pub fn from_data(keystore_json: &str, chain_json: &str) -> Result<Node, String> {
        let ks = Keystore::from_json(keystore_json)?;
        let blocks: Vec<Block> = serde_json::from_str(chain_json)
            .map_err(|e| format!("Invalid chain: {}", e))?;
        Ok(Node { keystore: ks, chain: blocks, entropy_pool: EntropyPool::new() })
    }

    // --- Serialization ---
    pub fn export_keystore(&self) -> String { self.keystore.to_json() }
    pub fn export_chain(&self) -> String {
        serde_json::to_string(&self.chain).unwrap_or_default()
    }

    // --- Info ---
    pub fn info_json(&self) -> String {
        serde_json::json!({
            "node_id": self.keystore.node_id(),
            "public_key": self.keystore.public_key(),
            "chain_len": self.chain.len(),
            "genesis_hash": self.chain.first().map(|b| b.hash.clone()).unwrap_or_default(),
            "latest_hash": self.chain.last().map(|b| b.hash.clone()).unwrap_or_default(),
        }).to_string()
    }

    pub fn get_chain_json(&self, start: usize, limit: usize) -> String {
        let end = (start + limit).min(self.chain.len());
        if start >= self.chain.len() { return "[]".to_string(); }
        serde_json::to_string(&self.chain[start..end]).unwrap_or_default()
    }

    pub fn latest_block_json(&self) -> String {
        self.chain.last().map(|b| b.to_json()).unwrap_or_default()
    }

    // --- Entropy / Mining ---
    pub fn add_tap(&mut self, x: f64, y: f64) { self.entropy_pool.add_tap(x, y); }
    pub fn add_move(&mut self, x: f64, y: f64) { self.entropy_pool.add_move(x, y); }
    pub fn add_scroll(&mut self, delta: f64) { self.entropy_pool.add_scroll(delta); }

    /// If enough entropy accumulated, produce a new block and return its JSON.
    /// Returns empty string if not ready.
    pub fn try_mine(&mut self) -> String {
        let (seed, ready) = self.entropy_pool.derive_seed();
        if ready {
            let latest = self.chain.last().unwrap();
            let new_block = crate::tap::produce_block(latest, &self.keystore, &seed);
            self.chain.push(new_block.clone());
            self.entropy_pool.reset();
            return new_block.to_json();
        }
        String::new()
    }

    pub fn get_entropy_json(&self) -> String {
        let (seed, ready) = self.entropy_pool.derive_seed();
        serde_json::json!({"seed": seed, "ready": ready}).to_string()
    }

    pub fn entropy_count(&self) -> usize { self.entropy_pool.count() }
    pub fn chain_len(&self) -> usize { self.chain.len() }

    pub fn verify_block(&self, block_json: &str) -> bool {
        if let Ok(block) = Block::from_json(block_json) {
            let content = format!("{}:{}:{}", block.prev_hash, block.timestamp, block.seed);
            self.keystore.verify(content.as_bytes(), &block.signature)
        } else {
            false
        }
    }

    // --- Accessors ---
    pub fn keystore(&self) -> &Keystore { &self.keystore }
    pub fn chain(&self) -> &[Block] { &self.chain }
}
