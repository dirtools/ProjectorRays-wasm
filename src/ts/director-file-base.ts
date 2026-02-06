import { loadProjectorRays, type ProjectorRaysLoaderOptions, type ProjectorRaysModule } from "./loader";

export type ReadInput = Uint8Array | ArrayBuffer;
export type DirectorChunk = {
    fourCC: string;
    id: number;
    data: Uint8Array;
};
export type DirectorChunkJSON<T = unknown> = {
    fourCC: string;
    id: number;
    data: T;
};

export type DirectorScriptType =
    | "BehaviorScript"
    | "ScoreScript"
    | "MovieScript"
    | "ParentScript"
    | "CastScript"
    | "UnknownScript";

export type DirectorScriptEntry = {
    scriptId: number;
    memberId: number;
    memberName: string;
    scriptType: DirectorScriptType;
    lingo: string;
    bytecode: string;
};

export type DirectorScriptDetail = DirectorScriptEntry & {
    castName: string;
};

export type DirectorScriptCast = {
    name: string;
    scripts: DirectorScriptEntry[];
};


export type DirectorScriptDump = {
    isCast: boolean;
    version: number;
    casts: DirectorScriptCast[];
};

function toUint8Array(input: ReadInput): Uint8Array {
    return input instanceof Uint8Array ? input : new Uint8Array(input);
}

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

    chunkExists(fourCC: number | string, id: number): boolean {
        this.#ensureHandle("chunkExists");
        assertWasmModule(this.#module);
        const fourCCValue = this.#normalizeFourCC(fourCC);
        const func = this.#module.cwrap("projectorrays_chunk_exists", "number", [
            "number",
            "number",
            "number",
        ]);
        return Boolean(func(this.#handle, fourCCValue, id));
    }

    getChunk(fourCC: number | string, id: number): DirectorChunk | null {
        this.#ensureHandle("getChunk");
        assertWasmModule(this.#module);
        const fourCCValue = this.#normalizeFourCC(fourCC);
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
            return { fourCC: this.#fourCCToString(fourCCValue), id, data };
        } finally {
            if (outputPtr) {
                const free = this.#module.cwrap("projectorrays_free", null, ["number"]);
                free(outputPtr);
            }
            this.#module._free(sizePtr);
        }
    }

    getScript(id: number): DirectorScriptDetail | null {
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

    size(): number {
        this.#ensureHandle("size");
        assertWasmModule(this.#module);
        const func = this.#module.cwrap("projectorrays_size", "number", ["number"]);
        return func(this.#handle) as number;
    }

    writeToBuffer(): Uint8Array {
        this.#ensureHandle("writeToBuffer");
        return this.#callHandle("projectorrays_implemented_write_to_buffer");
    }

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

    dumpChunks(): DirectorChunk[] {
        this.#ensureHandle("dumpChunks");
        const output = this.#callHandle("projectorrays_implemented_dump_chunks");
        return this.#decodeChunkDump(output);
    }

    dumpJSON(): DirectorChunkJSON[] {
        this.#ensureHandle("dumpJSON");
        const output = this.#callHandle("projectorrays_implemented_dump_json");
        const decoded = JSON.parse(new TextDecoder("utf-8").decode(output));
        return this.#normalizeChunkJSONDump(
            Array.isArray(decoded) ? decoded : []
        );
    }

    isCast(): boolean {
        this.#ensureHandle("isCast");
        assertWasmModule(this.#module);
        const func = this.#module.cwrap("projectorrays_is_cast", "number", ["number"]);
        return Boolean(func(this.#handle));
    }

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

    #notImplemented(methodName: string): never {
        throw new Error(`DirectorFile.${methodName} is not implemented in the WASM wrapper.`);
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
            const fourCC = this.#fourCCToString(fourCCValue);
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
            id?: number;
            data?: unknown;
        }>
    ): DirectorChunkJSON[] {
        return (input ?? []).map((entry) => ({
            fourCC: String(entry.fourCC ?? ""),
            id: Number(entry.id ?? 0),
            data: entry.data ?? null,
        }));
    }

    #normalizeFourCC(fourCC: number | string): number {
        if (typeof fourCC === "number") {
            return fourCC >>> 0;
        }
        if (fourCC.length !== 4) {
            throw new Error("fourCC string must be exactly 4 characters.");
        }
        return (
            (fourCC.charCodeAt(0) << 24) |
            (fourCC.charCodeAt(1) << 16) |
            (fourCC.charCodeAt(2) << 8) |
            fourCC.charCodeAt(3)
        ) >>> 0;
    }

    #fourCCToString(fourCCValue: number): string {
        const bytes = [
            (fourCCValue >> 24) & 0xff,
            (fourCCValue >> 16) & 0xff,
            (fourCCValue >> 8) & 0xff,
            fourCCValue & 0xff,
        ];
        let out = "";
        for (const byte of bytes) {
            switch (byte) {
                case 0x22:
                    out += '\\"';
                    break;
                case 0x5c:
                    out += "\\\\";
                    break;
                case 0x08:
                    out += "\\b";
                    break;
                case 0x0c:
                    out += "\\f";
                    break;
                case 0x0a:
                    out += "\\n";
                    break;
                case 0x0d:
                    out += "\\r";
                    break;
                case 0x09:
                    out += "\\t";
                    break;
                case 0x0b:
                    out += "\\v";
                    break;
                default:
                    if (byte < 0x20 || byte > 0x7f) {
                        out += `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
                    } else {
                        out += String.fromCharCode(byte);
                    }
                    break;
            }
        }
        return out;
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
