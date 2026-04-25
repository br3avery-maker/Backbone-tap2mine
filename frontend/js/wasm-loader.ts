// Minimal Wasm loader for tap2mine_node.wasm
// This replaces the wasm-pack glue — loads raw .wasm and wraps the exports

let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

// String passing between JS and Wasm (wasm-bindgen convention)
const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

function getString(ptr: number, len: number): string {
  const buf = new Uint8Array(wasmMemory!.buffer, ptr, len);
  return utf8Decoder.decode(buf);
}

function passStringToWasm(str: string): number {
  const encoded = utf8Encoder.encode(str);
  const ptr = wasmExports!.__wbindgen_malloc(encoded.length);
  const mem = new Uint8Array(wasmMemory!.buffer, ptr, encoded.length);
  mem.set(encoded);
  return ptr;
}

function freeString(ptr: number, len: number) {
  wasmExports!.__wbindgen_free(ptr, len);
}

// Wasm exports (populated after init)
let wasmExports: WebAssembly.Exports | null = null;

export async function init(): Promise<void> {
  const response = await fetch('/wasm/tap2mine_node.wasm');
  const bytes = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {},
    "./tap2mine_node.js": {
      __wbindgen_object_drop_ref: () => {},
      __wbindgen_throw: (ptr: number, len: number) => {
        throw new Error(getString(ptr, len));
      },
    },
  });
  wasmInstance = instance;
  wasmMemory = instance.exports.memory as WebAssembly.Memory;
  wasmExports = instance.exports;
}

// --- Exported Wasm functions ---

// The Rust Node struct is represented as an index into the Wasm heap
type NodePtr = number;

export function create_node(): NodePtr {
  return wasmExports!.create_node() as number;
}

export function load_node(keystoreJson: string, chainJson: string): NodePtr {
  const ptr1 = passStringToWasm(keystoreJson);
  const len1 = new TextEncoder().encode(keystoreJson).length;
  const ptr2 = passStringToWasm(chainJson);
  const len2 = new TextEncoder().encode(chainJson).length;
  return wasmExports!.load_node(ptr1, len1, ptr2, len2) as number;
}

// Node methods — these call the wasm-bindgen generated functions
export const nodeInfo = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_info'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeGetChain = (ptr: NodePtr, start: number, limit: number) => {
  const ret = wasmExports!['Node_get_chain'](ptr, start, limit);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeAddTap = (ptr: NodePtr, x: number, y: number) => {
  wasmExports!['Node_add_tap'](ptr, x, y);
};

export const nodeAddMove = (ptr: NodePtr, x: number, y: number) => {
  wasmExports!['Node_add_move'](ptr, x, y);
};

export const nodeAddScroll = (ptr: NodePtr, delta: number) => {
  wasmExports!['Node_add_scroll'](ptr, delta);
};

export const nodeTryMine = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_try_mine'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeGetEntropy = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_get_entropy'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeEntropyCount = (ptr: NodePtr) => {
  return wasmExports!['Node_entropy_count'](ptr) as number;
};

export const nodeChainLen = (ptr: NodePtr) => {
  return wasmExports!['Node_chain_len'](ptr) as number;
};

export const nodeExportKeystore = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_export_keystore'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeVerifyBlock = (ptr: NodePtr, blockJson: string) => {
  const strPtr = passStringToWasm(blockJson);
  const strLen = new TextEncoder().encode(blockJson).length;
  const result = wasmExports!['Node_verify_block'](ptr, strPtr, strLen);
  freeString(strPtr, strLen);
  return !!result;
};

export const nodeLatestBlock = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_latest_block'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};

export const nodeExportChain = (ptr: NodePtr) => {
  const ret = wasmExports!['Node_export_chain'](ptr);
  return getString(ret[0] as number, ret[1] as number);
};
