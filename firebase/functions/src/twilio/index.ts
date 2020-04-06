import * as functions from 'firebase-functions'
import { CallableContext } from 'firebase-functions/lib/providers/https'
const createTwilioClient = require('twilio')

export const generateTwilioNTSToken = functions.https.onCall(async (data: any, _context: CallableContext) => {
    const accountSid = functions.config().twilio.sid
    const authToken = functions.config().twilio.token
    const client = createTwilioClient(accountSid, authToken)
    const token = await client.tokens.create()
    return token
})
