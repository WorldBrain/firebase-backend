import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { CallableContext } from 'firebase-functions/lib/providers/https'
const Airtable = require('airtable')

// airtable.api_key
// airtable.customers_base

export const registerBetaUserCall = functions.https.onCall(async (data: any, _context: CallableContext) => {
    const config = functions.config().airtable ?? data
    const { api_key: apiKey, customers_base: customersBaseId } = config
    if (typeof apiKey !== 'string') {
        throw new Error(`airtable.api_key incorrectly configured`)
    }
    if (typeof customersBaseId !== 'string') {
        throw new Error(`airtable.customers_base incorrectly configured`)
    }
    const uid = _context.auth?.uid
    if (!uid) {
        throw new Error(`cannot register beta user without being authenticated`)
    }
    const user = await admin.auth().getUser(uid)
    if (!user) {
        throw new Error('could not find user to register')
    }
    const email = user.email
    if (!email) {
        throw new Error('could not find e-mail address for authenticated user')
    }

    const airtable = new Airtable({ apiKey })
    const base = airtable.base(customersBaseId)
    const table = base('tblpc3TEyyDzIHNVa')

    await table.create([{
        fields: {
            "Email": email,
        }
    }])
})
