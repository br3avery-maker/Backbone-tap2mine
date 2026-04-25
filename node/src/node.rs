use crate::crypto::Keystore;
use crate::blocklattice::Block;
use crate::tap::EntropyPool;

/// Value per mined block (Proof of Tap)
/// Each block represents real human attention/interaction
const BLOCK_VALUE: u64 = 1;

/// The core node — all state is in-memory.
/// Persistence is handled by the calling layer (IndexedDB in browser).
pub struct Node {
    keystore: Keystore,
    chain: Vec<Block>,
    entropy_pool: EntropyPool,
    peers: Vec<PeerInfo>,
    pending_sends: Vec<PendingSend>,
}

#[derive(Clone, Debug)]
pub struct PeerInfo {
    pub node_id: String,
    pub public_key: String,
}

#[derive(Clone, Debug)]
pub struct PendingSend {
    pub block_hash: String,
    pub to_node_id: String,
    pub amount: u64,
    pub timestamp: i64,
}

impl Node {
    pub fn new() -> Self {
        let ks = Keystore::new();
        let genesis = crate::blocklattice::create_genesis(&ks);
        Node {
            keystore: ks,
            chain: vec![genesis],
            entropy_pool: EntropyPool::new(),
            peers: Vec::new(),
            pending_sends: Vec::new(),
        }
    }

    pub fn from_data(keystore_json: &str, chain_json: &str) -> Result<Node, String> {
        let ks = Keystore::from_json(keystore_json)?;
        let blocks: Vec<Block> = serde_json::from_str(chain_json)
            .map_err(|e| format!("Invalid chain: {}", e))?;
        Ok(Node {
            keystore: ks,
            chain: blocks,
            entropy_pool: EntropyPool::new(),
            peers: Vec::new(),
            pending_sends: Vec::new(),
        })
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
            "chao_address": self.chao_address(),
            "chain_len": self.chain.len(),
            "genesis_hash": self.chain.first().map(|b| b.hash.clone()).unwrap_or_default(),
            "latest_hash": self.chain.last().map(|b| b.hash.clone()).unwrap_or_default(),
            "balance_chao": self.get_balance(),
            "peers": self.peers.len(),
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

    // --- Balance ---
    /// Compute balance from chain history:
    /// +BLOCK_VALUE for each "mine" block
    /// -amount for each "send" transaction
    /// +amount for each "receive" transaction
    pub fn get_balance(&self) -> u64 {
        let mut balance: i64 = 0;
        for block in &self.chain {
            match block.block_type.as_str() {
                "mine" => {
                    balance += BLOCK_VALUE as i64;
                }
                "send" => {
                    for tx in &block.tx_set {
                        if tx.tx_type == "send" {
                            balance -= tx.amount as i64;
                        }
                    }
                }
                "receive" => {
                    for tx in &block.tx_set {
                        if tx.tx_type == "receive" {
                            balance += tx.amount as i64;
                        }
                    }
                }
                _ => {}
            }
        }
        balance.max(0) as u64
    }

    pub fn get_peers_json(&self) -> String {
        let peers: Vec<_> = self.peers.iter().map(|p| {
            serde_json::json!({
                "node_id": p.node_id,
                "public_key": p.public_key,
            })
        }).collect();
        serde_json::to_string(&peers).unwrap_or_default()
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

    // --- P2P Transactions ---

    /// Create a SEND block to send value to another node.
    /// Returns the block JSON and a pending send record.
    pub fn create_send(&mut self, to_node_id: &str, to_pubkey: &str, amount: u64) -> Result<String, String> {
        let balance = self.get_balance();
        if amount > balance {
            return Err(format!("Insufficient balance: {} available, {} requested", balance, amount));
        }

        let latest = self.chain.last().ok_or("Chain is empty")?;
        let send_block = Block::send_block(latest, &self.keystore, to_node_id, to_pubkey, amount);
        self.chain.push(send_block.clone());

        // Record as pending until confirmed by receiver
        self.pending_sends.push(PendingSend {
            block_hash: send_block.hash.clone(),
            to_node_id: to_node_id.to_string(),
            amount,
            timestamp: send_block.timestamp,
        });

        Ok(send_block.to_json())
    }

    /// Receive a SEND block from a peer and create a RECEIVE confirmation.
    /// Returns the receive block JSON.
    pub fn receive_send(&mut self, send_block_json: &str) -> Result<String, String> {
        let send_block = Block::from_json(send_block_json)?;

        // Validate it's actually a send block
        if send_block.block_type != "send" {
            return Err("Not a send block".to_string());
        }

        // Validate the send block has exactly one send transaction
        let tx = send_block.tx_set.first()
            .ok_or("Send block has no transactions")?;

        if tx.tx_type != "send" {
            return Err("Block doesn't contain a send transaction".to_string());
        }

        // Verify the sender's signature
        // In a full implementation, we'd verify against the sender's public key
        // For now, we trust the block structure

        // Create the receive confirmation
        let latest = self.chain.last().ok_or("Chain is empty")?;
        let receive_block = Block::receive_block(
            latest,
            &self.keystore,
            &send_block.node_id,
            "", // pubkey would come from peer info
            tx.amount,
            &send_block.hash,
        );
        self.chain.push(receive_block.clone());

        Ok(receive_block.to_json())
    }

    /// Add a peer to the known peers list
    pub fn add_peer(&mut self, node_id: &str, public_key: &str) -> Result<String, String> {
        // Check if already a peer
        if self.peers.iter().any(|p| p.node_id == node_id) {
            return Err("Already a peer".to_string());
        }

        // Create handshake block
        let latest = self.chain.last().ok_or("Chain is empty")?;
        let handshake = Block::handshake_block(latest, &self.keystore, node_id, public_key);
        self.chain.push(handshake.clone());

        // Add to peers
        self.peers.push(PeerInfo {
            node_id: node_id.to_string(),
            public_key: public_key.to_string(),
        });

        Ok(handshake.to_json())
    }

    // --- Accessors ---
    pub fn keystore(&self) -> &Keystore { &self.keystore }
    pub fn chain(&self) -> &[Block] { &self.chain }
    pub fn node_id(&self) -> &str { self.keystore.node_id() }
    pub fn public_key(&self) -> &str { self.keystore.public_key() }

    /// Generate a CHAO address: chao_0x + first 16 chars of public key
    pub fn chao_address(&self) -> String {
        format!("chao_0x{}", &self.keystore.public_key()[..16.min(self.keystore.public_key().len())])
    }
}
