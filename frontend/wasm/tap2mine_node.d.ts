/* tslint:disable */
/* eslint-disable */

/**
 * Wasm wrapper around the core Node.
 * The native Node has no wasm_bindgen attributes; this struct bridges them.
 */
export class WasmNode {
    free(): void;
    [Symbol.dispose](): void;
    add_move(x: number, y: number): void;
    add_scroll(delta: number): void;
    add_tap(x: number, y: number): void;
    chain_len(): number;
    entropy_count(): number;
    export_chain(): string;
    export_keystore(): string;
    get_chain(start: number, limit: number): string;
    get_entropy(): string;
    info(): string;
    latest_block(): string;
    constructor();
    try_mine(): string;
    verify_block(block_json: string): boolean;
}

export function create_node(): WasmNode;

export function init_wasm(): void;

export function load_node(keystore_json: string, chain_json: string): WasmNode;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmnode_free: (a: number, b: number) => void;
    readonly create_node: () => number;
    readonly init_wasm: () => void;
    readonly load_node: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasmnode_add_move: (a: number, b: number, c: number) => void;
    readonly wasmnode_add_scroll: (a: number, b: number) => void;
    readonly wasmnode_add_tap: (a: number, b: number, c: number) => void;
    readonly wasmnode_chain_len: (a: number) => number;
    readonly wasmnode_entropy_count: (a: number) => number;
    readonly wasmnode_export_chain: (a: number) => [number, number];
    readonly wasmnode_export_keystore: (a: number) => [number, number];
    readonly wasmnode_get_chain: (a: number, b: number, c: number) => [number, number];
    readonly wasmnode_get_entropy: (a: number) => [number, number];
    readonly wasmnode_info: (a: number) => [number, number];
    readonly wasmnode_latest_block: (a: number) => [number, number];
    readonly wasmnode_try_mine: (a: number) => [number, number];
    readonly wasmnode_verify_block: (a: number, b: number, c: number) => number;
    readonly wasmnode_new: () => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
