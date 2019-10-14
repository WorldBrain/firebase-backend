import * as bcrypt from 'bcrypt'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import {CallableContext, Request} from 'firebase-functions/lib/providers/https'

const chargebee = require('chargebee')

const runningInEmulator = process.env.FUNCTIONS_EMULATOR
const emulatedConfig = {
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://worldbrain-staging.firebaseio.com",
    projectId: "worldbrain-staging",
}
admin.initializeApp((runningInEmulator) ? emulatedConfig : undefined);


/**
 * Legacy WordPress Auth Token functionality
 */

export interface WPToken {
    userId: number
    createdWhen: number
    hash: string
}

export const generateAuthToken = functions.https.onCall(async (wpToken: WPToken, context) => {
    if (!await validateWPToken(wpToken)) {
        return null
    }

    const customToken = await admin.auth().createCustomToken('test', {
        wpId: `wp:${wpToken.userId}`,
        premiumUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10)
    })
    return {customToken}
})

async function validateWPToken(token: WPToken): Promise<boolean> {
    const secret = functions.config().auth ? functions.config().auth.secret : process.env.AUTH_SECRET
    const plainText = [token.userId, token.createdWhen, secret].join('|')
    const result = await bcrypt.compare(plainText, token.hash.replace(/^\$2y\$/, '$2b$'))
    console.log(secret, plainText, result)
    return result
}

/**
 * New Auth functionality
 */


/**
 * Helper to format consistent error responses from this API
 */
const errorResponse = (type: string, message: string) => ({
    error: type,
    message,
})

const notAuthenticatedResponse = errorResponse('auth', 'Not Authenticated')

/**
 * Helper function to set the user Auth context of an emulator
 * @param context
 */
const helpTesting = (context: any) => {
    if (runningInEmulator) {
        context.auth = testUserDetails
    }
    return context;
}
const testUserDetails = {
    uid: 'CGPoLZClUlh1pIejEFwKjv3lCl32',
    token: {"email": "test@example.com"},
}

/**
 * Helper function to extract user details from firebase function auth context object
 */
const getUser = (context: any) => ({
    id: context.auth.uid,
    email: context.auth.token.email,
})

/**
 * Helper function to extract Chargebee config from firebase function config
 */
const getChargebeeOptions = () => ({
    site: functions.config().chargebee.site,
    api_key: functions.config().chargebee.api_key,
})

/**
 *  Creates a function to return Chargebee API responses consistently
 *  using the provided object key to access a hosted page url.
 */
const resultFormatter = (error: any, result: any) => {
    if (error != null) {
        return errorResponse('provider', error)
    }

    if (result == null) {
        return errorResponse(
            'provider',
            `No hosted page returned`,
        )
    }

    return {result};
}

/**
 * Firebase Function
 *
 * Calls the Chargebee API to return a link to a hosted page,
 * to Checkout a plan for the authenticated user.
 */
const getCheckoutLink = functions.https.onCall(
    async (data: any, _context: CallableContext) => {
        const context = helpTesting(_context)
        if (context.auth == null) {
            return notAuthenticatedResponse
        }

        // todo: move this up to the global import runtime context if the tests are okay with it
        chargebee.configure(getChargebeeOptions())

        const checkoutOptions = {
            subscription: {plan_id: data.planId},
            customer: getUser(context),
        }

        const result = await chargebee.hosted_page
            .checkout_new(checkoutOptions)
            .request(resultFormatter)

        return result;
    },
)

/**
 * Firebase Function
 *
 * Calls the Chargebee API to return a link to a hosted page,
 * to manage subscriptions for the authenticated user.
 */
const getManageLink = functions.https.onCall(
    async (data: any, _context: CallableContext) => {
        const context = helpTesting(_context)
        if (context.auth == null) {
            return notAuthenticatedResponse
        }

        chargebee.configure(getChargebeeOptions())

        const portalOptions = {
            redirect_url: data.redirectUrl,
            customer: getUser(context),
        }

        const result = await chargebee.portal_session
            .create(portalOptions)
            .request(resultFormatter)

        return result
    },
)

/**
 * Shared Function
 *
 * Refresh a user's subscription status - Asks Chargebee for the subscription status for this user,
 * then updates the value in the JWT auth token's user claims.
 *
 */
interface Claims {
    subscriptions: { [key: string]: { expiry: number } }
    features: string[]
    lastSubscribed: number | null
}

const _refreshUserSubscriptionStatus = async (userId: string) => {
    chargebee.configure(getChargebeeOptions())

    const claims: Claims = {
        subscriptions: {},
        features: [],
        lastSubscribed: null,
    }

    const subscriptionQuery = {
        'customer_id[is]': userId,
        'sort_by[desc]': 'created_at',
        'limit': 100,
    }

    // Query the Chargebee API for this user's subscriptions, adding every active/in_trial sub to the claims object.
    // any past subscription updates the lastSubscribed property to know whether a user has subscribed in the past.
    await chargebee.subscription
        .list(subscriptionQuery)
        .request(function (error: any, resp: any) {
            if (error) {
                console.error(error)
            } else {
                const subsList = resp.list;
                if (resp && subsList && Object.entries(subsList).length > 0) {

                    claims.lastSubscribed = subsList[0].subscription.createdAt

                    for (const entry of subsList) {
                        if (
                            entry.subscription.status === 'active' ||
                            entry.subscription.status === 'in_trial' ||
                            entry.subscription.status === 'cancelled' || // Cancelled subscriptions may still have days left
                            entry.subscription.status === 'non_renewing' // Non-renewing subscriptions may still have days left
                        ) {
                            // N.B. `current_term_end` will be present for the case of a cancelled or non_renewing subscription
                            // that still has 'time left' being subscribed.
                            // next_billing_at will be present when a subscription is active or in trial, and will
                            // indicate up till when we can trust the the user is subscribed.
                            const expiry = entry.subscription['current_term_end'] || entry.subscription['next_billing_at']

                            const subPlanId = entry.subscription.plan_id
                            const existingSubscription = claims.subscriptions[subPlanId];

                            // N.B. In case a user has more than one subscription to the same plan,
                            // (e.g. newly configured plan or an old trial) make sure that the furthest expiry date is set.
                            if (existingSubscription == null || existingSubscription.expiry == null || existingSubscription.expiry < expiry) {
                                claims.subscriptions[subPlanId] = {expiry}
                            }
                        }
                    }
                }
                addSubscribedFeatures(claims);
            }
        });

    // N.B. Claims are always reset, not additive
    await admin.auth().setCustomUserClaims(userId, claims)

    return {"result": claims};
}

function addSubscribedFeatures(claims: Claims) {
    for (const subscriptionKey of Object.keys(claims.subscriptions)) {
        const features = subscriptionToFeatures[subscriptionKey]
        if (features != null) {
            claims.features.push(...features);
        }
    }
}

const subscriptionToFeatures: { [key: string]: string[] } = {
    pro: ['backup', 'sync'],
    free: [],
}

/**
 * Firebase Function
 *
 * Calls the refresh function above with the authenticated user's details
 */
const refreshUserClaims = functions.https.onCall(
    async (data: any, _context: CallableContext) => {
        const context = helpTesting(_context)
        if (context.auth == null) {
            return notAuthenticatedResponse
        }

        // Enhancement: add rate limiting to this function

        return _refreshUserSubscriptionStatus(context.auth.uid)
    },
)

/**
 * Firebase HTTP Function (server - server) (webhook)
 *
 * Called by the Chargebee API when a user subscription changes
 * Calls the refresh function above with the specified user's details
 *
 */
const userSubscriptionChanged = functions.https.onRequest(
    async (req: Request, resp: any) => {
        // TODO: Verify secret or host
        // TODO: Filter types of subscription change

        if (req.is('json') && req.body != null && req.body.content != null && req.body.content.customer != null) {
            const userId = req.body.content.customer.id
            await _refreshUserSubscriptionStatus(userId)
        }

    },
)

export {
    getManageLink,
    getCheckoutLink,
    refreshUserClaims,
    userSubscriptionChanged,
}
