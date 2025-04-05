# firebase-backend

## Running Firebase backend locally

1. (one time thing) Init emulators

```bash
nvm use

# Ensure you check firestore, auth, functions, database
yarn firebase emulators:init
```

2. Start the Firebase emulators

```bash
nvm use

yarn firebase emulators:start
```

You should now see the addresses for all cloud functions available locally.

e.g., `http://127.0.0.1:5001/worldbrain-staging/us-central1/publicApi-getPersonalKeys`

3. (optional) Set up Memex Social to point to the emulator

In the **Memex Social repo**:

```bash
nvm use

# Skip if up-to-date
yarn bootstrap

cd frontend/

REACT_APP_BACKEND=firebase-emulator yarn start
```

## Deploying Node cloud functions

```bash
nvm use

# Swap out `staging` for `production` as needed.
yarn firebase -P staging deploy --only functions:bsky-initiateOAuthFlow,functions:bsky-handleOAuthRedirect

```

## Deploying Python cloud functions

```bash
scripts/deploy-python-functions.sh
```

See bash script for more details.
