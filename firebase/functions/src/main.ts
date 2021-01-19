import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions';

import { activityStreamFunctions } from '@worldbrain/memex-common/lib/activity-streams/services/firebase-functions/server'

import { runningInEmulator, emulatedConfig } from './constants';
import { createFirestoreTriggers } from '@worldbrain/memex-common/lib/firebase-backend/setup';

admin.initializeApp((runningInEmulator) ? emulatedConfig : undefined);

export { getLoginToken } from './auth'
export { getCheckoutLink, getManageLink, userSubscriptionChanged, refreshUserClaims } from './subscriptions'
export { generateTwilioNTSToken } from './twilio'
export { sendWelcomeEmailOnSignUp } from "./user";
export { scheduledFirestoreExport } from "./backup";
export { uninstall, uninstallLog } from "./analytics"
export { registerBetaUserCall as registerBetaUser } from "./beta"
export const activityStreams = activityStreamFunctions({
    firebase: admin as any,
    functions,
})
export const triggers = createFirestoreTriggers({
    firebase: admin as any,
    functions,
})
