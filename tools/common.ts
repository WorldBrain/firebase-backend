import StorageManager, { StorageBackend } from '@worldbrain/storex'
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'
import inMemory from '@worldbrain/storex-backend-dexie/lib/in-memory'
import { SharedSyncLogStorage } from '@worldbrain/storex-sync/lib/shared-sync-log/storex'
import ContentSharingStorage from '@worldbrain/memex-common/lib/content-sharing/storage'
import UserManagementStorage from '@worldbrain/memex-common/lib/user-management/storage'
import { registerModuleMapCollections } from '@worldbrain/storex-pattern-modules'

export async function createStorage() {
    const localBackend = new DexieStorageBackend({ dbName: 'tmp', idbImplementation: inMemory() })
    const localStorageManager = new StorageManager({ backend: localBackend })

    const serverBackend = { configure: () => { } } as any as StorageBackend
    const serverStorageManager = new StorageManager({ backend: serverBackend })
    const serverModules = {
        sharedSyncLog: new SharedSyncLogStorage({ storageManager: serverStorageManager, autoPkType: 'string' }),
        contentSharing: new ContentSharingStorage({ storageManager: serverStorageManager, autoPkType: 'string' }),
        userManagement: new UserManagementStorage({ storageManager: serverStorageManager }),
    }
    registerModuleMapCollections(serverStorageManager.registry, serverModules)
    await serverStorageManager.finishInitialization()

    return {
        local: {
            manager: localStorageManager
        },
        server: {
            manager: serverStorageManager,
            modules: serverModules,
        }
    }
}
