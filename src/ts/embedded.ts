import {
    loadProjectorRays,
    type ProjectorRaysLoaderOptions,
    type ProjectorRaysModule,
} from "./loader";
import { DirectorFileBase, type ReadInput } from "./director-file-base";

const defaultEmbeddedGlueUrl = new URL(
    "../../dist/projectorrays.single.js",
    import.meta.url
).href;

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
    static async read(
        input: ReadInput,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const module = await loadProjectorRaysEmbedded(options);
        const dir = new DirectorFile(module, input);
        return dir;
    }
}
