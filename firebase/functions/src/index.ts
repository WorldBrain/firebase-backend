import * as admin from 'firebase-admin'
import { runningInEmulator, emulatedConfig } from './constants';

admin.initializeApp((runningInEmulator) ? emulatedConfig : undefined);

export * from './auth'
export * from './subscriptions'
export * from './twilio'
