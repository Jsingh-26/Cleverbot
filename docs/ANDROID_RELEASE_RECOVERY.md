# Android release recovery

Cleverbot Android updates must keep package ID `com.jsingh26.cleverbot` and use the same production signing key. Losing the key prevents updates over an installed production APK.

The private signing key is not stored in this repository. Recovery material is held in the owner's encrypted secret vault and should also be exported once to the owner's private storage after Firebase setup. GitHub's `android-production` environment holds the CI copy as secrets:

- `CLEVERBOT_KEYSTORE_B64`
- `CLEVERBOT_KEYSTORE_PASSWORD`
- `CLEVERBOT_KEY_PASSWORD`
- `FIREBASE_APP_ID`
- `FIREBASE_TOKEN`

The alias is `cleverbot-release`. Every release must increment `versionCode`. Use the manual `Build and distribute private Android APK` workflow only after the main branch update is approved.
