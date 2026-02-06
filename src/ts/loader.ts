export type ProjectorRaysModule = {
    cwrap?: (
        name: string,
        returnType: string | null,
        argTypes?: string[]
    ) => (...args: unknown[]) => unknown;
    ccall?: (
        name: string,
        returnType: string | null,
        argTypes: string[],
        args: unknown[]
    ) => unknown;
    HEAPU8?: Uint8Array;
    HEAPU32?: Uint32Array;
    _malloc?: (size: number) => number;
    _free?: (ptr: number) => void;
    ready?: Promise<void>;
    [key: string]: unknown;
};

export type ProjectorRaysLoaderOptions = {
    glueUrl?: string;
    wasmUrl?: string;
    wasmBinary?: Uint8Array | ArrayBuffer;
    locateFile?: (path: string, prefix: string) => string;
    useScriptTag?: boolean;
};

const defaultGlueUrl = (isNode: boolean) =>
    new URL(
        isNode ? "../../dist/projectorrays.cjs" : "../../dist/projectorrays.js",
        import.meta.url
    ).href;

const defaultWasmUrl = () =>
    new URL("../../dist/projectorrays.wasm", import.meta.url).href;

function normalizeGlueUrl(glueUrl: string, isNode: boolean): string {
    if (!isNode) {
        return glueUrl;
    }
    if (glueUrl.endsWith(".cjs")) {
        return glueUrl;
    }
    try {
        const url = new URL(glueUrl);
        if (url.pathname.endsWith(".js")) {
            url.pathname = url.pathname.replace(/\.js$/, ".cjs");
            return url.href;
        }
    } catch {
        // fallback
    }
    return glueUrl.endsWith(".js") ? glueUrl.replace(/\.js$/, ".cjs") : glueUrl;
}

async function loadGlue(
    glueUrl: string,
    isNode: boolean,
    useScriptTag: boolean
): Promise<ProjectorRaysModule | undefined> {
    if (isNode) {
        const { createRequire } = await import("node:module");
        const { fileURLToPath } = await import("node:url");
        const require = createRequire(import.meta.url);
        const normalized = normalizeGlueUrl(glueUrl, isNode);
        if (normalized.startsWith("file:")) {
            return require(fileURLToPath(normalized)) as ProjectorRaysModule;
        }
        return require(normalized) as ProjectorRaysModule;
    }

    const shouldUseScriptTag =
        useScriptTag || glueUrl.startsWith("data:text/javascript");

    if (shouldUseScriptTag) {
        const globalState = globalThis as {
            __projectorraysGluePromises?: Map<string, Promise<void>>;
        };
        if (!globalState.__projectorraysGluePromises) {
            globalState.__projectorraysGluePromises = new Map();
        }
        const existingPromise = globalState.__projectorraysGluePromises.get(glueUrl);
        if (existingPromise) {
            await existingPromise;
            return undefined;
        }

        if (typeof document !== "undefined") {
            const existing = document.querySelector(`script[src="${glueUrl}"]`);
            if (existing) {
                return undefined;
            }
            const loadPromise = new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.async = true;
                script.src = glueUrl;
                script.onload = () => resolve();
                script.onerror = () =>
                    reject(new Error(`Failed to load glue script: ${glueUrl}`));
                document.head.appendChild(script);
            });
            globalState.__projectorraysGluePromises.set(glueUrl, loadPromise);
            try {
                await loadPromise;
            } catch (error) {
                globalState.__projectorraysGluePromises.delete(glueUrl);
                throw error;
            }
            return undefined;
        }
        const globalImportScripts = (
            globalThis as { importScripts?: (url: string) => void }
        ).importScripts;
        if (typeof globalImportScripts === "function") {
            const loadPromise = Promise.resolve().then(() => {
                globalImportScripts(glueUrl);
            });
            globalState.__projectorraysGluePromises.set(glueUrl, loadPromise);
            await loadPromise;
            return undefined;
        }
    }

    await import(/* @vite-ignore */ glueUrl);
    return undefined;
}

export async function loadProjectorRays(
    options: ProjectorRaysLoaderOptions = {}
): Promise<ProjectorRaysModule> {
    const globalState = globalThis as {
        Module?: ProjectorRaysModule;
        __projectorraysLoadPromise?: Promise<ProjectorRaysModule>;
    };
    if (globalState.__projectorraysLoadPromise) {
        return globalState.__projectorraysLoadPromise;
    }

    const loadPromise = (async () => {
        const existingModule = globalState.Module;
        if (
            existingModule?.cwrap &&
            existingModule.HEAPU8 &&
            existingModule.HEAPU32 &&
            existingModule._malloc &&
            existingModule._free
        ) {
            if (existingModule.ready) {
                await existingModule.ready;
            }
            return existingModule;
        }

        const isNode =
            typeof process !== "undefined" &&
            !!(process as { versions?: { node?: string } }).versions?.node;
        const glueUrl = options.glueUrl ?? defaultGlueUrl(isNode);
        const wasmUrl = options.wasmUrl ?? defaultWasmUrl();
        const wasmBinary =
            options.wasmBinary instanceof Uint8Array
                ? options.wasmBinary
                : options.wasmBinary
                    ? new Uint8Array(options.wasmBinary)
                    : undefined;

        const locateFile =
            options.locateFile ??
            ((path: string, prefix: string) => {
                if (path.endsWith(".wasm")) {
                    return wasmUrl;
                }
                return `${prefix}${path}`;
            });

        globalState.Module = {
            ...(globalState.Module ?? {}),
            locateFile,
            ...(wasmBinary ? { wasmBinary } : {}),
        };

        const loadedModule = await loadGlue(
            glueUrl,
            isNode,
            options.useScriptTag ?? false
        );

        const module = loadedModule ?? globalState.Module;
        if (!module) {
            throw new Error("ProjectorRays WASM module did not initialize.");
        }

        globalState.Module = module;

        if (module.ready) {
            await module.ready;
        } else if (!module.cwrap || !module.HEAPU8 || !module.HEAPU32 || !module._malloc || !module._free) {
            await new Promise<void>((resolve) => {
                const previous = module.onRuntimeInitialized as (() => void) | undefined;
                module.onRuntimeInitialized = () => {
                    previous?.();
                    resolve();
                };
            });
        }

        const globalHeapU8 = (globalThis as unknown as { HEAPU8?: Uint8Array }).HEAPU8;
        if (!module.HEAPU8 && globalHeapU8) {
            module.HEAPU8 = globalHeapU8;
        }
        const globalHeapU32 = (globalThis as unknown as { HEAPU32?: Uint32Array }).HEAPU32;
        if (!module.HEAPU32 && globalHeapU32) {
            module.HEAPU32 = globalHeapU32;
        }

        return module;
    })();

    globalState.__projectorraysLoadPromise = loadPromise;
    try {
        return await loadPromise;
    } catch (error) {
        delete globalState.__projectorraysLoadPromise;
        throw error;
    }
}
