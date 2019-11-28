import StorageManager from '@worldbrain/storex'
import { SyncPostReceiveProcessor } from '@worldbrain/storex-sync'
import { SharedSyncLog } from '@worldbrain/storex-sync/lib/shared-sync-log'
import { SyncLoggingMiddleware } from '@worldbrain/storex-sync/lib/logging-middleware'
import { SyncSettingsStore } from '@worldbrain/storex-sync/lib/integration/settings'
import { ClientSyncLogStorage } from '@worldbrain/storex-sync/lib/client-sync-log';
import { SYNCED_COLLECTIONS } from './constants'
import { AuthService } from '../authentication/types'
import {
    MemexInitialSync,
    MemexContinuousSync,
    SyncSecretStore,
    SignalTransportFactory,
} from '.'
import { SyncInfoStorage } from './storage';
import { MemexSyncProductType, MemexSyncDevicePlatform } from './types';
import { SyncEncyption } from './secrets/types';

export * from './initial-sync'
export * from './continuous-sync'
export * from './secrets'

export default class SyncService {
    readonly syncedCollections: string[] = SYNCED_COLLECTIONS

    initialSync: MemexInitialSync
    continuousSync: MemexContinuousSync
    clientSyncLog: ClientSyncLogStorage
    syncInfoStorage: SyncInfoStorage
    settingStore: SyncSettingsStore
    secretStore?: SyncSecretStore
    syncLoggingMiddleware?: SyncLoggingMiddleware

    constructor(
        private options: {
            auth: AuthService
            storageManager: StorageManager
            signalTransportFactory: SignalTransportFactory
            clientSyncLog: ClientSyncLogStorage
            syncInfoStorage: SyncInfoStorage
            getSharedSyncLog: () => Promise<SharedSyncLog>
            settingStore: SyncSettingsStore
            syncEncryption?: SyncEncyption
            postReceiveProcessor?: SyncPostReceiveProcessor
            productType: 'app' | 'ext',
            productVersion: string
            devicePlatform: MemexSyncDevicePlatform
            syncFrequencyInMs?: number
            disableEncryption?: boolean
        },
    ) {
        const useEncryption = !options.disableEncryption
        this.settingStore = options.settingStore
        if (options.syncEncryption) {
            this.secretStore = new SyncSecretStore({
                encryption: options.syncEncryption,
                settingStore: this.settingStore,
            })
        }
        this.clientSyncLog = options.clientSyncLog
        this.syncInfoStorage = options.syncInfoStorage

        this.continuousSync = new MemexContinuousSync({
            useEncryption,
            frequencyInMs: options.syncFrequencyInMs,
            auth: {
                getUserId: async () => {
                    const user = await options.auth.getCurrentUser()
                    return user && user.id
                },
            },
            storageManager: options.storageManager,
            clientSyncLog: this.options.clientSyncLog,
            getSharedSyncLog: this.options.getSharedSyncLog,
            settingStore: this.settingStore,
            secretStore: this.secretStore,
            productType: options.productType,
            productVersion: options.productVersion,
            postReceiveProcessor: options.postReceiveProcessor,
            toggleSyncLogging: (enabled: boolean, deviceId?: string | number) => {
                if (this.syncLoggingMiddleware) {
                    if (enabled) {
                        this.syncLoggingMiddleware.enable(deviceId!)
                    } else {
                        this.syncLoggingMiddleware.disable()
                    }
                } else {
                    throw new Error(
                        `Tried to toggle sync logging before logging middleware was created`,
                    )
                }
            },
        })
        this.initialSync = new MemexInitialSync({
            useEncryption,
            storageManager: options.storageManager,
            continuousSync: this.continuousSync,
            syncInfoStorage: options.syncInfoStorage,
            signalTransportFactory: options.signalTransportFactory,
            syncedCollections: this.syncedCollections,
            secretStore: this.secretStore,
            productType: options.productType,
            devicePlatform: options.devicePlatform,
            generateLoginToken: async () =>
                (await options.auth.generateLoginToken()).token,
            loginWithToken: async (token: string) => options.auth.loginWithToken(token),
        })
    }

    async createSyncLoggingMiddleware() {
        this.syncLoggingMiddleware = new SyncLoggingMiddleware({
            storageManager: this.options.storageManager,
            clientSyncLog: this.options.clientSyncLog,
            includeCollections: this.syncedCollections,
        })
        return this.syncLoggingMiddleware
    }
}
