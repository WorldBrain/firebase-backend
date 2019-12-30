import fs from 'fs'
import path from 'path'
import firebase from 'firebase'
import { getSignallingRules } from 'simple-signalling/lib/firebase'
import StorageManager, { StorageBackend } from '@worldbrain/storex'
import { DexieStorageBackend } from '@worldbrain/storex-backend-dexie'
import inMemory from '@worldbrain/storex-backend-dexie/lib/in-memory'
import { FirestoreStorageBackend } from '@worldbrain/storex-backend-firestore'
import { generateRulesAstFromStorageModules } from '@worldbrain/storex-backend-firestore/lib/security-rules'
import { serializeRulesAST } from '@worldbrain/storex-backend-firestore/lib/security-rules/ast';
import { SharedSyncLogStorage } from '@worldbrain/storex-sync/lib/shared-sync-log/storex'
import { registerModuleMapCollections } from '@worldbrain/storex-pattern-modules'

async function createStorage() {
    const localBackend = new DexieStorageBackend({ dbName: 'tmp', idbImplementation: inMemory() })
    const localStorageManager = new StorageManager({ backend: localBackend })

    const serverBackend = { configure: () => { } } as any as StorageBackend
    const serverStorageManager = new StorageManager({ backend: serverBackend })
    const serverModules = {
        sharedSyncLog: new SharedSyncLogStorage({ storageManager: serverStorageManager, autoPkType: 'string' })
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

export async function main() {
    const firebaseRootDir = process.argv[2]
    if (!firebaseRootDir) {
        throw new Error(`Please provide output file path as only argument`)
    }
    const firebaseConfig = JSON.parse(fs.readFileSync(path.join(firebaseRootDir, 'firebase.json')).toString())

    const storage = await createStorage()
    const firestoreRulesPath = path.join(firebaseRootDir, firebaseConfig['firestore']['rules'])
    const ast = await generateRulesAstFromStorageModules(storage.server.modules as any, {
        storageRegistry: storage.server.manager.registry
    })
    const serialized = serializeRulesAST(ast)
    fs.writeFileSync(firestoreRulesPath, serialized)
    console.log(`Firestore security rules successfully written to file '${firestoreRulesPath}'`)

    const firebaseRulesPath = path.join(firebaseRootDir, firebaseConfig['database']['rules'])
    const singallingCollectionName = 'signalling'
    fs.writeFileSync(firebaseRulesPath, JSON.stringify({
        "rules": {
            [singallingCollectionName]: getSignallingRules()
        }
    }, null, 2))
    console.log(`Real-time database security rules successfully written to file '${firebaseRulesPath}'`)
}

if (require.main === module) {
    main()
}
