/* tslint:disable */
/* eslint-disable */

/**
 * Get version information
 */
export function get_version(): string;

export function init(): void;

export function read_manifest_store(file_bytes: Uint8Array, format: string, settings_json?: string | null): Promise<string>;

/**
 * Inspect a detached (`.c2pa`) manifest store without an asset.
 *
 * Used when the user drops a sidecar without the matching asset. We feed
 * the manifest bytes to `with_manifest_data_and_stream_async` paired with
 * an empty stream. The signature, certificate chain, and JUMBF structure
 * are validated normally; the asset-hash bindings will report
 * `assertion.dataHash.mismatch` because there is no asset to bind to —
 * that is expected, and callers should label this as an integrity-only
 * inspection in the UI.
 *
 * * `manifest_bytes` - raw bytes of the `.c2pa` sidecar (JUMBF manifest store).
 * * `settings_json` - trust settings (same shape as `read_manifest_store`).
 */
export function read_sidecar_integrity_only(manifest_bytes: Uint8Array, settings_json?: string | null): Promise<string>;

/**
 * Validate a detached (`.c2pa`) manifest store against its referenced asset.
 *
 * This is the sidecar-with-asset case: the C2PA manifest lives in its own file
 * (`manifest_bytes`) and the asset whose hash-bindings the manifest claims
 * lives separately (`asset_bytes`). We feed both into c2pa-rs's
 * `with_manifest_data_and_stream_async`, which evaluates the asset-hash
 * assertions *against the actual asset bytes* — something we cannot do with
 * the single-blob `read_manifest_store` path.
 *
 * * `manifest_bytes` - raw bytes of the `.c2pa` sidecar (JUMBF manifest store).
 * * `asset_bytes` - raw bytes of the referenced asset.
 * * `asset_format` - MIME type of the asset (e.g. "image/jpeg"). The
 *   sidecar's own format is always `application/c2pa` and the SDK infers that.
 * * `settings_json` - trust settings (same shape as `read_manifest_store`).
 */
export function read_sidecar_manifest_store(manifest_bytes: Uint8Array, asset_bytes: Uint8Array, asset_format: string, settings_json?: string | null): Promise<string>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly init: () => void;
    readonly read_manifest_store: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly read_sidecar_manifest_store: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => any;
    readonly read_sidecar_integrity_only: (a: number, b: number, c: number, d: number) => any;
    readonly get_version: () => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h1aa715c00eec31bd: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h0ef758fe9ac3980a: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h2b3ed67cbe4afe0c: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
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
