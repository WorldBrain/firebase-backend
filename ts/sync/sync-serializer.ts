import { SyncSerializer } from '@worldbrain/storex-sync'
import { SharedSyncLogEntryData } from '@worldbrain/storex-sync/lib/shared-sync-log/types'
import { jsonDateParser } from 'json-date-parser'
import { SyncSecretStore } from './secrets'

export class EncryptedSyncSerializer implements SyncSerializer {
    constructor(private options: { secretStore: SyncSecretStore }) { }

    serializeSharedSyncLogEntryData = async (
        data: SharedSyncLogEntryData,
    ): Promise<string> => {
        return [
            'tweetnacl',
            (await this.options.secretStore.encryptSyncMessage(
                JSON.stringify(data),
            )).message,
        ].join(':')
    }

    deserializeSharedSyncLogEntryData = async (
        serialized: string,
    ): Promise<SharedSyncLogEntryData | null> => {
        const [type] = serialized.split(':', 1)
        const message = serialized.substr(type.length + 1)
        const jsonString = await this.options.secretStore.decryptSyncMessage({
            message,
        })
        if (!jsonString) { // Could not decrypt
            return null
        }

        return JSON.parse(jsonString, jsonDateParser)
    }
}
