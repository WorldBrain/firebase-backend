import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import {CallableContext, Request} from 'firebase-functions/lib/providers/https'
import {ChargebeeSubscriptionAPIClient, CustomClaimsSetter, refreshUserSubscriptionStatus} from "./subscriptions";

const chargebee = require('chargebee')

const runningInEmulator = process.env.FUNCTIONS_EMULATOR
const emulatedConfig = {
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://worldbrain-staging.firebaseio.com",
    projectId: "worldbrain-staging",
}
admin.initializeApp((runningInEmulator) ? emulatedConfig : undefined);


/**
 * New Auth functionality
 */

/**
 * Helper function to extract Chargebee config from firebase function config, requires config to be set from cli.
 */
const getChargebeeOptions = () => ({
    site: functions.config().chargebee.site,
    api_key: functions.config().chargebee.api_key,
})
chargebee.configure(getChargebeeOptions())

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

export const getLoginToken = functions.https.onCall(    async (data: any, _context: CallableContext) => {
    const context = helpTesting(_context)
    return admin.auth().createCustomToken(context.uid)
});

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
            customer: getUser(context),
        }

        const result = await chargebee.portal_session
            .create(portalOptions)
            .request(resultFormatter)

        return result
    },
)

const chargebeeSubscriptionAPIClient: ChargebeeSubscriptionAPIClient = async (subscriptionQuery) => {
    return chargebee.subscription.list(subscriptionQuery).request()
}
const firebaseAuthClaimsSetter: CustomClaimsSetter = async (userId, claims) => admin.auth().setCustomUserClaims(userId, claims);

const _refreshUserSubscriptionStatus = async (userId: string) => refreshUserSubscriptionStatus(userId, {
    getSubscriptions: chargebeeSubscriptionAPIClient,
    setClaims: firebaseAuthClaimsSetter,
});
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
