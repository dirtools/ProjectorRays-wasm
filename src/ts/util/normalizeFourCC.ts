export function normalizeFourCC(fourCC: number | string): number {
    if (typeof fourCC === "number") {
        return fourCC >>> 0;
    }
    if (fourCC.length !== 4) {
        throw new Error("fourCC string must be exactly 4 characters.");
    }
    return (
        (fourCC.charCodeAt(0) << 24) |
        (fourCC.charCodeAt(1) << 16) |
        (fourCC.charCodeAt(2) << 8) |
        fourCC.charCodeAt(3)
    ) >>> 0;
}
