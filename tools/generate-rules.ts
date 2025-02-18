import fs from 'fs'
import path from 'path'
import { serializeRulesAST } from '@worldbrain/storex-backend-firestore/lib/security-rules/ast'
import { generateRulesAstFromStorageModules } from '@worldbrain/storex-backend-firestore/lib/security-rules'
import { createStorage } from './common'

export async function main() {
    const firebaseRootDir = process.argv[2]
    if (!firebaseRootDir) {
        throw new Error(`Please provide output file path as only argument`)
    }
    const firebaseConfig = JSON.parse(
        fs.readFileSync(path.join(firebaseRootDir, 'firebase.json')).toString(),
    )

    const storage = await createStorage()
    const firestoreRulesPath = path.join(
        firebaseRootDir,
        firebaseConfig['firestore']['rules'],
    )
    const ast = generateRulesAstFromStorageModules(
        storage.server.modules as any,
        {
            storageRegistry: storage.server.manager.registry,
            excludeTypeChecks: [
                'sharedSyncLogDeviceInfo',
                'sharedSyncLogEntryBatch',
            ],
        },
    )
    const serialized = serializeRulesAST(ast)
    fs.writeFileSync(firestoreRulesPath, serialized)
    console.log(
        `Firestore security rules successfully written to file '${firestoreRulesPath}'`,
    )
    process.exit(0)
}

if (require.main === module) {
    main()
}
