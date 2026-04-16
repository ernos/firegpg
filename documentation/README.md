# OpenPGP Extension

A comprehensive Firefox extension for PGP/PGP encryption, decryption, signing, and verification directly in your browser.

## Features

 **Complete PGP Functionality**
- Generate RSA key pairs
- Encrypt messages with public keys
- Decrypt messages with private keys
- Sign messages (cleartext and detached)
- Verify signatures
- Import/Export keys
- Auto-detect PGP content on web pages

 **User-Friendly Interface**
- Clean sidebar interface
- Tab-based navigation
- Copy-to-clipboard functionality
- Context menu integration
- Real-time status feedback

 **Developer-Friendly**
- Extensive code comments
- Debug logging (toggleable)
- No minification or obfuscation
- Clean, maintainable code structure

## Installation

### Step 1: Download OpenPGP.js Library

This extension requires the OpenPGP.js library for cryptographic operations.

1. Visit the OpenPGP.js releases page: https://github.com/openpgpjs/openpgpjs/releases
2. Download the latest version (e.g., `openpgp.min.js`)
3. Place it in the `lib/` directory of this extension as `openpgp.min.js`

**Or use this direct command:**

```bash
# Create lib directory
mkdir -p lib

# Download OpenPGP.js (version 5.x)
curl -L -o lib/openpgp.min.js https://unpkg.com/openpgp@5/dist/openpgp.min.js
```

### Step 2: Create Icon Files

Create placeholder icon files in the `icon/` directory:

```bash
mkdir -p icon
```

You can use any PNG images (19x19, 38x38, and 64x64 pixels) or create simple placeholders.

### Step 3: Load Extension in Firefox

#### For Development/Testing (Temporary):

1. Open Firefox
2. Type `about:debugging` in the address bar
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on"
5. Navigate to the extension directory and select `manifest.json`

#### For Permanent Installation:

1. Package the extension: `zip -r OpenPGP.xpi *`
2. Open Firefox
3. Go to `about:addons`
4. Click the gear icon → "Install Add-on From File"
5. Select the `OpenPGP.xpi` file

**Note:** For production use, you'll need to sign the extension through Mozilla's Add-on store.

## Usage

### Opening the Extension

- Click the OpenPGP icon in the toolbar, OR
- Go to View → Sidebar → OpenPGP

### Generating Your First Key Pair

1. Open the sidebar
2. Go to the "Keys" tab
3. Fill in your name, email, and a strong passphrase
4. Click "Generate Key Pair"
5. Wait about 30-60 seconds for key generation to complete

### Encrypting a Message

1. Go to the "Encrypt" tab
2. Paste the recipient's public key
3. Type your message
4. Optionally check "Sign message with my key"
5. Click "Encrypt Message"
6. Copy the encrypted output

### Decrypting a Message

1. Go to the "Decrypt" tab
2. Paste the encrypted message
3. Select your private key
4. Enter your passphrase
5. Click "Decrypt Message"

### Signing a Message

1. Go to the "Sign" tab
2. Type your message
3. Select your private key
4. Enter your passphrase
5. Choose signature type (cleartext or detached)
6. Click "Sign Message"

### Verifying a Signature

1. Go to the "Verify" tab
2. Paste the signed message
3. Paste the signer's public key
4. Click "Verify Signature"

### Auto-Detection Feature

The extension automatically detects PGP content on web pages and adds action buttons:
- " Decrypt with OpenPGP" for encrypted messages
- " Verify with OpenPGP" for signed messages  
- " Import with OpenPGP" for public keys

## Project Structure

## File Structure

```
OpenPGP/
│
├── manifest.json           # Extension configuration (Manifest V3)
├── index.html             # Main sidebar UI
│
├── js/                    # JavaScript modules
│   ├── pgp-handler.js     # Core PGP operations (1,080 lines)
│   ├── ui.js              # UI controllers (780 lines)
│   ├── background.js      # Background service worker (220 lines)
│   └── content.js         # Content script for page integration (480 lines)
│
├── css/
│   └── styles.css         # Complete styling (570 lines)
│
├── lib/
│   └── openpgp.min.js     # OpenPGP.js cryptography library
│
├── icon/
│   ├── icon_gray.png      # Toolbar icon (19x19)
│   └── icon64.png         # Sidebar icon (64x64)
│
├── README.md              # Complete documentation
├── QUICKSTART.md          # Quick start guide
├── setup.sh               # Automated setup script
└── verify-setup.sh        # Setup verification script
```

## Code Architecture

### Components

1. **pgp-handler.js** - Core PGP functionality
   - Key generation, encryption, decryption
   - Signing and verification
   - Key storage management
   - Uses OpenPGP.js library

2. **ui.js** - User interface controller
   - Tab management
   - Form handling
   - Event listeners
   - Status messages

3. **background.js** - Extension lifecycle
   - Installation/update handling
   - Message passing
   - Context menu creation
   - Storage monitoring

4. **content.js** - Web page integration
   - Auto-detect PGP content
   - Add action buttons
   - Context menu support
   - Monitor dynamic content

### Data Storage

Keys are stored in Firefox's local storage API (`browser.storage.local`):

```javascript
{
  MiniPGP_keys: [
    {
      name: "User Name",
      email: "user@example.com",
      privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----...",
      publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----...",
      fingerprint: "ABCD1234...",
      keyID: "1234ABCD",
      created: "2024-01-01T00:00:00.000Z"
    }
  ],
  debugMode: false
}
```

## Debug Mode

Enable debug mode for detailed logging:

1. Scroll to the bottom of the sidebar
2. Check "Enable Debug Logging"
3. Open Firefox Developer Tools (F12)
4. View console logs prefixed with `[OpenPGP]`

## Security Considerations

 **Important Security Notes:**

1. **Passphrase Storage**: This extension does NOT store your passphrases. You must enter them each time you use your private key.

2. **Private Key Storage**: Private keys are stored encrypted (by the passphrase) in Firefox's local storage. While this is relatively secure, for maximum security consider:
   - Using strong passphrases
   - Not storing highly sensitive keys in the browser
   - Regularly backing up keys to secure offline storage

3. **Memory Security**: Passphrases and decrypted keys exist briefly in browser memory during operations. Close the browser to clear memory.

4. **Web Page Access**: Content scripts can detect PGP content on pages but cannot access your keys without explicit user action.

## Development

### Prerequisites
- Firefox Developer Edition (recommended) or Firefox
- Basic knowledge of JavaScript, HTML, CSS
- Understanding of PGP/PGP concepts

### Making Changes

1. Edit the source files
2. Reload the extension in `about:debugging`
3. Test your changes
4. Check the console for errors and debug logs

### Code Style

- Extensive comments explaining functionality
- Debug logging throughout
- No minification or obfuscation
- Clear variable and function names
- Modular class-based architecture

## Troubleshooting

### Extension won't load
- Ensure `lib/openpgp.min.js` exists
- Check Firefox console for errors
- Verify manifest.json is valid JSON

### Key generation fails
- Check debug logs
- Ensure all fields are filled
- Try a shorter key size (2048 instead of 4096)

### Can't decrypt messages
- Verify you have the correct private key
- Check passphrase is correct
- Ensure message was encrypted for you public key

### Auto-detection not working
- Check debug logs
- Verify PGP blocks have correct formatting
- Try manual refresh of the page

## Contributing

This is an MVP (Minimum Viable Product). Potential improvements:

- [ ] Support for ECC keys
- [ ] Key server integration
- [ ] Multiple key selection for encryption
- [ ] Bulk operations
- [ ] Settings/preferences page
- [ ] Key expiration handling
- [ ] Subkey management
- [ ] Web Crypto API integration for better performance

## License

This extension is provided as-is for educational and personal use.

## Credits

- Built with [OpenPGP.js](https://openpgpjs.org/)
- Compatible with PGP/PGP standard (RFC 4880)

## Version History

### v1.3.4 (Current)
- Initial MVP release
- Key generation, encryption, decryption
- Signing and verification
- Auto-detection of PGP content
- Sidebar interface
- Debug logging

---

**Made with for secure communications**
