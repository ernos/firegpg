# OpenPGP Extension v5.0 Release Notes

## Overview

Version 5.0 is a milestone release focused on broadening the extension's appeal beyond its original niche. The extension gets a cleaner identity, a more discoverable store listing, and a major new feature: **file encryption and decryption** — making it useful to anyone who needs to protect files, not just PGP message users.

---

## What's New

### New Name: PGP Suite – Encrypt Messages & Files
The extension has been renamed from *"OpenPGP - Encrypt/Decrypt/Sign/Verify"* to **"PGP Suite – Encrypt Messages & Files"**. The new name communicates what the extension actually does at a glance and includes keywords people search for.

### Improved Store Description
The description has been rewritten to be:
- Shorter and more readable
- Focused on concrete use cases (email privacy, file sharing, no external tools)
- SEO-friendly for searches like "encrypt files", "PGP Firefox", "OpenPGP browser"
- Neutral in tone — no longer targeting only Tor/dark web users

### File Encryption (New Feature)
A brand-new **Files** tab has been added to the sidebar with two operations:

**Encrypt a file**
- Select any file from your filesystem
- Choose a recipient from your imported public keys (or paste a key manually)
- The file is encrypted using OpenPGP and saved as `filename.pgp`
- The original filename is embedded inside the encrypted message and restored on decryption

**Decrypt a file**
- Select a `.pgp` or `.asc` encrypted file
- Choose your private key and enter your passphrase
- The original file is decrypted and saved with its original filename restored

File encryption uses the same OpenPGP.js library and key infrastructure already in the extension — no new dependencies.

---

## Changes

| Area | Change |
|---|---|
| `manifest.json` | New name and description |
| `templates/manifest.template` | Same — kept in sync |
| `js/pgp-handler.js` | Added `encryptFile()` and `decryptFile()` methods |
| `index.html` | Added "Files" tab button and tab content (encrypt + decrypt file sections) |
| `js/ui.js` | Added `FileController` class; added `fileController` module-level variable; `TabManager.switchTab` refreshes file dropdowns on tab switch |

---

## Upgrade Notes

No storage migrations or breaking changes. Existing keys, backups, and master password settings are unaffected.
