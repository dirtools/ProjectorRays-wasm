import {
    loadProjectorRays,
    type ProjectorRaysLoaderOptions,
    type ProjectorRaysModule,
} from "./loader";
import { DirectorFileBase } from "./director-file-base";
import { ReadInput } from ".";

const defaultEmbeddedGlueUrl = new URL(
    "../../dist/projectorrays.single.js",
    import.meta.url
).href;

/**
 * Load the WASM module using the embedded single-file build.
 */
export async function loadProjectorRaysEmbedded(
    options: ProjectorRaysLoaderOptions = {}
): Promise<ProjectorRaysModule> {
    return loadProjectorRays({
        ...options,
        useScriptTag: options.useScriptTag ?? true,
        glueUrl: options.glueUrl ?? defaultEmbeddedGlueUrl,
    });
}

export class DirectorFile extends DirectorFileBase {
    /**
     * Read a Director file from a buffer.
     */
    static async read(
        input: ReadInput,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const module = await loadProjectorRaysEmbedded(options);
        const dir = new DirectorFile(module, input);
        return dir;
    }
}
