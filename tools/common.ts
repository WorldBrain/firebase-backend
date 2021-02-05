import StorageManager, { StorageBackend } from '@worldbrain/storex'
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'
import inMemory from '@worldbrain/storex-backend-dexie/lib/in-memory'
import { SharedSyncLogStorage } from '@worldbrain/storex-sync/lib/shared-sync-log/storex'
import ActivityStreamStorage from '@worldbrain/memex-common/lib/activity-streams/storage'
import ActivityFollowsStorage from '@worldbrain/memex-common/lib/activity-follows/storage'
import ContentSharingStorage from '@worldbrain/memex-common/lib/content-sharing/storage'
import ContentConversationStorage from '@worldbrain/memex-common/lib/content-conversations/storage'
import UserManagementStorage from '@worldbrain/memex-common/lib/user-management/storage'
import { registerModuleMapCollections } from '@worldbrain/storex-pattern-modules'

export async function createStorage() {
    const localBackend = new DexieStorageBackend({ dbName: 'tmp', idbImplementation: inMemory() })
    const localStorageManager = new StorageManager({ backend: localBackend })

    const serverBackend = { configure: () => { } } as any as StorageBackend
    const serverStorageManager = new StorageManager({ backend: serverBackend })
    const contentSharing = new ContentSharingStorage({ storageManager: serverStorageManager, autoPkType: 'string' })
    const serverModules = {
        sharedSyncLog: new SharedSyncLogStorage({ storageManager: serverStorageManager, autoPkType: 'string' }),
        activityStream: new ActivityStreamStorage({ storageManager: serverStorageManager }),
        activityFollows: new ActivityFollowsStorage({ storageManager: serverStorageManager }),
        contentSharing: contentSharing,
        contentConversations: new ContentConversationStorage({
            contentSharing,
            storageManager: serverStorageManager,
            autoPkType: 'string'
        }),
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
