import { secretbox, randomBytes, setPRNG } from "tweetnacl";
import {
    decodeUTF8,
    encodeUTF8,
    encodeBase64,
    decodeBase64
} from "tweetnacl-util";
import { SyncEncyption } from "./types";

const newNonce = () => randomBytes(secretbox.nonceLength);

const generateKey = () => encodeBase64(randomBytes(secretbox.keyLength));

export class TweetNaclSyncEncryption implements SyncEncyption {
    constructor(private options: { randomBytes: (n: number) => Uint8Array }) {
        function cleanup(arr: Uint8Array) {
            for (var i = 0; i < arr.length; i++) arr[i] = 0;
        }
        setPRNG(function (x, n) {
            var i, v = options.randomBytes(n);
            for (i = 0; i < n; i++) x[i] = v[i];
            cleanup(v);
        })
    }

    async gernerateKey(): Promise<string> {
        return generateKey()
    }
    async encryptSyncMessage(
        message: string,
        options: { key: string }
    ): Promise<{ message: string; nonce?: string }> {
        const keyUint8Array = decodeBase64(options.key);

        const nonce = newNonce();
        const messageUint8 = decodeUTF8(message);
        const box = secretbox(messageUint8, nonce, keyUint8Array);

        const fullMessage = new Uint8Array(nonce.length + box.length);
        fullMessage.set(nonce);
        fullMessage.set(box, nonce.length);

        const base64FullMessage = encodeBase64(fullMessage);
        return { message: base64FullMessage };
    }

    async decryptSyncMessage(encrypted: {
        message: string, nonce?: string
    }, options: { key: string }): Promise<string> {
        const keyUint8Array = decodeBase64(options.key);
        const messageWithNonceAsUint8Array = decodeBase64(encrypted.message);
        const nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength)
        const message = messageWithNonceAsUint8Array.slice(
            secretbox.nonceLength,
            encrypted.message.length
        );

        const decrypted = secretbox.open(message, nonce, keyUint8Array);

        if (!decrypted) {
            throw new Error("Could not decrypt message");
        }

        const base64DecryptedMessage = encodeUTF8(decrypted);
        return base64DecryptedMessage
    }
}
