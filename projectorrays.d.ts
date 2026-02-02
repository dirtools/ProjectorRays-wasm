export interface ProjectorRaysModule {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _projectorrays_decompile(inputPtr: number, inputSize: number, outputSizePtr: number): number;
  _projectorrays_free(ptr: number): void;
  _malloc(size: number): number;
  _free(ptr: number): void;
  cwrap(ident: "projectorrays_decompile", returnType: "number", argTypes: ["number", "number", "number"]): (
    inputPtr: number,
    inputSize: number,
    outputSizePtr: number
  ) => number;
  cwrap(ident: "projectorrays_free", returnType: "void", argTypes: ["number"]): (ptr: number) => void;
  ccall(ident: "projectorrays_decompile", returnType: "number", argTypes: ["number", "number", "number"], args: [number, number, number]): number;
  ccall(ident: "projectorrays_free", returnType: "void", argTypes: ["number"], args: [number]): void;
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string, prefix?: string) => string;
  preRun?: Array<() => void> | (() => void);
  postRun?: Array<() => void> | (() => void);
}

declare const Module: ProjectorRaysModule;
export default Module;
