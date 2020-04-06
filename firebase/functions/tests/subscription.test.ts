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
                            plan_id: 'backup-monthly',
                            created_at: now,
                            next_billing_at: time,
                        },
                    },
                ],
            }),
            setClaims: (userId, claims) => {
                expect(userId).to.equal('testUser');
                expect(claims).to.deep.equal({
                    subscriptions: { 'backup-monthly': { expiry: time } },
                    features: { 'backup': { expiry: time } },
                    lastSubscribed: now,
                })
            }
        })

    });

});
