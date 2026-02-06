import { createRequire } from "node:module";
import { type ProjectorRaysLoaderOptions } from "./loader";
import { DirectorFileBase, type ReadInput } from "./director-file-base";

const require = createRequire(import.meta.url);

export class DirectorFile extends DirectorFileBase {
    static async read(
        input: ReadInput,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const module = await DirectorFileBase.loadModule(options);
        const dir = new DirectorFile(module, input);
        return dir;
    }

    static async readFromPath(
        path: string,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const { readFile } = await import("node:fs/promises");
        const data = await readFile(path);
        return DirectorFile.read(data, options);
    }

    writeToFile(path: string): void {
        const data = this.writeToBuffer();
        const { writeFileSync } = require("node:fs") as typeof import("node:fs");
        writeFileSync(path, data);
    }
}
