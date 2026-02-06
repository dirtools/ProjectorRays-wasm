# ProjectorRays WASM 

ProjectorRays as a WASM package!

Using 

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