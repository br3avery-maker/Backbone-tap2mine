use wasm_bindgen::prelude::*;
use ed25519_dalek::{SigningKey, SecretKey};
use ed25519_dalek::Signer;
use uuid::Uuid;

#[wasm_bindgen]
pub struct Keystore {
    node_id: String,
    public_key_hex: String,
    signing_key: SigningKey,
}

#[wasm_bindgen]
impl Keystore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let mut seed = [0u8; 32];
        getrandom::getrandom(&mut seed).expect("Failed to get random bytes");
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        Keystore {
            node_id: Uuid::new_v4().to_string(),
            public_key_hex: hex::encode(verifying_key.to_bytes()),
            signing_key,
        }
    }

    pub fn sign(&self, message: &[u8]) -> String {
        let sig = self.signing_key.sign(message);
        hex::encode(sig.to_bytes())
    }

    pub fn verify(&self, message: &[u8], sig_hex: &str) -> bool {
        use ed25519_dalek::Verifier;
        if let Ok(bytes) = hex::decode(sig_hex) {
            if let Ok(sig) = ed25519_dalek::Signature::from_slice(&bytes) {
                return self.signing_key.verifying_key().verify(message, &sig).is_ok();
            }
        }
        false
    }

    pub fn node_id(&self) -> String { self.node_id.clone() }
    pub fn public_key(&self) -> String { self.public_key_hex.clone() }

    pub fn to_json(&self) -> String {
        serde_json::json!({
            "node_id": self.node_id,
            "public_key": self.public_key_hex,
            "secret_key": hex::encode(self.signing_key.to_bytes())
        }).to_string()
    }

    pub fn from_json(json: &str) -> Result<Keystore, JsError> {
        let v: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| JsError::new(&format!("Invalid keystore: {}", e)))?;
        let node_id = v["node_id"].as_str().ok_or_else(|| JsError::new("Missing node_id"))?.to_string();
        let public_key = v["public_key"].as_str().ok_or_else(|| JsError::new("Missing public_key"))?.to_string();
        let secret_hex = v["secret_key"].as_str().ok_or_else(|| JsError::new("Missing secret_key"))?;
        let bytes = hex::decode(secret_hex).map_err(|e| JsError::new(&format!("Bad secret key: {}", e)))?;
        let sk: SecretKey = bytes.try_into().map_err(|_| JsError::new("Secret key must be 32 bytes"))?;
        Ok(Keystore { node_id, public_key_hex: public_key, signing_key: SigningKey::from_bytes(&sk) })
    }
}
