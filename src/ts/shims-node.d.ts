declare module "node:fs/promises" {
    export function readFile(path: string): Promise<Uint8Array>;
}

declare module "node:fs" {
  export function writeFileSync(path: string, data: Uint8Array): void;
}

declare const process: { versions?: { node?: string } };

declare module "node:module" {
    export function createRequire(url: string): (id: string) => unknown;
}

declare module "node:url" {
    export function fileURLToPath(url: string): string;
}
