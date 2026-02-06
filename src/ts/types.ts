export type ReadInput = Uint8Array | ArrayBuffer;
export type DirectorChunkId = number;
export type DirectorChunk = {
    fourCC: string;
    id: DirectorChunkId;
    data: Uint8Array;
};
export type DirectorChunkJSON<T = unknown> = {
    fourCC: string;
    id: DirectorChunkId;
    data: T;
};

export type DirectorScriptType =
    | "BehaviorScript"
    | "ScoreScript"
    | "MovieScript"
    | "ParentScript"
    | "CastScript"
    | "UnknownScript";

export type DirectorScriptEntry = {
    scriptId: number;
    memberId: number;
    memberName: string;
    scriptType: DirectorScriptType;
    lingo: string;
    bytecode: string;
};

export type DirectorScriptDetail = DirectorScriptEntry & {
    castName: string;
};

export type DirectorScriptCast = {
    name: string;
    scripts: DirectorScriptEntry[];
};


export type DirectorScriptDump = {
    isCast: boolean;
    version: number;
    casts: DirectorScriptCast[];
};
