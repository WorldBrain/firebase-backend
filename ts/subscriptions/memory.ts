import {
    SubscriptionsService,
    Claims,
    SubscriptionCheckoutOptions,
} from './types'

export default class MemorySubscriptionsService
    implements SubscriptionsService {

    public claims: Claims | null = null

    constructor() { }

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
