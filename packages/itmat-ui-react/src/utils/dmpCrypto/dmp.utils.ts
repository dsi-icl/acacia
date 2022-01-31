//import { atob, btoa } from 'js-base64';
import { ErrorMessage, ErrorCodes } from './dmp.constant';
import crypto from './dmp.crypto';

export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
    if (a.length !== b.length)
        throw new Error(ErrorMessage[ErrorCodes.EXORNOTSS]);
    return a.map((x, i) => x ^ b[i]);
}

export function incrementBy(src: Uint8Array, offset: Uint8Array): Uint8Array {
    const inc = Uint8Array.from(src), szDiff = src.length - offset.length;

    for (let j = offset.length - 1; j >= 0; j--) {
        for (let i = j + szDiff, o = offset[j]; i >= 0; i--) {
            if (inc[i] + o > 255) {
                inc[i] = inc[i] + o - 256;
                o = 1;
            }
            else {
                inc[i] = inc[i] + o;
                break;
            }
        }
    }

    return inc;
}

export function sequenceEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length)
        return false;

    for (let i = 0; i !== a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function toBase64(src: Uint8Array, urlSafeMode = false): string {
    const x = btoa(String.fromCharCode.apply(null, Array.from(src)));
    return urlSafeMode ? x.replace(/\+/g, '-').replace(/\//g, '_') : x;
}

export function fromBase64(enc: string, urlSafeMode = false): Uint8Array {
    const x = urlSafeMode ? enc.replace(/-/g, '+').replace(/_/g, '/') : enc;
    const str = atob(x);
    const len = str.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = str.charCodeAt(i);
    }
    return bytes;
}

const byteToHex = (new Array(256)).map(n => n.toString(16).padStart(2, '0'));
export function toHex(src: Uint8Array, delimiter = ''): string {
    return src.map(n => byteToHex[n]).join(delimiter);
}

export function getRandomBytes(size = 32): Uint8Array {
    const a = new Uint8Array(size);
    crypto.getRandomValues(a);
    return a;
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
}

export function concatBytesArrays(arrays: Array<Uint8Array>): Uint8Array {
    let length = 0;
    for (let i = 0; i < arrays.length; i++) {
        length += arrays[i].length;
    }
    const c = new Uint8Array(length);
    for (let i = 0, j = 0; i < arrays.length; i++) {
        c.set(arrays[i], j);
        j += arrays[i].length;
    }
    return c;
}

export function decode(octets: Uint8Array): string {
    let string = '';
    let i = 0;
    while (i < octets.length) {
        let octet = octets[i];
        let bytesNeeded = 0;
        let codePoint = 0;
        if (octet <= 0x7F) {
            bytesNeeded = 0;
            codePoint = octet & 0xFF;
        } else if (octet <= 0xDF) {
            bytesNeeded = 1;
            codePoint = octet & 0x1F;
        } else if (octet <= 0xEF) {
            bytesNeeded = 2;
            codePoint = octet & 0x0F;
        } else if (octet <= 0xF4) {
            bytesNeeded = 3;
            codePoint = octet & 0x07;
        }
        if (octets.length - i - bytesNeeded > 0) {
            let k = 0;
            while (k < bytesNeeded) {
                octet = octets[i + k + 1];
                codePoint = (codePoint << 6) | (octet & 0x3F);
                k += 1;
            }
        } else {
            codePoint = 0xFFFD;
            bytesNeeded = octets.length - i;
        }
        string += String.fromCodePoint(codePoint);
        i += bytesNeeded + 1;
    }
    return string;
}

export function encode(s: string): Uint8Array {
    const length = s.length;
    const octets = new Array<number>();
    let i = 0;
    while (i < length) {
        const codePoint = s.codePointAt(i);
        if (!codePoint)
            return new Uint8Array(octets);
        let c = 0;
        let bits = 0;
        if (codePoint <= 0x0000007F) {
            c = 0;
            bits = 0x00;
        } else if (codePoint <= 0x000007FF) {
            c = 6;
            bits = 0xC0;
        } else if (codePoint <= 0x0000FFFF) {
            c = 12;
            bits = 0xE0;
        } else if (codePoint <= 0x001FFFFF) {
            c = 18;
            bits = 0xF0;
        }
        octets.push(bits | (codePoint >> c));
        c -= 6;
        while (c >= 0) {
            octets.push(0x80 | ((codePoint >> c) & 0x3F));
            c -= 6;
        }
        i += codePoint >= 0x10000 ? 2 : 1;
    }
    return new Uint8Array(octets);
}

export function getRandomString(size = 32): string {
    const a = getRandomBytes(size);
    return decode(a);
}

export async function hash(data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.digest({ name: 'SHA-256' }, data));
}

export async function hashBase64(s: string, urlSafeMode = false): Promise<string> {
    return toBase64(await hash(encode(s)), urlSafeMode);
}

export function arrayBufferToBase64String(arrayBuffer) {
    const byteArray = new Uint8Array(arrayBuffer);
    let byteString = '';
    for (let i=0; i<byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    return btoa(byteString);
}

export function base64StringToArrayBuffer(b64str) {
    const byteStr = atob(b64str);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) {
        bytes[i] = byteStr.charCodeAt(i);
    }
    return bytes.buffer;
}

export function convertBinaryToPem(binaryData, label) {
    const base64Cert = arrayBufferToBase64String(binaryData);
    let pemCert = '-----BEGIN ' + label + '-----\n';
    let nextIndex = 0;
    while (nextIndex < base64Cert.length) {
        if (nextIndex + 64 <= base64Cert.length) {
            pemCert += base64Cert.substr(nextIndex, 64) + '\n';
        } else {
            pemCert += base64Cert.substr(nextIndex) + '\n';
        }
        nextIndex += 64;
    }
    pemCert += '-----END ' + label + '-----\n';
    return pemCert;
}

export function convertPemPrivateKeyToArrayBuffer(pem) {
    const removedLinesPem = pem.replace(/\\n/g, '');
    const b64Prefix = removedLinesPem.replace('-----BEGIN PRIVATE KEY-----', '');
    const b64Final = b64Prefix.replace('-----END PRIVATE KEY-----', '');
    return base64StringToArrayBuffer(b64Final);
}

export function convertPemPublicKeyToArrayBuffer(pem) {
    const removedLinesPem = pem.replace(/\\n/g, '');
    const b64Prefix = removedLinesPem.replace('-----BEGIN PUBLIC KEY-----', '');
    const b64Final = b64Prefix.replace('-----END PUBLIC KEY-----', '');
    return base64StringToArrayBuffer(b64Final);
}

// Converts Arrays, ArrayBuffers, TypedArrays, and Strings to
// to either a Uint8Array or a regular Array depending on browser support.
// You should use this when passing byte data in or out of crypto functions
export function toSupportedArray(data) {

    // does this browser support Typed Arrays?
    const typedArraySupport = (typeof Uint8Array !== 'undefined');

    // get the data type of the parameter
    let dataType = Object.prototype.toString.call(data);
    dataType = dataType.substring(8, dataType.length - 1);
    const newArray = typedArraySupport ? new Uint8Array(data.length) : new Array(data.length);
    // determine the type
    switch (dataType) {

        // Regular JavaScript Array. Convert to Uint8Array if supported
        // else do nothing and return the array
        case 'Array':
            return typedArraySupport ? new Uint8Array(data) : data;

            // ArrayBuffer. IE11 Web Crypto API returns ArrayBuffers that you have to convert
            // to Typed Arrays. Convert to a Uint8Arrays and return;
        case 'ArrayBuffer':
            return new Uint8Array(data);

            // Already Uint8Array. Obviously there is support.
        case 'Uint8Array':
            return data;

        case 'Uint16Array':
        case 'Uint32Array':
            return new Uint8Array(data);

            // String. Convert the string to a byte array using Typed Arrays if supported.
        case 'String':
            for (let i = 0; i < data.length; i += 1) {
                newArray[i] = data.charCodeAt(i);
            }
            return newArray;

            // Some other type. Just return the data unchanged.
        default:
            throw new Error('toSupportedArray : unsupported data type ' + dataType);
    }

}
