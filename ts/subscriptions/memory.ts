import {
    SubscriptionsService,
    Claims,
    SubscriptionCheckoutOptions,
} from './types'

export class MemorySubscriptionsService
    implements SubscriptionsService {

    public claims: Claims | null = null

    constructor(options: { expiry?: number } = {}) {
        const { expiry } = options
        if (expiry) {
            this.claims = {
                subscriptions: {},
                features: {},
                lastSubscribed: null,
            }
            this.claims.subscriptions['pro-1-device'] = { expiry }
            this.claims.features['backup'] = { expiry }
            this.claims.features['sync'] = { expiry }
        }
    }

    async getCurrentUserClaims(forceRefresh = false): Promise<Claims | null> {
        return this.claims
    }

    async getCheckoutLink(
        options: SubscriptionCheckoutOptions,
    ): Promise<string> {
        return `https://checkout.link?plan=${options.plan}`
    }

    async getManageLink(
        options?: SubscriptionCheckoutOptions,
    ): Promise<string> {
        return `https://manage.link`
    }
}
