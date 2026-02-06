# ProjectorRays WASM 

ProjectorRays as a WASM package!

A web example is available in [example.html](example.html).

## Getting started 

Install the projectorrays package from npm:

```
npm install projectorrays
```

or, if using yarn:

```
yarn install projectorrays
```

### Web 

For web install the easiest way is to use the embedded version

```js
import { DirectorFile } from "projectorrays/embedded";

// ....

const buffer = /* an ArrayBuffer */;
const directorFile = await DirectorFile.read(buffer);

// get chunks...
directorFile.dumpChunks()

// get unprotected version as buffer...
const buffer = directorFile.writeToBuffer()
```

### Node 

Note: this is only tested in node v22+.

For node, it is much the same but a slightly different entry point 

```js
import { DirectorFile } from "projectorrays/node"

const directorFile = await DirectorFile.readFromPath("example.dxr"); // or dcr, or dir, ...etc

// get chunks...
directorFile.dumpChunks()

// get unprotected version as buffer...
const buffer = directorFile.writeToBuffer()
```

## DirectorFile API

The `DirectorFile` class exposes the same core API in all environments
(`projectorrays/embedded`, `projectorrays/web`, `projectorrays/node`), with
extra filesystem helpers in Node.

### Construction

- `DirectorFile.read(input, options?)` -> `Promise<DirectorFile>`
  Read a Director file from a `Uint8Array` or `ArrayBuffer`.
- `DirectorFile.readFromPath(path, options?)` (node only) -> `Promise<DirectorFile>`
  Read a Director file from disk.

### Chunks and metadata

Note: `fourCC` can be a 4-character string (e.g. `"CASt"`) or a numeric fourCC code.
  
The numeric form is useful when you already have the 32-bit value from another parser or are working directly with chunk tables.

- `chunkExists(fourCC, chunkId)` -> `boolean`
  Check whether a chunk exists by fourCC and chunkId.
- `getChunk(fourCC, chunkId)` -> `DirectorChunk | null`
  Fetch a chunk's raw bytes.
- `dumpChunks()` -> `DirectorChunk[]`
  Dump all chunks as raw bytes.
- `dumpJSON()` -> `DirectorChunkJSON[]`
  Dump all chunks as JSON when available.
- `size()` -> `number`
  Total size in bytes.
- `isCast()` -> `boolean`
  Whether the file is a cast.

### Scripts

- `getScript(id)` -> `DirectorScriptDetail | null`
  Fetch a specific script entry.
- `dumpScripts()` -> `DirectorScriptDump`
  Dump script metadata, source, and bytecode.

### Output and lifecycle

- `writeToBuffer()` -> `Uint8Array`
  Write an unprotected version to a buffer.
- `writeToFile(path)` (node only) -> `void`
  Write the unprotected version to disk.
- `destroy()` -> `void`
  Release WASM resources. The instance should not be used afterwards.

## Building

Note: We use Vite for our package. 

Firstly, fetch the git sub modules. 

Then, install dependencies using yarn v4

```
yarn install
```

Next, build mpg123:

```
make wasm-mpg123
```

Now we can build the wasm package:

```
make wasm
```

Finally, build the javascript package:

```
yarn build
```