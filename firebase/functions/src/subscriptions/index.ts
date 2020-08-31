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
            redirect_url: undefined,
            addons: {},
        }

        if (data.redirect_url) {
            checkoutOptions.redirect_url = data.redirect_url
        }

        if (data?.pioneerDonationAmount) {
            checkoutOptions.addons = [{
                "id": `pioneer${data.planId.includes('yearly') ? '-yearly' : ''}`,
                unit_price: Math.max(data.pioneerDonationAmount * 100,100),
                quantity: 1,
            }]
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

        const portalOptions = {
            customer: getUser(context),
            "redirect_url": undefined,
            "access_url": undefined,
        }

        if (data["redirect_url"]) {
            portalOptions["redirect_url"] = data["redirect_url"]
        }

        if (data["access_url"]) {
            portalOptions["access_url"] = data["access_url"]
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
