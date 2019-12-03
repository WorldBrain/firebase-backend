export interface SubscriptionsService {
    getCurrentUserClaims(): Promise<Claims | null>
    getCheckoutLink(options: SubscriptionCheckoutOptions): Promise<string>
    getManageLink(options?: SubscriptionCheckoutOptions): Promise<string>
}

export interface Claims {
    subscriptions: SubscriptionMap
    features: FeatureMap
    lastSubscribed: number | null
}
export type SubscriptionMap = {
    [key in UserPlan]?: { expiry: number }
}
export type FeatureMap = {
    [key in UserFeature]?: { expiry: number }
}
export type UserFeature = 'backup' | 'sync'
export type UserPlan =
    | 'pro-monthly'
    | 'pro-yearly'


export interface SubscriptionCheckoutOptions {
    planId: UserPlan
}
