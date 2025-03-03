import StorageManager, { StorageBackend } from '@worldbrain/storex'
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'
import inMemory from '@worldbrain/storex-backend-dexie/lib/in-memory'
import ActivityStreamStorage from '@worldbrain/memex-common/lib/activity-streams/storage'
import ActivityFollowsStorage from '@worldbrain/memex-common/lib/activity-follows/storage'
import ContentSharingStorage from '@worldbrain/memex-common/lib/content-sharing/storage'
import ContentConversationStorage from '@worldbrain/memex-common/lib/content-conversations/storage'
import UserManagementStorage from '@worldbrain/memex-common/lib/user-management/storage'
import PersonalCloudStorage from '@worldbrain/memex-common/lib/personal-cloud/storage'
import PersonalAnalyticsStorage from '@worldbrain/memex-common/lib/analytics/storage'
import DiscordStorage from '@worldbrain/memex-common/lib/discord/storage'
import SlackStorage from '@worldbrain/memex-common/lib/slack/storage'
import { SlackRetroSyncStorage } from '@worldbrain/memex-common/lib/slack/storage/retro-sync'
import { registerModuleMapCollections } from '@worldbrain/storex-pattern-modules'
import { BlueskyStorage } from '@worldbrain/memex-common/lib/bsky/storage'

export async function createStorage() {
    const localBackend = new DexieStorageBackend({
        dbName: 'tmp',
        idbImplementation: inMemory(),
    })
    const localStorageManager = new StorageManager({ backend: localBackend })

    const serverBackend = ({ configure: () => {} } as any) as StorageBackend
    const serverStorageManager = new StorageManager({ backend: serverBackend })
    const contentSharing = new ContentSharingStorage({
        storageManager: serverStorageManager,
        autoPkType: 'string',
    })
    const serverModules = {
        activityStream: new ActivityStreamStorage({
            storageManager: serverStorageManager,
        }),
        activityFollows: new ActivityFollowsStorage({
            storageManager: serverStorageManager,
        }),
        analytics: new PersonalAnalyticsStorage({
            storageManager: serverStorageManager,
        }),
        bluesky: new BlueskyStorage({ storageManager: serverStorageManager }),
        discord: new DiscordStorage({ storageManager: serverStorageManager }),
        slack: new SlackStorage({ storageManager: serverStorageManager }),
        slackRetroSync: new SlackRetroSyncStorage({
            storageManager: serverStorageManager,
        }),
        contentSharing: contentSharing,
        contentConversations: new ContentConversationStorage({
            contentSharing,
            storageManager: serverStorageManager,
            autoPkType: 'string',
        }),
        userManagement: new UserManagementStorage({
            storageManager: serverStorageManager,
        }),
        personalCloud: new PersonalCloudStorage({
            storageManager: serverStorageManager,
            autoPkType: 'string',
        }),
        personalAnalytics: new PersonalAnalyticsStorage({
            storageManager: serverStorageManager,
        }),
    }
    registerModuleMapCollections(serverStorageManager.registry, serverModules)
    await serverStorageManager.finishInitialization()

    return {
        local: {
            manager: localStorageManager,
        },
        server: {
            manager: serverStorageManager,
            modules: serverModules,
        },
    }
}
