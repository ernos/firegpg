# Quick Start Guide - OpenPGP Extension

## Setup (5 minutes)

### 1. Download OpenPGP.js Library

**Option A: Automatic (recommended)**
```bash
./setup.sh
```

**Option B: Manual**
```bash
mkdir -p lib
curl -L -o lib/openpgp.min.js https://unpkg.com/openpgp@5/dist/openpgp.min.js
```

### 2. Add Icons (Optional)

Create or download PNG icons and place them in the `icon/` directory:
- `icon_gray.png` - 19x19 or 38x38 pixels
- `icon64.png` - 64x64 pixels

You can use any simple icon or leave the placeholders.

### 3. Load in Firefox

1. Open Firefox
2. Type `about:debugging` in the address bar
3. Click **"This Firefox"** in the left sidebar
4. Click **"Load Temporary Add-on"**
5. Navigate to this directory and select `manifest.json`
6. Done! The extension is now loaded.

## First Use (2 minutes)

### Open the Sidebar

Click the OpenPGP icon in the toolbar, or go to:
**View → Sidebar → OpenPGP**

### Generate Your First Key

1. In the sidebar, go to the **"Keys"** tab
2. Fill in:
   - **Name**: Your full name
   - **Email**: Your email address
   - **Passphrase**: A strong password (min 8 characters)
3. Click **"Generate Key Pair"**
4. Wait 30-60 seconds
5. Your key is ready to use!

## Quick Operations

### Encrypt a Message

1. Tab: **Encrypt**
2. Paste recipient's public key
3. Type your message
4. Click **"Encrypt Message"**
5. Copy the output

### Decrypt a Message

1. Tab: **Decrypt**
2. Paste encrypted message
3. Select your key
4. Enter your passphrase
5. Click **"Decrypt Message"**

### Sign a Message

1. Tab: **Sign**
2. Type your message
3. Select your key
4. Enter your passphrase
5. Click **"Sign Message"**

### Verify a Signature

1. Tab: **Verify**
2. Paste signed message
3. Paste signer's public key
4. Click **"Verify Signature"**

## Tips

💡 **Enable Debug Mode**: Check the box at the bottom of the sidebar to see detailed logs in the Firefox console (F12)

💡 **Auto-Detection**: The extension automatically detects PGP content on web pages and adds action buttons

💡 **Export Your Public Key**: Go to Keys tab → Click "Export Public" to share with others

💡 **Backup Your Keys**: Export both public and private keys and store them securely offline

## Troubleshooting

**Problem**: Extension won't load  
**Solution**: Make sure `lib/openpgp.min.js` exists

**Problem**: Key generation fails  
**Solution**: Check all fields are filled, try shorter passphrase

**Problem**: Can't decrypt  
**Solution**: Verify you selected the right key and entered correct passphrase

## Need Help?

See the full [README.md](README.md) for detailed documentation.

---

**You're ready to start encrypting! 🔐**
