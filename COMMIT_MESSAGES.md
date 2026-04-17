# Commit Messages for OpenPGP Extension Updates

## Commit 1: Add public key import and storage system
```
feat: Add separate storage and management for imported public keys

- Add PUBLIC_KEYS_STORAGE_KEY constant for separate public key storage
- Implement importPublicKey() method to import and validate public keys
- Implement storePublicKey() to persist public keys in browser storage
- Add getAllPublicKeys() to retrieve all stored public keys
- Add getPublicKeyByFingerprint() to fetch specific public keys
- Add deletePublicKey() to remove public keys from storage

Public keys are now stored separately from private key pairs, enabling
better organization and management of encryption recipients.
```

## Commit 2: Auto-detect key type during import
```
feat: Auto-detect private vs public keys during import

- Modify importKey() to automatically detect key type
- Try reading as private key first, fall back to public key
- Only require passphrase for private key imports
- Public keys can be imported without passphrase
- Show appropriate success messages for each key type
- Update import form labels to clarify both key types accepted

Users no longer need to specify key type - the extension intelligently
detects whether a pasted key is private or public and handles it
accordingly.
```

## Commit 3: Add imported public keys display section
```
feat: Display imported public keys in dedicated UI section

- Add refreshPublicKeys() method to populate public keys list
- Display public keys in "Imported Public Keys" collapsible section
- Show key name, email, fingerprint, and import date
- Add Export and Delete buttons for each public key
- Implement exportStoredPublicKey() for exporting keys
- Implement deletePublicKey() with confirmation dialog
- Auto-refresh public keys list after import

Public keys now have their own dedicated display section separate
from the user's own key pairs.
```

## Commit 4: Add public key dropdown to Encrypt tab
```
feat: Add dropdown selector for public keys in Encrypt tab

- Add dropdown to select from imported public keys
- Implement updateEncryptPublicKeysDropdown() to populate options
- Display key name, email, and fingerprint preview in dropdown
- Add toggle checkbox to switch between dropdown and manual entry
- Hide manual textarea by default, show when toggle is checked
- Modify encrypt() method to retrieve key from dropdown or manual entry
- Auto-populate dropdown when public keys are imported

Users can now easily select recipient public keys from a dropdown
instead of pasting them manually every time.
```

## Commit 5: Add public key dropdown to Decrypt tab
```
feat: Add dropdown selector for signature verification in Decrypt tab

- Add dropdown to select sender's public key for verification
- Implement updateDecryptPublicKeysDropdown() to populate options
- Add toggle checkbox to switch between dropdown and manual entry
- Hide manual textarea by default, show when toggle is checked
- Modify decrypt() method to retrieve verification key from dropdown
- Mark dropdown as optional since signature verification is optional
- Auto-populate dropdown when public keys are imported

Users can now easily select sender public keys for signature
verification from a dropdown instead of pasting them manually.
```

## Commit 6: Fix decrypt to handle signed-only messages
```
fix: Handle signed-only messages in decrypt function

- Add packet inspection to detect if message is encrypted
- Branch logic based on whether message is encrypted or only signed
- For signed-only messages, extract literal data without decryption
- Verify signatures on signed-only messages if key provided
- Handle signature verification results properly
- Fix "Session key decryption failed" error for signed messages
- Improve signature info reporting for all message types

Previously, the decrypt function assumed all non-cleartext messages
were encrypted, causing errors when processing signed-only messages.
Now correctly handles encrypted, signed, and encrypted+signed messages.
```

## Summary
These updates significantly improve the user experience for managing public keys and handling different PGP message types. The extension now provides a more streamlined workflow for encryption and decryption operations.
