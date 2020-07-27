import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { CallableContext, Request } from 'firebase-functions/lib/providers/https'
import { ChargebeeSubscriptionAPIClient, CustomClaimsSetter, refreshUserSubscriptionStatus } from "./subscriptions";
import { helpTesting, notAuthenticatedResponse, getUser, resultFormatter } from '../utils';
import * as express from "express";

const chargebee = require('chargebee')

/**
 * Helper function to extract Chargebee config from firebase function config, requires config to be set from cli.
 */
const getChargebeeOptions = () => ({
    site: functions.config().chargebee.site,
    api_key: functions.config().chargebee.api_key,
})
chargebee.configure(getChargebeeOptions())

/**
 * Firebase Function
 *
 * Calls the Chargebee API to return a link to a hosted page,
 * to Checkout a plan for the authenticated user.
 */
export const getCheckoutLink = functions.https.onCall(
    async (data: any, _context: CallableContext) => {
        const context = helpTesting(_context)
        if (context.auth == null) {
            return notAuthenticatedResponse
        }

        chargebee.configure(getChargebeeOptions())

        const checkoutOptions = {
            subscription: { plan_id: data.planId },
            customer: getUser(context),
            "redirect_url": undefined,
        }

        if (data["redirect_url"]) {
            checkoutOptions["redirect_url"] = data["redirect_url"]
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
export const getManageLink = functions.https.onCall(
    async (data: any, _context: CallableContext) => {
        const context = helpTesting(_context)
        if (context.auth == null) {
            return notAuthenticatedResponse
        }

        chargebee.configure(getChargebeeOptions())

        // If the client has passed `subscription_id` as a placeholder in the `forward_url`, replace it with the latest subscription they have.
        if (data["forward_url"] && data["forward_url"]?.includes('subscription_id')) {
            const subscriptionId = await getLatestUserSubscriptionId(context.auth.uid,chargebeeSubscriptionAPIClient )
            if (!subscriptionId) {
                console.error(`Error replacing forward_url - No Subscription Id for user ${context.auth.uid} returned from chargebee`)
            }
            data["forward_url"] = data["forward_url"].replace('subscription_id',subscriptionId)
        }

        const portalOptions = {
            customer: getUser(context),
            "redirect_url": data["redirect_url"],
            "forward_url": data["forward_url"],
        }

        console.log("Portal opened with",{portalOptions})

        const result = await chargebee.portal_session
            .create(portalOptions)
            .request(resultFormatter)

        return result
    },
)

const getLatestUserSubscriptionId = async (userId : string, getSubscriptions : ChargebeeSubscriptionAPIClient) : Promise<string> => {
    const subscriptionQuery = {
        'customer_id[is]': userId,
        'sort_by[desc]': 'created_at',
        'limit': 100,
    }
    const resp = await getSubscriptions(subscriptionQuery)
    return resp.list.pop()?.subscription.id;
}

const chargebeeSubscriptionAPIClient: ChargebeeSubscriptionAPIClient = async (subscriptionQuery) => {
    return chargebee.subscription.list(subscriptionQuery).request()
}
const firebaseAuthClaimsSetter: CustomClaimsSetter = async (userId, claims) => admin.auth().setCustomUserClaims(userId, claims);

const _refreshUserSubscriptionStatus = async (userId: string) => refreshUserSubscriptionStatus(userId, {
    getSubscriptions: chargebeeSubscriptionAPIClient,
    setClaims: firebaseAuthClaimsSetter,
})

/**
 * Firebase Function
 *
 * Calls the refresh function above with the authenticated user's details
 */
export const refreshUserClaims = functions.https.onCall(
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
export const userSubscriptionChanged = functions.https.onRequest(
    async (req: Request, resp: express.Response) => {
        // TODO: Verify secret or host
        // TODO: Filter types of subscription change

        resp.send();

        // if (req.is('json') && req.body != null && req.body.content != null && req.body.content.customer != null) {
        //     const userId = req.body.content.customer.id
        //     await _refreshUserSubscriptionStatus(userId)
        // }
    },
)
