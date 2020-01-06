export interface SyncEncyption {
    gernerateKey(): Promise<string>
    encryptSyncMessage(
        message: string,
        options: { key: string }
    ): Promise<{ message: string; nonce?: string }>
    decryptSyncMessage(encrypted: {
        message: string, nonce?: string
    }, options: { key: string }): Promise<string | null>
}
