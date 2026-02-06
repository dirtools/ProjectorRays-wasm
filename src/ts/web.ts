import { type ProjectorRaysLoaderOptions } from "./loader";
import { DirectorFileBase, type ReadInput } from "./director-file-base";

export class DirectorFile extends DirectorFileBase {
    static async read(
        input: ReadInput,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const module = await DirectorFileBase.loadModule(options);
        const dir = new DirectorFile(module, input);
        return dir;
    }
}
