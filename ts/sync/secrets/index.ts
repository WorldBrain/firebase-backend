import { MemexSyncSettingsStore } from '../settings';

export interface SyncEncyption {
    gernerateKey(): Promise<string>
    encryptSyncMessage(
        message: string,
        options: { key: string }
    ): Promise<{ message: string; nonce?: string }>
    decryptSyncMessage(encrypted: {
        message: string, nonce?: string
    }, options: { key: string }): Promise<string>
}

export class SyncSecretStore {
    private key: string | null = null
    private loaded = false

    constructor(
        private options: {
            encryption: SyncEncyption
            settingStore: MemexSyncSettingsStore
        },
    ) { }

    async generateSyncEncryptionKey(): Promise<void> {
        this.key = await this.options.encryption.gernerateKey()
        await this._storeKey()
    }

    async getSyncEncryptionKey(): Promise<string | null> {
        if (!this.loaded) {
            await this._loadKey()
        }
        return this.key
    }

    async setSyncEncryptionKey(key: string): Promise<void> {
        this.key = key
        await this._storeKey()
    }

    async encryptSyncMessage(
        message: string,
    ): Promise<{ message: string; nonce?: string }> {
        if (!this.key) {
            throw new Error('Tried to encrypt sync message without a key')
        }

        return this.options.encryption.encryptSyncMessage(message, { key: this.key })
    }

    async decryptSyncMessage(encrypted: {
        message: string
        nonce?: string
    }): Promise<string> {
        if (!this.key) {
            throw new Error('Tried to decrypt sync message without a key')
        }

        return this.options.encryption.decryptSyncMessage(encrypted, { key: this.key })
    }

    async _storeKey() {
        await this.options.settingStore.storeSetting(
            'encryptionKey', this.key,
        )
    }

    async _loadKey() {
        const retrievedKey: string | null = await this.options.settingStore.retrieveSetting('encryptionKey') as string | null
        if (retrievedKey) {
            this.key = retrievedKey
            this.loaded = true
        }
    }
}
