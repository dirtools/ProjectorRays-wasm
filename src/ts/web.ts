import { type ProjectorRaysLoaderOptions } from "./loader";
import { DirectorFileBase } from "./director-file-base";
import { ReadInput } from ".";

export class DirectorFile extends DirectorFileBase {
    /**
     * Read a Director file from a buffer.
     */
    static async read(
        input: ReadInput,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const module = await DirectorFileBase.loadModule(options);
        const dir = new DirectorFile(module, input);
        return dir;
    }
}
