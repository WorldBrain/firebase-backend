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
            generateLoginToken?: () => Promise<string>
            loginWithToken?: (token: string) => Promise<void>
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
            if (this.options.generateLoginToken) {
                await options.senderFastSyncChannel.sendUserPackage({
                    type: 'login-token',
                    token: await this.options.generateLoginToken(),
                })
            }

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
            // We're expecting to user packages: key and token
            for (const iteration of [0, 1]) {
                const userPackage = await options.receiverFastSyncChannel.receiveUserPackage()
                if (userPackage.type === 'encryption-key') {
                    await secrectStore.setSyncEncryptionKey(userPackage.key)
                } else if (userPackage.type === 'login-token') {
                    await this.options.loginWithToken(userPackage.token)
                } else {
                    throw new Error(
                        'Expected to receive encryption key in inital sync, but got ' +
                        userPackage.type,
                    )
                }
            }
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
