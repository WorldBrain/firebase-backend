import {
    ContinuousSync,
    ContinuousSyncDependencies,
} from '@worldbrain/storex-sync/lib/integration/continuous-sync'
import { SyncPreSendProcessor, SyncSerializer, SyncOptions } from '@worldbrain/storex-sync'
import { isTermsField, getCurrentSchemaVersion } from '../storage/utils'
import { SyncSecretStore } from './secrets'
import { EncryptedSyncSerializer } from './sync-serializer'

export interface MemexContinuousSyncDependencies extends ContinuousSyncDependencies {
    secretStore?: SyncSecretStore
    productType: 'ext' | 'app',
    productVersion: string,
    useEncryption: boolean
}
export class MemexContinuousSync extends ContinuousSync {
    private syncSerializer?: SyncSerializer
    private schemaVersion?: number

    constructor(
        private options: MemexContinuousSyncDependencies,
    ) {
        super(options)

        if (options.secretStore) {
            this.syncSerializer = new EncryptedSyncSerializer({
                secretStore: options.secretStore,
            })
        }

        if (options.useEncryption && !options.secretStore) {
            throw new Error(`MemexInitialSync created wanting encryption, but missing a secret store`)
        }
    }

    async getSyncOptions(): Promise<SyncOptions> {
        const syncOptions = await super.getSyncOptions()
        syncOptions.preSend = _preSendProcessor
        if (this.syncSerializer) {
            syncOptions.serializer = this.syncSerializer
        }

        syncOptions.extraSentInfo = {
            pt: this.options.productType,
            pv: this.options.productVersion,
            sv: await this.getSchemaVersion()
        }
        return syncOptions
    }

    private async getSchemaVersion(): Promise<number> {
        if (this.schemaVersion) {
            return this.schemaVersion
        }

        const asDate = getCurrentSchemaVersion(this.options.storageManager)
        this.schemaVersion = asDate.getTime()
        return this.schemaVersion
    }
}

export const _preSendProcessor: SyncPreSendProcessor = async ({
    entry,
    ...params
}) => {
    if (entry.operation === 'create') {
        if (!Object.keys(entry.value).length) {
            return { entry }
        }

        for (const field of Object.keys(entry.value)) {
            if (isTermsField({ field, collection: entry.collection })) {
                delete entry.value[field]
            }
        }
        if (!Object.keys(entry.value).length) {
            return { entry: null }
        } else {
            return { entry }
        }
    } else if (entry.operation === 'modify') {
        if (isTermsField(entry)) {
            return { entry: null }
        } else {
            return { entry }
        }
    } else {
        return { entry, ...params }
    }
}
