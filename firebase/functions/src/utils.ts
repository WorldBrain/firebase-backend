import { runningInEmulator, testUserDetails } from "./constants";
import { CallableContext } from "firebase-functions/lib/providers/https";

/**
 * Helper to format consistent error responses from this API
 */
export const errorResponse = (type: string, message: string) => ({
    error: type,
    message,
})

export const notAuthenticatedResponse = errorResponse('auth', 'Not Authenticated')

/**
 * Helper function to set the user Auth context of an emulator
 * @param context
 */
export const helpTesting = (context: CallableContext) => {
    if (runningInEmulator) {
        context.auth = testUserDetails as any
    }
    return context;
}


/**
 * Helper function to extract user details from firebase function auth context object
 */
export const getUser = (context: any) => ({
    id: context.auth.uid,
    email: context.auth.token.email,
})



/**
 *  Creates a function to return Chargebee API responses consistently
 *  using the provided object key to access a hosted page url.
 */
export const resultFormatter = (error: any, result: any) => {
    if (error != null) {
        return errorResponse('provider', error)
    }

    if (result == null) {
        return errorResponse(
            'provider',
            `No hosted page returned`,
        )
    }

    return { result };
}
