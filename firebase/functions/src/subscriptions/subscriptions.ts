import { Claims, UserFeature, UserPlan } from '@worldbrain/memex-common/lib/subscriptions/types'

export interface SusbcriptionQuery {
    'customer_id[is]': string,
    'sort_by[desc]': string,
    'limit': number,
}
export type ChargebeeSubscriptionAPIClient = (subscriptionQuery: SusbcriptionQuery) => any

export type CustomClaimsSetter = (userId: string, claims: Claims) => any;

// The grace period we add to Chargebee expiry dates, before marking as expired to us.
// to give them time to refresh the user's subscription / payment status.
const expiryGraceSecs = 60 * 5

/**
 * Shared Function
 *
 * Refresh a user's subscription status - Asks Chargebee for the subscription status for this user,
 * then updates the value in the JWT auth token's user claims.
 *
 */
export const refreshUserSubscriptionStatus = async (userId: string, { getSubscriptions, setClaims }: { getSubscriptions: ChargebeeSubscriptionAPIClient, setClaims: CustomClaimsSetter }) => {

    const claims: Claims = {
        subscriptions: {},
        subscriptionStatus: null,
        subscriptionExpiry: null,
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
                // trial_end or cancelled_at if the subscription is cancelled and there are no more days left
                let expiry = (
                    entry.subscription['current_term_end'] ||
                    entry.subscription['next_billing_at'] ||
                    entry.subscription['trial_end'] ||
                    entry.subscription['cancelled_at']
                )
                if (!expiry) {
                    console.error("Could not determine expiry for subscription:",entry.subscription)
                } else {
                    expiry += expiryGraceSecs
                }

                const subPlanId = entry.subscription.plan_id as UserPlan
                // console.log(`Valid subscription for UserId:${userId}, planId:${subPlanId}, expiry:${expiry}`);

                const existingSubscription = claims.subscriptions[subPlanId];
                // N.B. In case a user has more than one subscription to the same plan,
                // (e.g. newly configured plan or an old trial) make sure that the furthest expiry date is set.
                if (existingSubscription == null || existingSubscription.expiry < expiry) {

                    const donationAddOnObject = entry.subscription?.addons?.find(
                        (addOn: any) => addOn.id === 'pioneer' || addOn.id === 'pioneer-yearly'
                    )
                    const donation = (donationAddOnObject) ? {
                        donation: donationAddOnObject.unit_price * donationAddOnObject.amount
                    } : {}

                    // Set subscription specific expiry and status
                    claims.subscriptions[subPlanId] = {
                        expiry,
                        status: entry.subscription.status,
                        ...donation
                    }

                    // Update overall subscription status
                    claims.subscriptionStatus = entry.subscription.status
                    claims.subscriptionExpiry = expiry
                }
            }
        }

    }


    setFeaturesFromSubscriptions(claims);
    setFeaturesIfDonated(claims);

    // N.B. Claims are always reset, not additive
    // console.log(`setCustomUserClaims(${userId},${JSON.stringify(claims)})`)
    const setClaimResult = await setClaims(userId, claims)
    // console.log("result",{ "result": { claims, setClaimResult } })
    return { "result": { claims, setClaimResult } };
}

const setFeaturesFromSubscriptions = (claims: Claims) => {
    // For each subscription, add the corresponding feature
    for (const subscriptionKey of Object.keys(claims.subscriptions)) {
        const subscription = claims.subscriptions[subscriptionKey as UserPlan]
        const subscriptionFeatures = subscriptionToFeatures.get(subscriptionKey as UserPlan)
        if (subscriptionFeatures != null && subscription != null) {
            for (const feature of subscriptionFeatures) {
                claims.features[feature] = { expiry: subscription.expiry }
            }
        }
    }
}

const setFeaturesIfDonated = (claims: Claims) => {
    for (const subscriptionKey of Object.keys(claims.subscriptions)) {
        const subscription = claims.subscriptions[subscriptionKey as UserPlan]
        if (subscription && (subscription?.donation ?? 0) > 0){
            claims.features.beta = { expiry: subscription.expiry }
        }
    }
}

export const subscriptionToFeatures = new Map<UserPlan, UserFeature[]>([
    ["pro-yearly", ['backup', 'sync']],
    ["pro-monthly", ['backup', 'sync']],
])

