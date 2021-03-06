import fs from 'fs'
import path from 'path'
import { getSignallingRules } from 'simple-signalling/lib/firebase'
import { getUserMessageRules } from '@worldbrain/memex-common/lib/user-messages/service/firebase'
import { serializeRulesAST } from '@worldbrain/storex-backend-firestore/lib/security-rules/ast';
import { generateRulesAstFromStorageModules } from '@worldbrain/storex-backend-firestore/lib/security-rules'
import { createStorage } from './common';

export async function main() {
    const firebaseRootDir = process.argv[2]
    if (!firebaseRootDir) {
        throw new Error(`Please provide output file path as only argument`)
    }
    const firebaseConfig = JSON.parse(fs.readFileSync(path.join(firebaseRootDir, 'firebase.json')).toString())

    const storage = await createStorage()
    const firestoreRulesPath = path.join(firebaseRootDir, firebaseConfig['firestore']['rules'])
    const ast = await generateRulesAstFromStorageModules(storage.server.modules as any, {
        storageRegistry: storage.server.manager.registry,
        excludeTypeChecks: ['sharedSyncLogDeviceInfo', 'sharedSyncLogEntryBatch'],
    })
    const serialized = serializeRulesAST(ast)
    fs.writeFileSync(firestoreRulesPath, serialized)
    console.log(`Firestore security rules successfully written to file '${firestoreRulesPath}'`)

    const firebaseRulesPath = path.join(firebaseRootDir, firebaseConfig['database']['rules'])
    const singallingCollectionName = 'signalling'
    fs.writeFileSync(firebaseRulesPath, JSON.stringify({
        "rules": {
            [singallingCollectionName]: getSignallingRules(),
            ...getUserMessageRules(),
        }
    }, null, 2))
    console.log(`Real-time database security rules successfully written to file '${firebaseRulesPath}'`)
}

if (require.main === module) {
    main()
}
