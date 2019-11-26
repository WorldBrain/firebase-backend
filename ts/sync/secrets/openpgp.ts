import * as openpgp from 'openpgp'
import nacl from 'tweetnacl'
import { ab2str } from './utils'

export class OpenPgpJsSyncEncryption {
    async gernerateKey(): Promise<string> {
        return ab2str(nacl.randomBytes(nacl.secretbox.keyLength).buffer)
    }
    async encryptSyncMessage(
        message: string,
        options: { key: string }
    ): Promise<{ message: string; nonce?: string }> {
        return {
            message: (await openpgp.encrypt({
                message: openpgp.message.fromText(message),
                passwords: [options.key],
                armor: true,
            })).data,
        }
    }

    async decryptSyncMessage(encrypted: {
        message: string, nonce?: string
    }, options: { key: string }): Promise<string> {
        return (await openpgp.decrypt({
            message: await openpgp.message.readArmored(encrypted.message),
            passwords: [options.key],
            format: 'utf8',
        })).data as string
    }
}
