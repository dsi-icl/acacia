declare namespace _default {
    export namespace subtle {
        function encrypt(algorithm: any, keyHandle: any, buffer: any, ...args: any[]): Promise<any>;
        function decrypt(algorithm: any, keyHandle: any, buffer: any, ...args: any[]): Promise<any>;
        function sign(algorithm: any, keyHandle: any, buffer: any, ...args: any[]): Promise<any>;
        function verify(algorithm: any, keyHandle: any, signature: any, buffer: any, ...args: any[]): Promise<any>;
        function digest(algorithm: any, buffer: any, ...args: any[]): Promise<any>;
        function generateKey(algorithm: any, extractable: any, keyUsage: any, ...args: any[]): Promise<any>;
        function deriveKey(algorithm: any, baseKey: any, derivedKeyType: any, extractable: any, keyUsage: any): Promise<any>;
        function deriveBits(algorithm: any, baseKey: any, length: any, ...args: any[]): Promise<any>;
        function importKey(format: any, keyData: any, algorithm: any, extractable: any, keyUsage: any, ...args: any[]): Promise<any>;
        function exportKey(format: any, keyHandle: any): Promise<any>;
        function wrapKey(format: any, key: any, wrappingKey: any, wrappingKeyAlgorithm: any): Promise<any>;
        function unwrapKey(format: any, wrappedKey: any, unwrappingKey: any, unwrapAlgorithm: any, unwrappedKeyAlgorithm: any, extractable: any, keyUsages: any): Promise<any>;
    }
    export function getRandomValues(array: any): any;
    export function initPrng(entropyData: any): void;
    export function toBase64(data: any, base64Url: any): string;
    export function fromBase64(base64String: any): number[];
    export function textToBytes(text: any): any[];
    export function bytesToText(byteArray: any): string;
    export { asn1 };
    export { scriptUrl as url };
    export { msrCryptoVersion as version };
    export function useWebWorkers(useWebWorkers: any): any;
}
export default _default;
declare namespace asn1 {
    export { parse };
    export { encode };
    export function toString(objTree: any): string;
}
declare let scriptUrl: string;
declare let msrCryptoVersion: string;
declare function parse(bytes: any, force: any): any;
declare function encode(asn1tree: any): void;
