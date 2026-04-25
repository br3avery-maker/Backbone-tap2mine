/* tslint:disable */
/* eslint-disable */

export class Block {
    free(): void;
    [Symbol.dispose](): void;
    static from_json(json: string): Block;
    static from_prev(prev: Block, ks: Keystore, seed: string): Block;
    hash(): string;
    constructor();
    node_id(): string;
    prev_hash(): string;
    seed(): string;
    sequence(): bigint;
    signature(): string;
    timestamp(): bigint;
    to_json(): string;
}

/**
 * Collects user interaction entropy and derives block seeds
 */
export class EntropyPool {
    free(): void;
    [Symbol.dispose](): void;
    add_move(x: number, y: number): void;
    add_scroll(delta: number): void;
    add_tap(x: number, y: number): void;
    count(): number;
    /**
     * Returns JSON: {"seed": "hex...", "ready": bool}
     */
    derive_seed(): string;
    constructor();
    reset(): void;
}

export class Keystore {
    free(): void;
    [Symbol.dispose](): void;
    static from_json(json: string): Keystore;
    constructor();
    node_id(): string;
    public_key(): string;
    sign(message: Uint8Array): string;
    to_json(): string;
    verify(message: Uint8Array, sig_hex: string): boolean;
}

export class Node {
    free(): void;
    [Symbol.dispose](): void;
    add_move(x: number, y: number): void;
    add_scroll(delta: number): void;
    add_tap(x: number, y: number): void;
    chain_len(): number;
    entropy_count(): number;
    export_chain(): string;
    export_keystore(): string;
    static from_data(keystore_json: string, chain_json: string): Node;
    get_chain(start: number, limit: number): string;
    get_entropy(): string;
    /**
     * Returns JSON: {node_id, public_key, chain_len, genesis_hash, latest_hash}
     */
    info(): string;
    latest_block(): string;
    constructor();
    /**
     * If enough entropy accumulated, produce a new block and return its JSON.
     * Returns empty string if not ready.
     */
    try_mine(): string;
    verify_block(block_json: string): boolean;
}

export function create_node(): Node;

export function init(): void;

export function load_node(keystore_json: string, chain_json: string): Node;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly create_node: () => number;
    readonly init: () => void;
    readonly load_node: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly __wbg_block_free: (a: number, b: number) => void;
    readonly block_from_json: (a: number, b: number) => [number, number, number];
    readonly block_from_prev: (a: number, b: number, c: number, d: number) => number;
    readonly block_hash: (a: number) => [number, number];
    readonly block_new: () => number;
    readonly block_node_id: (a: number) => [number, number];
    readonly block_prev_hash: (a: number) => [number, number];
    readonly block_seed: (a: number) => [number, number];
    readonly block_sequence: (a: number) => bigint;
    readonly block_signature: (a: number) => [number, number];
    readonly block_timestamp: (a: number) => bigint;
    readonly block_to_json: (a: number) => [number, number];
    readonly __wbg_node_free: (a: number, b: number) => void;
    readonly node_add_move: (a: number, b: number, c: number) => void;
    readonly node_add_scroll: (a: number, b: number) => void;
    readonly node_add_tap: (a: number, b: number, c: number) => void;
    readonly node_chain_len: (a: number) => number;
    readonly node_entropy_count: (a: number) => number;
    readonly node_export_chain: (a: number) => [number, number];
    readonly node_export_keystore: (a: number) => [number, number];
    readonly node_from_data: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly node_get_chain: (a: number, b: number, c: number) => [number, number];
    readonly node_get_entropy: (a: number) => [number, number];
    readonly node_info: (a: number) => [number, number];
    readonly node_latest_block: (a: number) => [number, number];
    readonly node_new: () => number;
    readonly node_try_mine: (a: number) => [number, number];
    readonly node_verify_block: (a: number, b: number, c: number) => number;
    readonly __wbg_entropypool_free: (a: number, b: number) => void;
    readonly entropypool_add_move: (a: number, b: number, c: number) => void;
    readonly entropypool_add_scroll: (a: number, b: number) => void;
    readonly entropypool_add_tap: (a: number, b: number, c: number) => void;
    readonly entropypool_count: (a: number) => number;
    readonly entropypool_derive_seed: (a: number) => [number, number];
    readonly entropypool_new: () => number;
    readonly entropypool_reset: (a: number) => void;
    readonly __wbg_keystore_free: (a: number, b: number) => void;
    readonly keystore_from_json: (a: number, b: number) => [number, number, number];
    readonly keystore_new: () => number;
    readonly keystore_node_id: (a: number) => [number, number];
    readonly keystore_public_key: (a: number) => [number, number];
    readonly keystore_sign: (a: number, b: number, c: number) => [number, number];
    readonly keystore_to_json: (a: number) => [number, number];
    readonly keystore_verify: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
