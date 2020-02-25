import {
    ContinuousSync,
    ContinuousSyncDependencies,
} from '@worldbrain/storex-sync/lib/integration/continuous-sync'
import { SyncPreSendProcessor, SyncPostReceiveProcessor, SyncSerializer, SyncOptions } from '@worldbrain/storex-sync'
import { isTermsField, getCurrentSchemaVersion, getTermsField } from '../storage/utils'
import { SyncSecretStore } from './secrets'
import { EncryptedSyncSerializer } from './sync-serializer'
import { mergeTermFields } from '../page-indexing/utils'
import { createMemexReconciliationProcessor } from './reconciliation'

export interface MemexContinuousSyncDependencies extends ContinuousSyncDependencies {
    secretStore?: SyncSecretStore
    productType: 'ext' | 'app',
    productVersion: string,
    useEncryption: boolean
    postReceiveProcessor?: SyncPostReceiveProcessor
    processTermsFields?: boolean
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

        const origReconciler = syncOptions.reconciler
        syncOptions.reconciler = (entries, options) => {
            options.doubleCreateBehaviour = 'merge'
            const result = origReconciler(entries, options)
            return result
        }
        if (this.options.processTermsFields) {
            const processor = createMemexReconciliationProcessor(this.options.storageManager)
            syncOptions.reconciliationProcessor = processor
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

    getPostReceiveProcessor(): SyncPostReceiveProcessor | void {
        if (this.options.postReceiveProcessor) {
            return this.options.postReceiveProcessor
        }
    }
}

export const _preSendProcessor: SyncPreSendProcessor = async ({
    entry,
    ...params
}) => {
    const removeTermFieldsFromEntry = () => {
        if (!('value' in entry)) {
            return
        }

        for (const field of Object.keys(entry.value)) {
            if (isTermsField({ field, collection: entry.collection })) {
                delete entry.value[field]
            }
        }
    }

    if (entry.operation === 'create') {
        if (!Object.keys(entry.value).length) {
            return { entry }
        }

        removeTermFieldsFromEntry()
        return !Object.keys(entry.value).length ?
            { entry: null } : { entry }
    } else if (entry.operation === 'modify') {
        if ('field' in entry && entry.field) {
            if (isTermsField(entry)) {
                return { entry: null }
            } else {
                return { entry }
            }
        } else {
            removeTermFieldsFromEntry()
            return !Object.keys(entry.value).length ?
                { entry: null } : { entry }
        }
    } else {
        return { entry, ...params }
    }
}
