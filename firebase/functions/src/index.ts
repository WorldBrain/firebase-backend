import * as bcrypt from 'bcrypt'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

export interface WPToken {
    userId : number
    createdWhen : number
    hash : string
}

admin.initializeApp()


export const generateAuthToken = functions.https.onCall(async (wpToken : WPToken, context) => {
    if (!await validateWPToken(wpToken)) {
        return null
    }

    const customToken = await admin.auth().createCustomToken('test', {
        wpId: `wp:${wpToken.userId}`,
        premiumUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10)
    })
    return { customToken }
})

async function validateWPToken(token : WPToken) : Promise<boolean> {
    const secret = functions.config().auth ? functions.config().auth.secret : process.env.AUTH_SECRET
    const plainText = [token.userId, token.createdWhen, secret].join('|')
    const result = await bcrypt.compare(plainText, token.hash.replace(/^\$2y\$/, '$2b$'))
    console.log(secret, plainText, result)
    return result
}