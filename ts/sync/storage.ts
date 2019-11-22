import {
    StorageModule,
    StorageModuleConfig,
} from '@worldbrain/storex-pattern-modules'

export class SyncInfoStorage extends StorageModule {
    getConfig(): StorageModuleConfig {
        return {
            collections: {
                syncDeviceInfo: {
                    version: new Date('2019-11-20'),
                    fields: {
                        deviceId: { type: 'string' },
                        createdWhen: { type: 'timestamp' },
                        productType: { type: 'string' },
                        devicePlatform: { type: 'string', optional: true },
                        label: { type: 'string', optional: true },
                    },
                    indices: [
                        { field: 'deviceId', pk: true }
                    ]
                }
            },
            operations: {
                createSyncDeviceInfo: {
                    operation: 'createObject',
                    collection: 'syncDeviceInfo'
                },
                getDevice: {
                    operation: 'findObject',
                    collection: 'syncDeviceInfo',
                    args: {
                        deviceId: '$deviceId:string'
                    }
                },
                getAllDevices: {
                    operation: 'findObjects',
                    collection: 'syncDeviceInfo',
                    args: {}
                }
            }
        }
    }

    async createDeviceInfo(params: { deviceId: string | number, productType: string, devicePlatform: string }) {
        params = { ...params, deviceId: params.deviceId.toString() }
        if (!await this.operation('getDevice', params)) {
            await this.operation('createSyncDeviceInfo', { ...params, createdWhen: Date.now() })
        }
    }

    async listDevices() {
        return this.operation('getAllDevices', {})
    }
}
