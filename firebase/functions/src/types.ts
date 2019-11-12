// These are key-values that a client is verified to have by authenticating, e.g. Coming from a JWT token.
export interface Claims {
    subscriptions: SubscriptionMap
    features: FeatureMap
    lastSubscribed: number | null
}

export type UserFeatures = "backup" | "sync"
export type UserPlans = "free" |
    "pro-1-device" |
    "pro-2-devices" |
    "pro-3-devices" |
    "pro-4-devices" |
    "pro-1-device-yrl" |
    "pro-2-devices-yrl" |
    "pro-3-devices-yrl" |
    "pro-4-devices-yrl"

export interface SubscriptionMap {[key: string]: {expiry:number}}
export interface FeatureMap {[key: string]: {expiry:number}}
