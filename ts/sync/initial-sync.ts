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
import { MemexContinuousSync } from './continuous-sync';
import { SyncInfoStorage } from './storage';
import { MemexSyncDevicePlatform, MemexSyncProductType } from './types';

export {
    SignalTransportFactory,
} from '@worldbrain/storex-sync/lib/integration/initial-sync'

type SyncUserPackage =
    {
        type: 'login-token'
        token: string,
    } | {
        type: 'device-info'
        deviceId: string | number
        productType: MemexSyncProductType
        devicePlatform: MemexSyncDevicePlatform
    } | {
        type: 'encryption-key'
        key: string
    }

export class MemexInitialSync extends InitialSync {
    public filterBlobs = true
    public filterPassiveData = false

    constructor(
        private options: InitialSyncDependencies & {
            secretStore?: SyncSecretStore
            continuousSync: MemexContinuousSync
            syncInfoStorage: SyncInfoStorage
            productType: MemexSyncProductType,
            devicePlatform: MemexSyncDevicePlatform,
            useEncryption: boolean
            generateLoginToken?: () => Promise<string>
            loginWithToken?: (token: string) => Promise<void>
        },
    ) {
        super(options)

        if (options.useEncryption && !options.secretStore) {
            throw new Error(`MemexInitialSync created wanting encryption, but missing a secret store`)
        }
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
        const { secretStore, continuousSync } = this.options

        if (options.role === 'sender') {
            if (this.options.generateLoginToken) {
                const userPackage: SyncUserPackage = {
                    type: 'login-token',
                    token: await this.options.generateLoginToken(),
                }
                await options.senderFastSyncChannel.sendUserPackage(userPackage)
            }

            if (secretStore) {
                let key = await secretStore.getSyncEncryptionKey()
                if (!key) {
                    await secretStore.generateSyncEncryptionKey()
                    key = await secretStore.getSyncEncryptionKey()
                }
                const userPackage: SyncUserPackage = {
                    type: 'encryption-key',
                    key,
                }
                await options.senderFastSyncChannel.sendUserPackage(userPackage)
            }

            if (!continuousSync.deviceId) {
                await continuousSync.initDevice()
                await this.options.syncInfoStorage.createDeviceInfo({
                    deviceId: continuousSync.deviceId,
                    productType: this.options.productType,
                    devicePlatform: this.options.devicePlatform,
                })
            }

            const deviceInfoPackage: SyncUserPackage = await options.senderFastSyncChannel.receiveUserPackage()
            if (deviceInfoPackage.type !== 'device-info') {
                throw new Error(`Expected to receive device info from sync target, but got ${deviceInfoPackage.type}`)
            }
            await this.options.syncInfoStorage.createDeviceInfo({
                deviceId: deviceInfoPackage.deviceId,
                productType: deviceInfoPackage.productType,
                devicePlatform: deviceInfoPackage.devicePlatform
            })
        } else {
            let expectedPackageCount = 1 // The login token
            if (secretStore) { // transfer the key if we want encryption
                expectedPackageCount += 1
            }

            for (let i = 0; i < expectedPackageCount; ++i) {
                const userPackage: SyncUserPackage = await options.receiverFastSyncChannel.receiveUserPackage()
                if (userPackage.type === 'encryption-key') {
                    await secretStore.setSyncEncryptionKey(userPackage.key)
                } else if (userPackage.type === 'login-token') {
                    await this.options.loginWithToken(userPackage.token)
                } else {
                    throw new Error(
                        'Expected to receive encryption key in inital sync, but got ' +
                        userPackage.type,
                    )
                }
            }

            if (!continuousSync.deviceId) {
                await continuousSync.initDevice()
            }
            const userPackage: SyncUserPackage = {
                type: 'device-info',
                deviceId: continuousSync.deviceId,
                productType: this.options.productType,
                devicePlatform: this.options.devicePlatform
            }
            await options.receiverFastSyncChannel.sendUserPackage(userPackage)
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
