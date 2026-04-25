mod crypto;
mod blocklattice;
mod tap;
mod node;

pub use crypto::Keystore;
pub use blocklattice::Block;
pub use tap::EntropyPool;
pub use node::Node;

/// Get current timestamp in milliseconds.
/// Uses js_sys::Date on wasm32, SystemTime on native.
#[cfg(target_arch = "wasm32")]
pub fn now_ms() -> i64 {
    js_sys::Date::now() as i64
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(target_arch = "wasm32")]
mod wasm_bind;

#[cfg(target_arch = "wasm32")]
pub use wasm_bind::*;

#[cfg(not(target_arch = "wasm32"))]
pub mod native;
