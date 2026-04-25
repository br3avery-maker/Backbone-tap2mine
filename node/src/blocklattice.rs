use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};
use crate::crypto::Keystore;

pub fn create_genesis(ks: &Keystore) -> Block {
    let ts = js_sys::Date::now() as i64;
    let content = format!("genesis:{}:{}:{}", ks.node_id(), ts, ks.public_key());
    let hash = hex::encode(Sha256::digest(content.as_bytes()));
    let sig = ks.sign(content.as_bytes());
    Block {
        sequence: 0, prev_hash: String::new(), hash, timestamp: ts,
        signature: sig, tx_set: Vec::new(), block_type: "mine".to_string(),
        seed: "genesis".to_string(), node_id: ks.node_id().to_string(),
        peer_tx_ref: None,
    }
}

/// Types of blocks that can appear on a chain
/// - "mine": Created by tapping (Proof of Tap)
/// - "send": User sending value to another node
/// - "receive": Confirmation of receiving value from another node
/// - "handshake": Peer connection established

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Block {
    pub sequence: u64,
    pub prev_hash: String,
    pub hash: String,
    pub timestamp: i64,
    pub signature: String,
    pub tx_set: Vec<Tx>,
    pub block_type: String,     // "mine", "send", "receive", "handshake"
    pub seed: String,
    pub node_id: String,
    /// Reference to the peer's transaction that this block confirms
    pub peer_tx_ref: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tx {
    pub tx_type: String,    // "send", "receive"
    pub from: String,       // sender's node_id
    pub to: String,         // receiver's node_id
    pub amount: u64,        // value being transferred
    pub signature: String,  // signature of the sender
    pub timestamp: i64,
    /// Hash of the peer's confirming transaction (for mutual confirmation)
    pub peer_tx_hash: Option<String>,
}

impl Block {
    pub fn from_prev(prev: &Block, ks: &Keystore, seed: &str) -> Self {
        let ts = js_sys::Date::now() as i64;
        let content = format!("{}:{}:{}", prev.hash, ts, seed);
        let hash = hex::encode(Sha256::digest(content.as_bytes()));
        let sig = ks.sign(content.as_bytes());
        Block {
            sequence: prev.sequence + 1, prev_hash: prev.hash.clone(), hash,
            timestamp: ts, signature: sig, tx_set: Vec::new(),
            block_type: "mine".to_string(),
            seed: seed.to_string(), node_id: ks.node_id().to_string(),
            peer_tx_ref: None,
        }
    }

    /// Create a SEND block: user sends value to another node
    pub fn send_block(prev: &Block, ks: &Keystore, to_node_id: &str, _to_pubkey: &str, amount: u64) -> Self {
        let ts = js_sys::Date::now() as i64;
        let tx = Tx {
            tx_type: "send".to_string(),
            from: ks.node_id().to_string(),
            to: to_node_id.to_string(),
            amount,
            signature: String::new(), // Will be signed
            timestamp: ts,
            peer_tx_hash: None,
        };
        let content = format!("{}:{}:{}:send:{}", prev.hash, ts, ks.node_id(), to_node_id);
        let hash = hex::encode(Sha256::digest(content.as_bytes()));
        let sig = ks.sign(content.as_bytes());
        let mut tx_signed = tx;
        tx_signed.signature = sig.clone();
        Block {
            sequence: prev.sequence + 1, prev_hash: prev.hash.clone(), hash,
            timestamp: ts, signature: sig, tx_set: vec![tx_signed],
            block_type: "send".to_string(),
            seed: String::new(), node_id: ks.node_id().to_string(),
            peer_tx_ref: None,
        }
    }

    /// Create a RECEIVE block: confirm receiving value from another node
    pub fn receive_block(prev: &Block, ks: &Keystore, from_node_id: &str, _from_pubkey: &str, amount: u64, source_tx_hash: &str) -> Self {
        let ts = js_sys::Date::now() as i64;
        let tx = Tx {
            tx_type: "receive".to_string(),
            from: from_node_id.to_string(),
            to: ks.node_id().to_string(),
            amount,
            signature: String::new(), // Receiver signs their own confirmation
            timestamp: ts,
            peer_tx_hash: Some(source_tx_hash.to_string()),
        };
        let content = format!("{}:{}:{}:receive:{}", prev.hash, ts, ks.node_id(), from_node_id);
        let hash = hex::encode(Sha256::digest(content.as_bytes()));
        let sig = ks.sign(content.as_bytes());
        let mut tx_signed = tx;
        tx_signed.signature = sig.clone();
        Block {
            sequence: prev.sequence + 1, prev_hash: prev.hash.clone(), hash,
            timestamp: ts, signature: sig, tx_set: vec![tx_signed],
            block_type: "receive".to_string(),
            seed: String::new(), node_id: ks.node_id().to_string(),
            peer_tx_ref: Some(source_tx_hash.to_string()),
        }
    }

    /// Create a HANDSHAKE block: record a new peer connection
    pub fn handshake_block(prev: &Block, ks: &Keystore, peer_node_id: &str, _peer_pubkey: &str) -> Self {
        let ts = js_sys::Date::now() as i64;
        let content = format!("{}:{}:{}:handshake:{}", prev.hash, ts, ks.node_id(), peer_node_id);
        let hash = hex::encode(Sha256::digest(content.as_bytes()));
        let sig = ks.sign(content.as_bytes());
        Block {
            sequence: prev.sequence + 1, prev_hash: prev.hash.clone(), hash,
            timestamp: ts, signature: sig, tx_set: Vec::new(),
            block_type: "handshake".to_string(),
            seed: String::new(), node_id: ks.node_id().to_string(),
            peer_tx_ref: None,
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    pub fn from_json(json: &str) -> Result<Block, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}
