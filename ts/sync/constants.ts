import { MemexSyncSetting } from "./types";

export const SYNC_STORAGE_AREA_KEYS: {
    [Key in MemexSyncSetting]: string
} = {
    continuousSyncEnabled: 'enable-continuous-sync',
    deviceId: 'device-id',
    encryptionKey: 'sync-encryption-key',
}
