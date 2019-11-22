import { SyncSetting } from '@worldbrain/storex-sync/lib/integration/settings'

export type MemexSyncSetting = SyncSetting | 'encryptionKey'
export type MemexSyncProductType = 'app' | 'ext'
export type MemexSyncDevicePlatform = 'integration-tests' | 'android' | 'ios' | 'browser'
