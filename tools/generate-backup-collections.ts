import fs from 'fs'
import path from 'path'
import { createStorage } from './common';

const COLLECTION_BACKUP_CONFIGS: { [collectionName: string]: boolean } = {
    sharedSyncLogEntry: false,
    sharedSyncLogEntryBatch: false,
    sharedSyncLogDeviceInfo: true,
    sharedList: true,
    sharedListCreatorInfo: true,
    sharedListEntry: true,
    sharedPageInfo: true,
    sharedAnnotation: true,
    sharedAnnotationListEntry: true,
    user: true,
    userEmail: true,
    conversationThread: true,
    conversationReply: true,
}

export async function main() {
    const firebaseRootDir = process.argv[2]
    if (!firebaseRootDir) {
        throw new Error(`Please provide output file path as only argument`)
    }
    // const firebaseConfig = JSON.parse(fs.readFileSync(path.join(firebaseRootDir, 'firebase.json')).toString())
    const functionsPath = path.join(firebaseRootDir, 'functions')
    const backupConstantsPath = path.join(functionsPath, 'src', 'backup', 'constants.ts')

    const storage = await createStorage()
    const storageCollections = new Set(Object.keys(storage.server.manager.registry.collections))
    const configuredCollections = new Set(Object.keys(COLLECTION_BACKUP_CONFIGS))
    const missingCollection = [...storageCollections].filter(collectionName => !configuredCollections.has(collectionName))
    if (missingCollection.length) {
        throw new Error(`The backup of the following collection(s) are not configured: ${
            missingCollection.join(', ')
            }`)
    }

    fs.writeFileSync(backupConstantsPath,
        `// DON'T EDIT BY HAND: This file is automatically via the 'generate-backup-collections' script\n` +
        `export const COLLECTIONS_TO_BACKUP = [\n${
        Object.entries(COLLECTION_BACKUP_CONFIGS)
            .filter(([_, shouldBackup]) => shouldBackup)
            .map(([collectionName]) => `  "${collectionName}"`)
            .join(',\n')
        }\n];\n`)
}

if (require.main === module) {
    main()
}
