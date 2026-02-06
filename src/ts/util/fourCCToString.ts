export function fourCCToString(fourCCValue: number): string {
    const bytes = [
        (fourCCValue >> 24) & 0xff,
        (fourCCValue >> 16) & 0xff,
        (fourCCValue >> 8) & 0xff,
        fourCCValue & 0xff,
    ];
    let out = "";
    for (const byte of bytes) {
        switch (byte) {
            case 0x22:
                out += '\\"';
                break;
            case 0x5c:
                out += "\\\\";
                break;
            case 0x08:
                out += "\\b";
                break;
            case 0x0c:
                out += "\\f";
                break;
            case 0x0a:
                out += "\\n";
                break;
            case 0x0d:
                out += "\\r";
                break;
            case 0x09:
                out += "\\t";
                break;
            case 0x0b:
                out += "\\v";
                break;
            default:
                if (byte < 0x20 || byte > 0x7f) {
                    out += `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
                } else {
                    out += String.fromCharCode(byte);
                }
                break;
        }
    }
    return out;
}
