// These are key-values that a client is verified to have by authenticating, e.g. Coming from a JWT token.
export interface Claims {
    subscriptions: SubscriptionMap
    features: FeatureMap
    lastSubscribed: number | null
}

export type UserFeatures = "backup" | "sync"
export type UserPlans = "free" | "backup-monthly" | "backup-yearly" | "sync-monthly" | "sync-yearly"
export type SubscriptionMap = {[key: string]: {expiry:number}}
export type FeatureMap = {[key: string]: {expiry:number}}
