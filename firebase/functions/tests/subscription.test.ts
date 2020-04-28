import 'mocha';
import { expect } from 'chai';
import { refreshUserSubscriptionStatus } from '../src/subscriptions/subscriptions';

describe('Subscriptions', async () => {

    it('should receive subscriptions for a user from the Chargebee API and set the claims accordingly', async () => {

        const now = Date.now();
        const time = now + 1000;
        await refreshUserSubscriptionStatus('testUser', {
            getSubscriptions: (query) => ({
                "list": [
                    {
                        subscription: {
                            status: 'active',
                            plan_id: 'pro-monthly',
                            created_at: now,
                            next_billing_at: time,
                        },
                    },
                ],
            }),
            setClaims: (userId, claims) => {
                expect(userId).to.equal('testUser');
                expect(claims).to.deep.equal({
                    subscriptionExpiry: time,
                    subscriptionStatus: "active",
                    subscriptions: { 'pro-monthly': {
                        expiry: time,
                        status: 'active',
                        },
                    },
                    features: {
                        'backup': {
                            expiry: time,
                        } ,
                        'sync': {
                            expiry: time,
                        }
                    },
                    lastSubscribed: now,
                })
            }
        })

    });

});
