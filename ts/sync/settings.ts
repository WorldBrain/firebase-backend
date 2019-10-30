import {
    SyncSettingValue,
    SyncSettingsStore,
} from '@worldbrain/storex-sync/lib/integration/settings'
import { MemexSyncSetting } from './types';

export interface MemexSyncSettingsStore extends SyncSettingsStore {
    retrieveSetting(
        key: MemexSyncSetting
    ): Promise<SyncSettingValue>
    storeSetting(
        key: MemexSyncSetting,
        value: SyncSettingValue,
    ): Promise<void>
}
