/* tslint:disable */
/* eslint-disable */

/**
 * Wasm wrapper around the core Node.
 * The core Node has no wasm_bindgen attributes; this struct bridges them.
 */
export class WasmNode {
    free(): void;
    [Symbol.dispose](): void;
    add_move(x: number, y: number): void;
    /**
     * Add a peer to known peers
     */
    add_peer(node_id: string, public_key: string): string;
    add_scroll(delta: number): void;
    add_tap(x: number, y: number): void;
    chain_len(): number;
    /**
     * Create a SEND block to send value to another node.
     * Returns the block JSON or an error message.
     */
    create_send(to_node_id: string, to_pubkey: string, amount: bigint): string;
    entropy_count(): number;
    export_chain(): string;
    export_keystore(): string;
    get_balance(): bigint;
    get_chain(start: number, limit: number): string;
    get_entropy(): string;
    get_peers(): string;
    info(): string;
    latest_block(): string;
    constructor();
    node_id(): string;
    public_key(): string;
    /**
     * Receive a SEND block from a peer and create a RECEIVE confirmation.
     * Returns the receive block JSON or an error.
     */
    receive_send(send_block_json: string): string;
    try_mine(): string;
    verify_block(block_json: string): boolean;
}

export function create_node(): WasmNode;

/**
 * Serialize the full node state into a single JSON string for file export.
 */
export function export_node(node: WasmNode): string;

/**
 * Generate a handshake link for sharing with peers.
 */
export function generate_handshake_link(node_id: string, public_key: string): string;

/**
 * Load a node from a .tap2mine file content (JSON string).
 */
export function import_node(data_json: string): WasmNode;

export function init_wasm(): void;

export function load_node(keystore_json: string, chain_json: string): WasmNode;

/**
 * Parse a tap2mine:// handshake link or QR code content.
 * Returns JSON with node_id, public_key, and optional WebRTC offer.
 */
export function parse_handshake_link(link: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmnode_free: (a: number, b: number) => void;
    readonly create_node: () => number;
    readonly export_node: (a: number) => [number, number];
    readonly generate_handshake_link: (a: number, b: number, c: number, d: number) => [number, number];
    readonly import_node: (a: number, b: number) => [number, number, number];
    readonly init_wasm: () => void;
    readonly load_node: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly parse_handshake_link: (a: number, b: number) => [number, number];
    readonly wasmnode_add_move: (a: number, b: number, c: number) => void;
    readonly wasmnode_add_peer: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wasmnode_add_scroll: (a: number, b: number) => void;
    readonly wasmnode_add_tap: (a: number, b: number, c: number) => void;
    readonly wasmnode_chain_len: (a: number) => number;
    readonly wasmnode_create_send: (a: number, b: number, c: number, d: number, e: number, f: bigint) => [number, number];
    readonly wasmnode_entropy_count: (a: number) => number;
    readonly wasmnode_export_chain: (a: number) => [number, number];
    readonly wasmnode_export_keystore: (a: number) => [number, number];
    readonly wasmnode_get_balance: (a: number) => bigint;
    readonly wasmnode_get_chain: (a: number, b: number, c: number) => [number, number];
    readonly wasmnode_get_entropy: (a: number) => [number, number];
    readonly wasmnode_get_peers: (a: number) => [number, number];
    readonly wasmnode_info: (a: number) => [number, number];
    readonly wasmnode_latest_block: (a: number) => [number, number];
    readonly wasmnode_node_id: (a: number) => [number, number];
    readonly wasmnode_public_key: (a: number) => [number, number];
    readonly wasmnode_receive_send: (a: number, b: number, c: number) => [number, number];
    readonly wasmnode_try_mine: (a: number) => [number, number];
    readonly wasmnode_verify_block: (a: number, b: number, c: number) => number;
    readonly wasmnode_new: () => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
