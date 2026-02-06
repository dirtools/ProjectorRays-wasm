import { createRequire } from "node:module";
import { type ProjectorRaysLoaderOptions } from "./loader";
import { DirectorFileBase } from "./director-file-base";
import { ReadInput } from ".";

const require = createRequire(import.meta.url);

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

    /**
     * Read a Director file from disk.
     * This is only available in Node.
     */
    static async readFromPath(
        path: string,
        options: ProjectorRaysLoaderOptions = {}
    ): Promise<DirectorFile> {
        const { readFile } = await import("node:fs/promises");
        const data = await readFile(path);
        return DirectorFile.read(data, options);
    }

    /**
     * Write the unprotected file contents to disk.
     * This is only available in Node.
     */
    writeToFile(path: string): void {
        const data = this.writeToBuffer();
        const { writeFileSync } = require("node:fs") as typeof import("node:fs");
        writeFileSync(path, data);
    }
}
