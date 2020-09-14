import * as admin from 'firebase-admin'
import { runningInEmulator, emulatedConfig } from './constants';
admin.initializeApp((runningInEmulator) ? emulatedConfig : undefined);

export { getLoginToken } from './auth'
export { getCheckoutLink, getManageLink, userSubscriptionChanged, refreshUserClaims } from './subscriptions'
export { generateTwilioNTSToken } from './twilio'
export { sendWelcomeEmailOnSignUp } from "./user";
export { scheduledFirestoreExport } from "./backup";
