import StorageManager from '@worldbrain/storex'

export function isTermsField(params: {
    collection: string
    field: string
}): boolean {
    return (
        params.field.startsWith('_terms') ||
        params.field.endsWith('Terms') ||
        params.field === 'terms'
    )
}

export function createPassiveDataChecker(dependencies: {
    storageManager: StorageManager
}): (
    params: {
        collection: string
        pk: any
    },
) => Promise<boolean> {
    return async params => {
        if (params.collection !== 'pages') {
            return false
        }

        const check = async (
            collection: string,
            where: object,
        ): Promise<boolean> => {
            return !!(await dependencies.storageManager
                .collection(collection)
                .findObject(where))
        }

        return !(await check('pageListEntries', { pageUrl: params.pk }))
    }
}

export async function getStorageContents(
    storageManager: StorageManager,
    options?: { include?: Set<string>; exclude?: Set<string> },
) {
    const exclude = (options && options.exclude) || new Set()

    const storedData: { [collection: string]: any[] } = {}

    const collectionNames =
        (options && options.include) ||
        Object.keys(storageManager.registry.collections)
    for (const collectionName of collectionNames) {
        if (!exclude.has(collectionName)) {
            storedData[collectionName] = await storageManager
                .collection(collectionName)
                .findObjects({})
        }
    }
    return storedData
}
