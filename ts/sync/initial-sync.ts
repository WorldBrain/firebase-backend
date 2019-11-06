import StorageManager from '@worldbrain/storex'
import { getObjectPk } from '@worldbrain/storex/lib/utils'
import { FastSyncPreSendProcessor } from '@worldbrain/storex-sync/lib/fast-sync'
import {
    InitialSync,
    InitialSyncDependencies,
    InitialSyncInfo,
} from '@worldbrain/storex-sync/lib/integration/initial-sync'
import { createPassiveDataChecker } from '../storage/utils'
import { SyncSecretStore } from './secrets'

export {
    SignalTransportFactory,
} from '@worldbrain/storex-sync/lib/integration/initial-sync'

export class MemexInitialSync extends InitialSync {
    public filterBlobs = true
    public filterPassiveData = false

    constructor(
        private options: InitialSyncDependencies & {
            secrectStore: SyncSecretStore
        },
    ) {
        super(options)
    }

    protected getPreSendProcessor() {
        const passiveDataFilter = _createExcludePassivePreSendFilter({
            storageManager: this.dependencies.storageManager,
        })
        const blobFilter = _createBlobPreSendFilter({
            storageManager: this.dependencies.storageManager,
        })
        const processor: FastSyncPreSendProcessor = async (params) => {
            let filteredObject = params.object
            if (this.filterBlobs) {
                filteredObject = (await blobFilter({
                    ...params, object: filteredObject,
                })).object
            }
            if (this.filterPassiveData) {
                filteredObject = (await passiveDataFilter({
                    ...params, object: filteredObject,
                })).object
            }
            return { ...params, object: filteredObject }
        }
        return processor
    }

    protected async preSync(options: InitialSyncInfo) {
        const { secrectStore } = this.options
        if (options.role === 'sender') {
            let key = await secrectStore.getSyncEncryptionKey()
            if (!key) {
                await secrectStore.generateSyncEncryptionKey()
                key = await secrectStore.getSyncEncryptionKey()
            }
            await options.senderFastSyncChannel.sendUserPackage({
                type: 'encryption-key',
                key,
            })
        } else {
            const userPackage = await options.receiverFastSyncChannel.receiveUserPackage()
            if (userPackage.type !== 'encryption-key') {
                throw new Error(
                    'Expected to receive encryption key in inital sync, but got ' +
                    userPackage.type,
                )
            }
            await secrectStore.setSyncEncryptionKey(userPackage.key)
        }
    }
}

export function _createBlobPreSendFilter(dependencies: {
    storageManager: StorageManager
}): FastSyncPreSendProcessor {
    const registry = dependencies.storageManager.registry;
    return async params => {
        const collectionDefinition = registry.collections[params.collection]
        const object = { ...params.object }
        for (const [fieldName, fieldDefinition] of Object.entries(collectionDefinition.fields)) {
            if (fieldDefinition.type === 'blob') {
                object[fieldName] = null
            }
        }
        return { object }
    }
}

export function _createExcludePassivePreSendFilter(dependencies: {
    storageManager: StorageManager
}): FastSyncPreSendProcessor {
    const isPassiveData = createPassiveDataChecker(dependencies)
    return async params => {
        return (await isPassiveData({
            collection: params.collection,
            pk: getObjectPk(
                params.object,
                params.collection,
                dependencies.storageManager.registry,
            ),
        }))
            ? { object: null }
            : params
    }
}
