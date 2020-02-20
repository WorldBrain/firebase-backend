import { EventEmitter } from 'events'
import TypedEventEmitter from 'typed-emitter'
import { AuthService, AuthenticatedUser, AuthServiceEvents } from './types'

export class WorldbrainAuthService implements AuthService {
    public events = new EventEmitter() as TypedEventEmitter<AuthServiceEvents>

    constructor(private firebase: any) {
        firebase.auth().onAuthStateChanged((firebaseUser: any) => {
            const user = this._getUserFromFirebaseUser(firebaseUser)
            this.events.emit('changed', { user })
        })
    }

    async getCurrentUser() {
        return this._getUserFromFirebaseUser(this.firebase.auth().currentUser)
    }

    async getCurrentToken(): Promise<{ token: string | null }> {
        const user = this.firebase.auth().currentUser

        if (!user) {
            return { token: null }
        }

        return { token: await user.getIdToken() }
    }

    async _waitForCurrentUser(ms:number): Promise<any> {
        let unsubscribe : () => void;

        const currentUser = new Promise<void>((resolve,reject) => {
            unsubscribe = this.firebase.auth().onAuthStateChanged(async () => {
                const firebaseUser = this.firebase.auth().currentUser
                if (!firebaseUser) {
                    return
                }
                unsubscribe()
                resolve(firebaseUser)
            })

        })
        const timeout = new Promise(resolve => setTimeout(() => {
            unsubscribe()
            resolve(false)
        }, ms));

        return Promise.race([
            currentUser,
            timeout
        ])
    }

    async refreshUserInfo() {
        const firebaseUser = await this._waitForCurrentUser(500)
        if (!firebaseUser) {
            console.warn(`Failed to refreshUserInfo`)
            return
        }

        await this._callFirebaseFunction('refreshUserClaims')
        await firebaseUser.reload()
        await firebaseUser.getIdToken(true)
        this.events.emit('changed', { user: await this.getCurrentUser() })
    }

    async generateLoginToken() {
        const response: { data: string } = await this._callFirebaseFunction(
            'getLoginToken',
        )
        return { token: response.data }
    }

    async loginWithToken(token: string) {
        await this.firebase.auth().signInWithCustomToken(token)
    }

    signOut() {
        this.firebase.auth().signOut()
    }

    _getUserFromFirebaseUser(
        user?: any,
        // user?: FirebaseAuthTypes.User | null,
    ): AuthenticatedUser | null {
        if (!user) {
            return null
        }
        return {
            id: user.uid,
            displayName: user.displayName,
            email: user.email,
            emailVerified: user.emailVerified,
        }
    }

    _callFirebaseFunction(name: string, ...args: any[]) {
        return this.firebase.functions().httpsCallable(name)(...args)
    }
}
