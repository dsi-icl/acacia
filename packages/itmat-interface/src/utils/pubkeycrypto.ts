import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export function rsasigner(privateKey: string, message: string, scheme = 'RSA-SHA256', passphrase = 'idea-fast'): string {
    try {
        const signer = crypto.createSign(scheme);
        // Signing
        signer.update(message);        

        // The signature output_format: HexBase64Latin1Encoding which can be either 'binary', 'hex' or 'base64'
        const signature = signer.sign({
            key: privateKey,
            passphrase: passphrase
        }, 'base64');
        signer.end();
        return signature;
    }
    catch(err){
        return err;
    }
}

export function hashdigest(message: string, method = 'sha256'): string {
    const hash = crypto.createHash(method);
    hash.update(message);
    return hash.copy().digest('base64');
}

export function reGenPkfromSk(privateKey: string, passphrase = 'idea-fast'): string {
    try {
        const skObject = crypto.createPrivateKey({
            key: privateKey,
            type: 'pkcs8',
            format: 'pem',
            passphrase: passphrase
        });

        const pkObject = crypto.createPublicKey(skObject);
        const reGenPk = pkObject.export({
            format: 'pem',
            type: 'spki'
        });
        return reGenPk.toString('base64');
    }
    catch(err){
        return err;
    }
}

export async function rsaverifier2(pubkey, signature, data = '') {    
    let dataToBeVerified;
    if (data === '') {
        //default message = hash of the public key (SHA256). Re-generate the message = hash of the public key
        const hash = crypto.createHash('sha256');
        hash.update(toSupportedArray(pubkey));
        dataToBeVerified = hash.copy().digest('base64');
    }
    const ec = new TextEncoder();
    const verified = await crypto.verify(
        'RSASSA-PKCS1-v1_5',
        ec.encode(dataToBeVerified),
        pubkey,
        ec.encode(signature)
    );
    return verified;
}

export async function rsaverifier(pubkey: string, signature: string, message = '', scheme = 'RSA-SHA256') {
    try {
        const verifier = crypto.createVerify(scheme);
        let messageToBeVerified;

        if (message === '') {
            //default message = hash of the public key (SHA256). Re-generate the message = hash of the public key
            const ec = new TextEncoder();
            const hash = crypto.createHash('sha256');
            hash.update(toSupportedArray(pubkey));
            messageToBeVerified = hash.digest('base64');
        }
        verifier.update(messageToBeVerified);
        // Verify the signature in supported formats ('binary', 'hex' or 'base64')
        // The encoded format must be same as the signature
        return verifier.verify(pubkey, signature, 'base64');
    }
    catch(err){
        throw err;
    }
}

export function rsakeygen(passphrase = 'idea-fast', modulusLength = 4096) {
    const { publicKey, privateKey }  = crypto.generateKeyPairSync('rsa', {
        modulusLength: modulusLength,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: passphrase
        }
    });
    return { publicKey, privateKey };
}

export function eckeygen(curve = 'secp256k1') {
    const keyPair = crypto.generateKeyPairSync('ec', {
        namedCurve: curve,
        publicKeyEncoding: {
            type: 'spki',
            format: 'der'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'der'
        }
    });
    return keyPair;
}

export function tokengen(payload, secret, passphrase = 'idea-fast', algorithm = 'RS256', life = 12000) {
    // Asymmetric JWT is used by default by setting algorithm = RS256.
    let token;
    try {
        token = jwt.sign(payload,
            { key: secret, passphrase: passphrase },
            { algorithm: algorithm, expiresIn: life }
        );
    }
    catch(err){
        throw err;
    }
    return token;
}

export function tokenverifier(token, secret) {
    let decoded = '';
    try {
        decoded = jwt.verify(token, secret);
    }
    catch(err){
        throw err;
    }
    return decoded;
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
