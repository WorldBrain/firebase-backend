import StorageManager from '@worldbrain/storex'
import { getStorageContents } from './storage/utils';
import { MemexInitialSync, MemexContinuousSync } from './sync';
import { MemexSyncSettingsStore } from './sync/settings';

export function createSelfTests(dependencies: {
    auth: {
        getUser: () => Promise<{ id: number | string } | null>
        setUser: (user: { id: number | string }) => Promise<void>
    },
    services: {
        sync: {
            settingStore: MemexSyncSettingsStore
            initialSync: MemexInitialSync,
            continuousSync: MemexContinuousSync
        }
    }
    storage: {
        manager: StorageManager
    },
    intergrationTestData: {
        insert: () => Promise<void>
    }
}) {
    const { services, storage } = dependencies
    const tests = {
        initialSyncSend: async (options?: {
            excludeTestData?: boolean;
        }) => {
            await clearDb(storage.manager)
            if (!(options && options.excludeTestData)) {
                await dependencies.intergrationTestData.insert()
            }
            return services.sync.initialSync.requestInitialSync()
        },
        initialSyncReceive: async (options: {
            initialMessage: string
        }) => {
            await clearDb(storage.manager);
            await services.sync.initialSync.answerInitialSync(options)
            await services.sync.initialSync.waitForInitialSync()
            console['log']('After initial Sync', await getStorageContents(storage.manager))
        },
        incrementalSyncSend: async (userId: string) => {
            dependencies.auth.setUser({ id: userId })
            await services.sync.settingStore.storeSetting('deviceId', null)

            const { initialMessage } = await tests.initialSyncSend({ excludeTestData: true })
            console['log']('Waiting for initial sync, initial message is ', initialMessage)
            await services.sync.initialSync.waitForInitialSync()

            await services.sync.continuousSync.initDevice()
            await services.sync.continuousSync.setupContinuousSync()
            await services.sync.continuousSync.forceIncrementalSync()
        },
        incrementalSyncReceive: async (userId: string, initialMessage: string) => {
            dependencies.auth.setUser({ id: userId })
            await services.sync.settingStore.storeSetting('deviceId', null)

            await tests.initialSyncReceive({ initialMessage })

            await services.sync.continuousSync.initDevice()
            await services.sync.continuousSync.setupContinuousSync()
            await services.sync.continuousSync.forceIncrementalSync()
            console['log']('After incremental Sync', await getStorageContents(storage.manager))
        },
    }
    return tests
}

async function clearDb(storageManager: StorageManager) {
    for (const collectionName of Object.keys(
        storageManager.registry.collections,
    )) {
        await storageManager.collection(collectionName).deleteObjects({})
    }
}
