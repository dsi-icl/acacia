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

export function rsaverifier(pubkey: string, signature: string, message = '', scheme = 'RSA-SHA256'): boolean {
    try {
        const verifier = crypto.createVerify(scheme);
        let messageToBeVerified = message;
        if (messageToBeVerified === '') {
            //default message = hash of the public key (SHA256). Re-generate the message = hash of the public key
            const hash = crypto.createHash('sha256');
            hash.update(pubkey);
            messageToBeVerified = hash.copy().digest('base64');
        }

        verifier.update(messageToBeVerified);
        // Verify the signature in supported formats ('binary', 'hex' or 'base64')
        // The encoded format must be same as the signature
        return verifier.verify(pubkey, signature, 'base64');
    }
    catch(err){
        return err;
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
        return err;
    }
    return token;
}

export function tokenverifier(token, secret) {
    let decoded = '';
    try {
        decoded = jwt.verify(token, secret);
    }
    catch(err){
        return err;
    }
    return decoded;
}
