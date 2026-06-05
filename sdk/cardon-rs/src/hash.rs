use sha2::{Digest, Sha256};

pub fn tx_hash(serialized_message: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(serialized_message);
    hasher.finalize().into()
}
