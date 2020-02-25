import StorageManager, { OperationBatch } from '@worldbrain/storex'
import extractTerms from '@worldbrain/memex-stemmer/lib/index'
import { getTermsField } from '../storage/utils'
import { mergeTermFields } from '../page-indexing/utils'

export function createMemexReconciliationProcessor(storageManager: StorageManager) {
    return async (reconciliation: OperationBatch) => {
        for (const step of reconciliation) {
            if (step.collection !== 'pages' || step.operation !== 'updateObjects') {
                continue
            }

            const existingPage = await storageManager.collection('pages').findObject({ url: step.where.url })
            for (const [fieldName, fieldValue] of Object.entries(step.updates)) {
                if (!fieldValue) {
                    continue
                }

                const termsField = getTermsField('pages', fieldName)
                if (termsField) {
                    step.updates[termsField] = extractTerms(fieldValue as string)
                    const merged = mergeTermFields(termsField, existingPage, step.updates)
                    step.updates[termsField] = merged
                }
            }
        }

        return reconciliation
    }
}