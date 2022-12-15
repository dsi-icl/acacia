import base32 from 'hi-base32';
import crypto from 'crypto';


export function generateSecret(length = 20): string {
    const randomBuffer = crypto.randomBytes(length);
    return base32.encode(randomBuffer).replace(/=/g, '');
}

// HMAC-based OTPs algorithm specified in RFC4226.
function generateHOTP(secret: string, counter: number) {
    const decodedSecret = base32.decode.asBytes(secret);
    const buffer = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
        buffer[7 - i] = counter & 0xff;
        counter = counter >> 8;
    }

    // Step 1: Generate an HMAC-SHA-1 value
    const hmac = crypto.createHmac('sha1', Buffer.from(decodedSecret));
    hmac.update(buffer);
    const hmacResult = hmac.digest();

    // Step 2: Generate a 4-byte string (Dynamic Truncation)
    const code = dynamicTruncationFn(hmacResult);

    // Step 3: Compute an HOTP value
    return code % 10 ** 6;
}

function dynamicTruncationFn(hmacValue: Buffer) {
    const offset = hmacValue[hmacValue.length - 1] & 0xf;
    return (
        ((hmacValue[offset] & 0x7f) << 24) |
        ((hmacValue[offset + 1] & 0xff) << 16) |
        ((hmacValue[offset + 2] & 0xff) << 8) |
        (hmacValue[offset + 3] & 0xff)
    );
}

//  Generate TOTP based on the HOTP function
// The algorithm is specified in RFC6238
export function generateTOTP(secret: string, window = 0): number {
    const counter = Math.floor(Date.now() / 30000);
    return generateHOTP(secret, counter + window);
}

// Verify the TOTP
export function verifyTOTP(token: string, secret: string, window = 1): boolean {
    if (Math.abs(+window) > 10) {
        console.error('Window size is too large');
        return false;
    }

    for (let errorWindow = -window; errorWindow <= +window; errorWindow++) {
        const totp = generateTOTP(secret, errorWindow);
        if (parseInt(token) === totp) {
            return true;
        }
    }
    return false;
}
