export function ab2str(buf: ArrayBuffer): string {
    return String.fromCharCode.apply(null, new Uint8Array(buf))
}

export function str2ab(str: string): ArrayBuffer {
    const array = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
        array[i] = str.charCodeAt(i)
    }
    return array.buffer
}
