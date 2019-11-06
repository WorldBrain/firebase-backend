import {Claims, UserFeatures, UserPlans} from "./types";

export interface SusbcriptionQuery {
    'customer_id[is]': string,
    'sort_by[desc]': string,
    'limit': number,
}
export type ChargebeeSubscriptionAPIClient = (subscriptionQuery: SusbcriptionQuery) => any

export type CustomClaimsSetter = (userId: string, claims: Claims) => any;

/**
 * Shared Function
 *
 * Refresh a user's subscription status - Asks Chargebee for the subscription status for this user,
 * then updates the value in the JWT auth token's user claims.
 *
 */
export const refreshUserSubscriptionStatus = async (userId: string, {getSubscriptions, setClaims}: {getSubscriptions: ChargebeeSubscriptionAPIClient, setClaims: CustomClaimsSetter}) => {

    const claims: Claims = {
        subscriptions: {},
        features: {},
        lastSubscribed: null,
    }

    const subscriptionQuery = {
        'customer_id[is]': userId,
        'sort_by[desc]': 'created_at',
        'limit': 100,
    }

    // Query the Chargebee API for this user's subscriptions, adding every active/in_trial sub to the claims object.
    // any past subscription updates the lastSubscribed property to know whether a user has subscribed in the past.
    const resp = await getSubscriptions(subscriptionQuery)
    const subsList = resp.list;
    if (resp && subsList && subsList.length > 0) {

        claims.lastSubscribed = subsList[0].subscription['created_at']

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
                // console.log(`Valid subscription for UserId:${userId}, planId:${subPlanId}, expiry:${expiry}`);

                const existingSubscription = claims.subscriptions[subPlanId];
                // N.B. In case a user has more than one subscription to the same plan,
                // (e.g. newly configured plan or an old trial) make sure that the furthest expiry date is set.
                if (existingSubscription == null || existingSubscription.expiry < expiry) {
                    claims.subscriptions[subPlanId] = {expiry}
                }
            }
        }
    }


    setFeaturesFromSubscriptions(claims);

    // N.B. Claims are always reset, not additive
    // console.log(`setCustomUserClaims(${userId},${JSON.stringify(claims)})`)
    const setClaimResult = await setClaims(userId, claims)
    return {"result": {claims, setClaimResult}};
}

const setFeaturesFromSubscriptions = (claims: Claims) => {
    // For each subscription, add the corresponding feature
    for (const subscriptionKey of Object.keys(claims.subscriptions)) {
        const subscription = claims.subscriptions[subscriptionKey]
        const subscriptionFeatures = subscriptionToFeatures.get(subscriptionKey as UserPlans)
        if (subscriptionFeatures != null && subscription != null) {
            for (const feature of subscriptionFeatures) {
                claims.features[feature] = {expiry: subscription.expiry}
            }
        }
    }
}

export const subscriptionToFeatures = new Map<UserPlans,UserFeatures[]>([
    ["free", []],
    ["backup-monthly",  ['backup']],
    ["backup-yearly",  ['backup']],
    ["sync-monthly",  ['backup','sync']],
    ["sync-yearly",  ['backup','sync']]
])

