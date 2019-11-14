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
        if (expiry != null) {
            this.claims = {
                subscriptions: {},
                features: {},
                lastSubscribed: null,
            }
            this.claims.subscriptions['backup-monthly'] = { expiry }
            this.claims.subscriptions['sync-monthly'] = { expiry }
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
