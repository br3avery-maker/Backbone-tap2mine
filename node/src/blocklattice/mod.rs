use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};
use crate::crypto::Keystore;

pub fn create_genesis(ks: &Keystore) -> Block {
    let ts = js_sys::Date::now() as i64;
    let content = format!("genesis:{}:{}:{}", ks.node_id(), ts, ks.public_key());
    let hash = hex::encode(Sha256::digest(content.as_bytes()));
    let sig = ks.sign(content.as_bytes());
    Block {
        sequence: 0, prev_hash: String::new(), hash, timestamp: ts,
        signature: sig, tx_set: "[]".to_string(), seed: "genesis".to_string(),
        node_id: ks.node_id(),
    }
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct Block {
    sequence: u64,
    prev_hash: String,
    hash: String,
    timestamp: i64,
    signature: String,
    tx_set: String,
    seed: String,
    node_id: String,
}

#[wasm_bindgen]
impl Block {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Block { sequence: 0, prev_hash: String::new(), hash: String::new(),
            timestamp: js_sys::Date::now() as i64, signature: String::new(),
            tx_set: "[]".to_string(), seed: String::new(), node_id: String::new() }
    }

    pub fn from_prev(prev: &Block, ks: &Keystore, seed: &str) -> Self {
        let ts = js_sys::Date::now() as i64;
        let content = format!("{}:{}:{}", prev.hash, ts, seed);
        let hash = hex::encode(Sha256::digest(content.as_bytes()));
        let sig = ks.sign(content.as_bytes());
        Block {
            sequence: prev.sequence + 1, prev_hash: prev.hash.clone(), hash,
            timestamp: ts, signature: sig, tx_set: "[]".to_string(),
            seed: seed.to_string(), node_id: ks.node_id(),
        }
    }

    pub fn sequence(&self) -> u64 { self.sequence }
    pub fn hash(&self) -> String { self.hash.clone() }
    pub fn prev_hash(&self) -> String { self.prev_hash.clone() }
    pub fn timestamp(&self) -> i64 { self.timestamp }
    pub fn seed(&self) -> String { self.seed.clone() }
    pub fn node_id(&self) -> String { self.node_id.clone() }
    pub fn signature(&self) -> String { self.signature.clone() }

    pub fn to_json(&self) -> String {
        serde_json::json!({
            "sequence": self.sequence, "prev_hash": self.prev_hash,
            "hash": self.hash, "timestamp": self.timestamp,
            "signature": self.signature,
            "tx_set": serde_json::from_str::<serde_json::Value>(&self.tx_set).unwrap_or(serde_json::json!([])),
            "seed": self.seed, "node_id": self.node_id,
        }).to_string()
    }

    pub fn from_json(json: &str) -> Result<Block, JsError> {
        let v: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| JsError::new(&format!("Invalid block: {}", e)))?;
        Ok(Block {
            sequence: v["sequence"].as_u64().unwrap_or(0),
            prev_hash: v["prev_hash"].as_str().unwrap_or("").to_string(),
            hash: v["hash"].as_str().unwrap_or("").to_string(),
            timestamp: v["timestamp"].as_i64().unwrap_or(0),
            signature: v["signature"].as_str().unwrap_or("").to_string(),
            tx_set: v["tx_set"].to_string(),
            seed: v["seed"].as_str().unwrap_or("").to_string(),
            node_id: v["node_id"].as_str().unwrap_or("").to_string(),
        })
    }
}
