import { DirectorChunk, DirectorChunkId, DirectorChunkJSON, DirectorScriptDetail, DirectorScriptDump, DirectorScriptType, ReadInput } from ".";
import { loadProjectorRays, type ProjectorRaysLoaderOptions, type ProjectorRaysModule } from "./loader";
import { fourCCToString } from "./util/fourCCToString";
import { normalizeFourCC } from "./util/normalizeFourCC";
import { toUint8Array } from "./util/toUint8Array";

function assertWasmModule(module: ProjectorRaysModule): asserts module is Required<ProjectorRaysModule> {
    if (!module.cwrap || !module.HEAPU8 || !module.HEAPU32 || !module._malloc || !module._free) {
        throw new Error("ProjectorRays WASM module is missing required exports.");
    }
}

export abstract class DirectorFileBase {

    #input: Uint8Array;
    #handle: number | null;
    #destroyed: boolean;
    #module: ProjectorRaysModule;

    protected constructor(
        _module: ProjectorRaysModule,
        _input: ReadInput
    ) {
        this.#module = _module;
        this.#input = toUint8Array(_input);
        this.#handle = null;
        this.#destroyed = false;

        if (!this.#read()) {
            throw new Error("Failed to read DirectorFile");
        }
    }

    protected static async loadModule(options: ProjectorRaysLoaderOptions): Promise<ProjectorRaysModule> {
        return loadProjectorRays(options);
    }

    #read(): boolean {
        this.#releaseHandle();
        if (!this.#input.length) {
            return false;
        }

        assertWasmModule(this.#module);
        const readHandle = this.#module.cwrap("projectorrays_read", "number", ["number", "number"]);
        const inputPtr = this.#module._malloc(this.#input.length);
        try {
            this.#module.HEAPU8.set(this.#input, inputPtr);
            const handle = readHandle(inputPtr, this.#input.length) as number;
            if (!handle) {
                return false;
            }
            this.#handle = handle;
            return true;
        } finally {
            this.#module._free(inputPtr);
        }
    }

    /**
     * Check whether a chunk exists by fourCC at an id.
     * fourCC can be a 4-character string (e.g. "CASt") or a numeric code.
     * @returns `true` if the chunk exists, `false` otherwise.
     */
    chunkExists(fourCC: number | string, id: DirectorChunkId): boolean {
        this.#ensureHandle("chunkExists");
        assertWasmModule(this.#module);
        const fourCCValue = normalizeFourCC(fourCC);
        const func = this.#module.cwrap("projectorrays_chunk_exists", "number", [
            "number",
            "number",
            "number",
        ]);
        return Boolean(func(this.#handle, fourCCValue, id));
    }

    /**
     * Fetch a chunk by fourCC and id, returning raw bytes.
     * fourCC can be a 4-character string (e.g. "CASt") or a numeric code.
     * @returns a `DirectorChunk` object or `null` if the chunk does not exist.
     */
    getChunk(fourCC: number | string, id: DirectorChunkId): DirectorChunk | null {
        this.#ensureHandle("getChunk");
        assertWasmModule(this.#module);
        const fourCCValue = normalizeFourCC(fourCC);
        const func = this.#module.cwrap("projectorrays_get_chunk", "number", [
            "number",
            "number",
            "number",
            "number",
        ]);
        const sizePtr = this.#module._malloc(4);

        let outputPtr = 0;
        try {
            this.#module.HEAPU32[sizePtr >> 2] = 0;
            outputPtr = func(this.#handle, fourCCValue, id, sizePtr) as number;
            const outputSize = this.#module.HEAPU32[sizePtr >> 2];
            if (!outputPtr) {
                return null;
            }
            const data = this.#module.HEAPU8.slice(outputPtr, outputPtr + outputSize);
            return {
                fourCC: fourCCToString(fourCCValue),
                id,
                data,
            };
        } finally {
            if (outputPtr) {
                const free = this.#module.cwrap("projectorrays_free", null, ["number"]);
                free(outputPtr);
            }
            this.#module._free(sizePtr);
        }
    }

    /**
     * Fetch a specific script entry by script id.
     * @returns a script detail object.
     */
    getScript(id: DirectorChunkId): DirectorScriptDetail | null {
        this.#ensureHandle("getScript");
        assertWasmModule(this.#module);
        const func = this.#module.cwrap("projectorrays_get_script", "number", [
            "number",
            "number",
            "number",
        ]);
        const sizePtr = this.#module._malloc(4);

        let outputPtr = 0;
        try {
            this.#module.HEAPU32[sizePtr >> 2] = 0;
            outputPtr = func(this.#handle, id, sizePtr) as number;
            const outputSize = this.#module.HEAPU32[sizePtr >> 2];
            if (!outputPtr) {
                return null;
            }
            const text = new TextDecoder("utf-8").decode(
                this.#module.HEAPU8.slice(outputPtr, outputPtr + outputSize)
            );
            const decoded = JSON.parse(text) as {
                scriptId?: number;
                memberId?: number;
                memberName?: string;
                scriptType?: string;
                lingo?: string;
                bytecode?: string;
                castName?: string;
            };
            return this.#normalizeScriptDetail(decoded);
        } finally {
            if (outputPtr) {
                const free = this.#module.cwrap("projectorrays_free", null, ["number"]);
                free(outputPtr);
            }
            this.#module._free(sizePtr);
        }
    }

    /**
     * Return the total file size in bytes.
     * @returns the total file size in bytes.
     */
    size(): number {
        this.#ensureHandle("size");
        assertWasmModule(this.#module);
        const func = this.#module.cwrap("projectorrays_size", "number", ["number"]);
        return func(this.#handle) as number;
    }

    /**
     * Write an unprotected version of the file to a buffer.
     * @returns a buffer containing the unprotected file contents.
     */
    writeToBuffer(): Uint8Array {
        this.#ensureHandle("writeToBuffer");
        return this.#callHandle("projectorrays_implemented_write_to_buffer");
    }

    /**
     * Dump script metadata, source, and bytecode.
     * @returns a script dump object.
     */
    dumpScripts(): DirectorScriptDump {
        this.#ensureHandle("dumpScripts");
        const output = this.#callHandle("projectorrays_implemented_dump_scripts");
        const decoded = JSON.parse(new TextDecoder("utf-8").decode(output)) as {
            isCast?: number | boolean;
            version?: number;
            casts?: Array<{
                name?: string;
                scripts?: Array<{
                    scriptId?: number;
                    memberId?: number;
                    memberName?: string;
                    scriptType?: string;
                    lingo?: string;
                    bytecode?: string;
                }>;
            }>;
        };
        return this.#normalizeScriptDump(decoded);
    }

    /**
     * Dump all chunks as raw bytes.
     * @returns an array of chunk objects.
     */
    dumpChunks(): DirectorChunk[] {
        this.#ensureHandle("dumpChunks");
        const output = this.#callHandle("projectorrays_implemented_dump_chunks");
        return this.#decodeChunkDump(output);
    }

    /**
     * Dump all chunks as JSON if they're available.
     * @returns an array of chunk JSON objects.
     */
    dumpJSON(): DirectorChunkJSON[] {
        this.#ensureHandle("dumpJSON");
        const output = this.#callHandle("projectorrays_implemented_dump_json");
        const decoded = JSON.parse(new TextDecoder("utf-8").decode(output));
        return this.#normalizeChunkJSONDump(
            Array.isArray(decoded) ? decoded : []
        );
    }

    /**
     * Return whether the file is a cast.
     * @returns `true` if the file is a cast, `false` otherwise.
     */
    isCast(): boolean {
        this.#ensureHandle("isCast");
        assertWasmModule(this.#module);
        const func = this.#module.cwrap("projectorrays_is_cast", "number", ["number"]);
        return Boolean(func(this.#handle));
    }

    /**
     * Release WASM resources and free up memory. You cannot use this instance afterwards.
     */
    destroy(): void {
        if (this.#destroyed) {
            return;
        }
        this.#releaseHandle();
        this.#destroyed = true;
    }

    #ensureHandle(methodName: string): void {
        if (this.#destroyed) {
            throw new Error(`DirectorFile.${methodName} was called after destroy().`);
        }
        if (!this.#handle) {
            throw new Error(`DirectorFile.${methodName} requires a valid handle, we did not read?`);
        }
    }

    #callHandle(
        name:
            | "projectorrays_implemented_write_to_buffer"
            | "projectorrays_implemented_dump_scripts"
            | "projectorrays_implemented_dump_chunks"
            | "projectorrays_implemented_dump_json"
    ): Uint8Array {
        assertWasmModule(this.#module);
        if (!this.#handle) {
            throw new Error(`WASM call failed (no handle): ${name}`);
        }
        const cwrap = this.#module.cwrap;
        const func = cwrap(name, "number", ["number", "number"]);
        const sizePtr = this.#module._malloc(4);

        let outputPtr = 0;
        try {
            this.#module.HEAPU32[sizePtr >> 2] = 0;
            outputPtr = func(this.#handle, sizePtr) as number;
            const outputSize = this.#module.HEAPU32[sizePtr >> 2];
            if (!outputPtr || outputSize === 0) {
                throw new Error(`WASM call failed (no outputPtr or outputSize): ${name}`);
            }
            return this.#module.HEAPU8.slice(outputPtr, outputPtr + outputSize);
        } finally {
            if (outputPtr) {
                const free = this.#module.cwrap("projectorrays_free", null, ["number"]);
                free(outputPtr);
            }
            this.#module._free(sizePtr);
        }
    }

    #decodeChunkDump(output: Uint8Array): DirectorChunk[] {
        const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
        let offset = 0;
        if (view.byteLength < 4) {
            throw new Error("Invalid chunk dump (missing count).");
        }
        const count = view.getUint32(offset, true);
        offset += 4;
        const chunks: DirectorChunk[] = [];
        for (let i = 0; i < count; i += 1) {
            if (offset + 12 > view.byteLength) {
                throw new Error("Invalid chunk dump (truncated header).");
            }
            const fourCCValue = view.getUint32(offset, true);
            offset += 4;
            const id = view.getInt32(offset, true);
            offset += 4;
            const size = view.getUint32(offset, true);
            offset += 4;
            if (offset + size > view.byteLength) {
                throw new Error("Invalid chunk dump (truncated data).");
            }
            const data = output.slice(offset, offset + size);
            offset += size;
            const fourCC = fourCCToString(fourCCValue);
            chunks.push({ fourCC, id, data });
        }
        return chunks;
    }

    #normalizeScriptDump(input: {
        isCast?: number | boolean;
        version?: number;
        casts?: Array<{
            name?: string;
            scripts?: Array<{
                scriptId?: number;
                memberId?: number;
                memberName?: string;
                scriptType?: string;
                lingo?: string;
                bytecode?: string;
            }>;
        }>;
    }): DirectorScriptDump {
        const allowedTypes: ReadonlySet<DirectorScriptType> = new Set([
            "BehaviorScript",
            "ScoreScript",
            "MovieScript",
            "ParentScript",
            "CastScript",
            "UnknownScript",
        ]);
        const casts = (input.casts ?? []).map((cast) => {
            const scripts = (cast.scripts ?? []).map((script) => {
                const scriptType = allowedTypes.has(script.scriptType as DirectorScriptType)
                    ? (script.scriptType as DirectorScriptType)
                    : "UnknownScript";
                return {
                    scriptId: Number(script.scriptId ?? 0),
                    memberId: Number(script.memberId ?? 0),
                    memberName: String(script.memberName ?? ""),
                    scriptType,
                    lingo: String(script.lingo ?? ""),
                    bytecode: String(script.bytecode ?? ""),
                };
            });
            return {
                name: String(cast.name ?? ""),
                scripts,
            };
        });
        return {
            isCast: Boolean(input.isCast),
            version: Number(input.version ?? 0),
            casts,
        };
    }

    #normalizeScriptDetail(input: {
        scriptId?: number;
        memberId?: number;
        memberName?: string;
        scriptType?: string;
        lingo?: string;
        bytecode?: string;
        castName?: string;
    }): DirectorScriptDetail {
        const allowedTypes: ReadonlySet<DirectorScriptType> = new Set([
            "BehaviorScript",
            "ScoreScript",
            "MovieScript",
            "ParentScript",
            "CastScript",
            "UnknownScript",
        ]);
        const scriptType = allowedTypes.has(input.scriptType as DirectorScriptType)
            ? (input.scriptType as DirectorScriptType)
            : "UnknownScript";
        return {
            scriptId: Number(input.scriptId ?? 0),
            memberId: Number(input.memberId ?? 0),
            memberName: String(input.memberName ?? ""),
            scriptType,
            lingo: String(input.lingo ?? ""),
            bytecode: String(input.bytecode ?? ""),
            castName: String(input.castName ?? ""),
        };
    }

    #normalizeChunkJSONDump(
        input: Array<{
            fourCC?: string;
            id?: DirectorChunkId;
            data?: unknown;
        }>
    ): DirectorChunkJSON[] {
        return (input ?? []).map((entry) => ({
            fourCC: String(entry.fourCC ?? ""),
            id: Number(entry.id ?? 0),
            data: entry.data ?? null,
        }));
    }

    #releaseHandle(): void {
        if (!this.#handle) {
            return;
        }
        assertWasmModule(this.#module);
        const freeHandle = this.#module.cwrap("projectorrays_free_handle", null, ["number"]);
        freeHandle(this.#handle);
        this.#handle = null;
    }
}
