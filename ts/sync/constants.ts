import { COLLECTION_NAMES as PAGES_COLLECTION_NAMES } from '@worldbrain/memex-storage/lib/pages/constants'
import { COLLECTION_NAMES as TAGS_COLLECTION_NAMES } from '@worldbrain/memex-storage/lib/tags/constants'
import { COLLECTION_NAMES as LISTS_COLLECTION_NAMES } from '@worldbrain/memex-storage/lib/lists/constants'
import { COLLECTION_NAMES as ANNOTATIONS_COLLECTION_NAMES } from '@worldbrain/memex-storage/lib/annotations/constants'
import { MemexSyncSetting } from "./types";

export const SYNC_STORAGE_AREA_KEYS: {
    [Key in MemexSyncSetting]: string
} = {
    continuousSyncEnabled: 'enable-continuous-sync',
    deviceId: 'device-id',
    encryptionKey: 'sync-encryption-key',
}

export const SYNCED_COLLECTIONS: string[] = [
    PAGES_COLLECTION_NAMES.bookmark,
    PAGES_COLLECTION_NAMES.page,
    PAGES_COLLECTION_NAMES.visit,
    TAGS_COLLECTION_NAMES.tag,
    LISTS_COLLECTION_NAMES.list,
    LISTS_COLLECTION_NAMES.listEntry,
    ANNOTATIONS_COLLECTION_NAMES.annotation,
    ANNOTATIONS_COLLECTION_NAMES.listEntry,
    ANNOTATIONS_COLLECTION_NAMES.bookmark,
    'syncDeviceInfo',
]
