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
        signature: sig, tx_set: Vec::new(), seed: "genesis".to_string(),
        node_id: ks.node_id().to_string(),
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Block {
    pub sequence: u64,
    pub prev_hash: String,
    pub hash: String,
    pub timestamp: i64,
    pub signature: String,
    pub tx_set: Vec<Tx>,
    pub seed: String,
    pub node_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Tx {
    pub from: String,
    pub to: String,
    pub amount: i64,
    pub signature: String,
    pub timestamp: i64,
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
            seed: seed.to_string(), node_id: ks.node_id().to_string(),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    pub fn from_json(json: &str) -> Result<Block, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}
