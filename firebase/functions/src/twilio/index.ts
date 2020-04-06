import * as functions from 'firebase-functions'
import { CallableContext } from 'firebase-functions/lib/providers/https'
import * as createTwilioClient from 'twilio'

export const generateTwilioNTSToken = functions.https.onCall(async (data: any, _context: CallableContext) => {
    const accountSid = functions.config().twilioSid
    const authToken = functions.config().twilioToken
    const client = createTwilioClient(accountSid, authToken);
    const token = await client.tokens.create().then(token => console.log(token.username));
    return token
})
