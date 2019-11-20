import StorageManager from '@worldbrain/storex'

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

export * from './initial-sync'
export * from './continuous-sync'
export * from './secrets'

export default class SyncService {
    readonly syncedCollections: string[] = SYNCED_COLLECTIONS

    initialSync: MemexInitialSync
    continuousSync: MemexContinuousSync
    clientSyncLog: ClientSyncLogStorage
    settingStore: SyncSettingsStore
    secretStore: SyncSecretStore
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
            productType: 'app' | 'ext',
            productVersion: string
            syncFrequencyInMs?: number
            devicePlatform: string
        },
    ) {
        this.settingStore = options.settingStore
        this.secretStore = new SyncSecretStore({
            settingStore: this.settingStore,
        })
        this.clientSyncLog = options.clientSyncLog

        this.continuousSync = new MemexContinuousSync({
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
            storageManager: options.storageManager,
            continuousSync: this.continuousSync,
            syncInfoStorage: options.syncInfoStorage,
            signalTransportFactory: options.signalTransportFactory,
            syncedCollections: this.syncedCollections,
            secrectStore: this.secretStore,
            productType: options.productType,
            devicePlatform: options.devicePlatform,
            generateLoginToken: async () =>
                (await options.auth.generateLoginToken()).token,
            loginWithToken: async token => options.auth.loginWithToken(token),
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
