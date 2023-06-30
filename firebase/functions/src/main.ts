import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v2'
import { main } from '@worldbrain/memex-common/lib/firebase-backend/main'

module.exports = main(admin as any, functions)
