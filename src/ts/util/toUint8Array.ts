import type { ReadInput } from "..";

export function toUint8Array(input: ReadInput): Uint8Array {
    return input instanceof Uint8Array ? input : new Uint8Array(input);
}
