/**
 * PGP Handler Module
 *
 * This module handles all PGP/PGP cryptographic operations including:
 * - Key generation
 * - Encryption/Decryption
 * - Signing/Verification
 * - Key management (import/export/storage)
 *
 * Uses OpenPGP.js library for all cryptographic operations
 */

// Debug logging flag - can be toggled from UI
let DEBUG_MODE = false;

/**
 * Debug logger that only outputs when DEBUG_MODE is enabled
 * @param {string} message - The message to log
 * @param {*} data - Optional data to log alongside the message
 */
function debugLog(message, data = null) {
  if (DEBUG_MODE) {
    const timestamp = new Date().toISOString();
    console.log(`[OpenPGP Debug ${timestamp}] ${message}`);
    if (data !== null) {
      console.log(data);
    }
  }
}

/**
 * Error logger - always outputs regardless of DEBUG_MODE
 * @param {string} message - The error message
 * @param {Error} error - The error object
 */
function errorLog(message, error = null) {
  const timestamp = new Date().toISOString();
  console.error(`[OpenPGP Error ${timestamp}] ${message}`);
  if (error) {
    console.error(error);
  }
}

/**
 * PGPHandler class
 * Main class for handling all PGP operations
 */
class PGPHandler {
  constructor() {
    debugLog("PGPHandler initialized");
    this.STORAGE_KEY = "MiniPGP_keys";
    this.MASTER_VERIFY_KEY = "MiniPGP_master_verify";
    this._masterPassword = null;
  }

  /**
   * Toggle debug mode on/off
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    DEBUG_MODE = enabled;
    debugLog(`Debug mode ${enabled ? "enabled" : "disabled"}`);
    // Save preference to storage
    browser.storage.local.set({ debugMode: enabled });
  }

  /**
   * Load debug mode preference from storage
   */
  async loadDebugMode() {
    try {
      const result = await browser.storage.local.get("debugMode");
      if (result.debugMode !== undefined) {
        DEBUG_MODE = result.debugMode;
        debugLog("Debug mode loaded from storage", DEBUG_MODE);
      }
    } catch (error) {
      errorLog("Failed to load debug mode preference", error);
    }
  }

  // ===== Master Password Protection =====

  async _deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async _encryptBlob(plaintext) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this._deriveKey(this._masterPassword, salt);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { e: b64(ct), s: b64(salt), i: b64(iv) };
  }

  async _decryptBlob(blob) {
    const from = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await this._deriveKey(this._masterPassword, from(blob.s));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: from(blob.i) },
      key,
      from(blob.e),
    );
    return new TextDecoder().decode(pt);
  }

  async _getPrivateKeyArmor(keyData) {
    if (keyData.privateKeyEncrypted) {
      if (!this._masterPassword) {
        throw new Error(
          "Keys are locked \u2014 enter master password to unlock",
        );
      }
      return await this._decryptBlob(keyData.privateKey);
    }
    return keyData.privateKey;
  }

  async isMasterPasswordRequired() {
    const stored = await browser.storage.local.get(this.MASTER_VERIFY_KEY);
    return !!stored[this.MASTER_VERIFY_KEY];
  }

  isMasterPasswordUnlocked() {
    return this._masterPassword !== null;
  }

  async unlockWithMasterPassword(password) {
    const stored = await browser.storage.local.get(this.MASTER_VERIFY_KEY);
    if (!stored[this.MASTER_VERIFY_KEY]) {
      return true;
    }
    try {
      this._masterPassword = password;
      const result = await this._decryptBlob(stored[this.MASTER_VERIFY_KEY]);
      if (result === "__MiniPGP_verify__") {
        debugLog("Master password unlocked");
        return true;
      }
      this._masterPassword = null;
      return false;
    } catch {
      this._masterPassword = null;
      return false;
    }
  }

  async enableMasterPassword(password) {
    const oldPassword = this._masterPassword;
    try {
      const stored = await browser.storage.local.get(this.STORAGE_KEY);
      const keys = stored[this.STORAGE_KEY] || [];
      const updatedKeys = [];
      for (const key of keys) {
        let armoredKey;
        if (key.privateKeyEncrypted) {
          if (oldPassword === null) {
            throw new Error("Unlock first before changing master password");
          }
          this._masterPassword = oldPassword;
          armoredKey = await this._decryptBlob(key.privateKey);
        } else {
          armoredKey = key.privateKey;
        }
        this._masterPassword = password;
        const encrypted = await this._encryptBlob(armoredKey);
        updatedKeys.push({
          ...key,
          privateKey: encrypted,
          privateKeyEncrypted: true,
        });
      }
      this._masterPassword = password;
      await browser.storage.local.set({ [this.STORAGE_KEY]: updatedKeys });
      const verifyBlob = await this._encryptBlob("__MiniPGP_verify__");
      await browser.storage.local.set({ [this.MASTER_VERIFY_KEY]: verifyBlob });
      debugLog("Master password enabled/updated");
    } catch (error) {
      this._masterPassword = oldPassword;
      throw error;
    }
  }

  async disableMasterPassword() {
    if (!this._masterPassword) {
      throw new Error("Must be unlocked to disable master password");
    }
    const stored = await browser.storage.local.get(this.STORAGE_KEY);
    const keys = stored[this.STORAGE_KEY] || [];
    const updatedKeys = await Promise.all(
      keys.map(async (key) => {
        if (key.privateKeyEncrypted) {
          const armoredKey = await this._decryptBlob(key.privateKey);
          const { privateKeyEncrypted, ...rest } = key;
          return { ...rest, privateKey: armoredKey };
        }
        return key;
      }),
    );
    await browser.storage.local.set({ [this.STORAGE_KEY]: updatedKeys });
    await browser.storage.local.remove(this.MASTER_VERIFY_KEY);
    this._masterPassword = null;
    debugLog("Master password disabled, keys decrypted");
  }

  lockMasterPassword() {
    this._masterPassword = null;
    debugLog("Master password locked (session)");
  }

  // ===== Key Management =====

  /**
   * Generate a new PGP key pair
   *
   * @param {Object} options - Key generation options
   * @param {string} options.name - User's name
   * @param {string} options.email - User's email
   * @param {string} options.passphrase - Passphrase to protect the private key
   * @param {number} options.keySize - ECC key size (default: 8192)
   * @returns {Promise<Object>} Object containing privateKey, publicKey, and fingerprint
   */
  async generateKey({ name, email, passphrase, keySize = 8192 }) {
    debugLog("Starting key generation", { name, email, keySize });

    try {
      // Validate inputs
      if (!name || !email || !passphrase) {
        throw new Error("Name, email, and passphrase are required");
      }

      debugLog("Calling OpenPGP.generateKey()");

      // Generate key pair using OpenPGP.js
      const { privateKey, publicKey, revocationCertificate } =
        await openpgp.generateKey({
          type: "ecc", // ECC algorithm
          rsaBits: keySize, // Key size in bits
          userIDs: [{ name, email }], // User identification
          passphrase, // Passphrase to encrypt private key
          format: "armored", // ASCII-armored format
        });

      debugLog("Key generation successful");

      // Read the generated key to get fingerprint
      const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
      const fingerprint = publicKeyObj.getFingerprint();
      const keyID = publicKeyObj.getKeyID().toHex();

      debugLog("Key fingerprint", fingerprint);
      debugLog("Key ID", keyID);

      // Create key object for storage
      const keyData = {
        name,
        email,
        privateKey,
        publicKey,
        fingerprint,
        keyID,
        created: new Date().toISOString(),
        revocationCertificate,
      };

      // Store the key
      await this.storeKey(keyData);

      debugLog("Key stored successfully");

      return {
        success: true,
        privateKey,
        publicKey,
        fingerprint,
        keyID,
        revocationCertificate,
      };
    } catch (error) {
      errorLog("Key generation failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Store a key pair in browser storage
   *
   * @param {Object} keyData - Key data to store
   */
  async storeKey(keyData) {
    debugLog("Storing key", { fingerprint: keyData.fingerprint });

    try {
      // Encrypt private key at rest if master password is active
      let toStore = { ...keyData };
      if (this._masterPassword && typeof toStore.privateKey === "string") {
        toStore.privateKey = await this._encryptBlob(toStore.privateKey);
        toStore.privateKeyEncrypted = true;
        debugLog("Private key encrypted before storage");
      }

      // Get existing keys from storage
      const stored = await browser.storage.local.get(this.STORAGE_KEY);
      const keys = stored[this.STORAGE_KEY] || [];

      // Check if key already exists (by fingerprint)
      const existingIndex = keys.findIndex(
        (k) => k.fingerprint === toStore.fingerprint,
      );

      if (existingIndex >= 0) {
        debugLog("Updating existing key");
        keys[existingIndex] = toStore;
      } else {
        debugLog("Adding new key");
        keys.push(toStore);
      }

      // Save back to storage
      await browser.storage.local.set({ [this.STORAGE_KEY]: keys });

      debugLog("Key storage successful", { totalKeys: keys.length });
    } catch (error) {
      errorLog("Failed to store key", error);
      throw error;
    }
  }

  /**
   * Retrieve all stored keys
   *
   * @returns {Promise<Array>} Array of stored keys
   */
  async getAllKeys() {
    debugLog("Retrieving all keys");

    try {
      const stored = await browser.storage.local.get(this.STORAGE_KEY);
      const keys = stored[this.STORAGE_KEY] || [];

      debugLog("Keys retrieved", { count: keys.length });

      return keys;
    } catch (error) {
      errorLog("Failed to retrieve keys", error);
      return [];
    }
  }

  /**
   * Get a specific key by fingerprint
   *
   * @param {string} fingerprint - Key fingerprint
   * @returns {Promise<Object|null>} Key data or null if not found
   */
  async getKeyByFingerprint(fingerprint) {
    debugLog("Getting key by fingerprint", fingerprint);

    const keys = await this.getAllKeys();
    const key = keys.find((k) => k.fingerprint === fingerprint);

    if (key) {
      debugLog("Key found");
    } else {
      debugLog("Key not found");
    }

    return key || null;
  }

  /**
   * Delete a key by fingerprint
   *
   * @param {string} fingerprint - Key fingerprint
   */
  async deleteKey(fingerprint) {
    debugLog("Deleting key", fingerprint);

    try {
      const keys = await this.getAllKeys();
      const filteredKeys = keys.filter((k) => k.fingerprint !== fingerprint);

      await browser.storage.local.set({ [this.STORAGE_KEY]: filteredKeys });

      debugLog("Key deleted", { remaining: filteredKeys.length });
    } catch (error) {
      errorLog("Failed to delete key", error);
      throw error;
    }
  }

  /**
   * Import a private key
   *
   * @param {string} armoredKey - ASCII-armored private key
   * @param {string} passphrase - Key passphrase
   * @returns {Promise<Object>} Import result
   */
  async importPrivateKey(armoredKey, passphrase) {
    debugLog("Importing private key");

    try {
      // Read and validate the private key
      const privateKey = await openpgp.readPrivateKey({ armoredKey });

      debugLog("Private key read successfully");

      // Decrypt the key to validate passphrase
      const decryptedKey = await openpgp.decryptKey({
        privateKey,
        passphrase,
      });

      debugLog("Private key decrypted successfully");

      // Get public key from private key
      const publicKey = decryptedKey.toPublic().armor();

      // Get key information
      const fingerprint = privateKey.getFingerprint();
      const keyID = privateKey.getKeyID().toHex();
      const users = privateKey.users.map((u) => u.userID.userID);

      debugLog("Key info", { fingerprint, keyID, users });

      // Extract name and email from first user ID
      const userIDMatch = users[0]?.match(/^(.+?)\s*<(.+?)>$/);
      const name = userIDMatch ? userIDMatch[1] : "Imported Key";
      const email = userIDMatch ? userIDMatch[2] : "";

      // Store the key
      const keyData = {
        name,
        email,
        privateKey: armoredKey,
        publicKey,
        fingerprint,
        keyID,
        created: new Date().toISOString(),
        imported: true,
      };

      await this.storeKey(keyData);

      debugLog("Private key imported and stored");

      return {
        success: true,
        fingerprint,
        keyID,
        name,
        email,
      };
    } catch (error) {
      errorLog("Private key import failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Encrypt a message
   *
   * @param {Object} options - Encryption options
   * @param {string} options.message - Message to encrypt
   * @param {string} options.publicKey - Recipient's public key (ASCII-armored)
   * @param {string} options.signWithKey - (Optional) Fingerprint of key to sign with
   * @param {string} options.passphrase - (Optional) Passphrase for signing key
   * @returns {Promise<Object>} Encryption result
   */
  async encrypt({ message, publicKey, signWithKey = null, passphrase = null }) {
    debugLog("Encrypting message", {
      messageLength: message.length,
      willSign: !!signWithKey,
    });

    try {
      // Read the recipient's public key
      const recipientKey = await openpgp.readKey({ armoredKey: publicKey });

      debugLog("Recipient public key loaded");

      // Prepare encryption options
      const encryptOptions = {
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: recipientKey,
      };

      // If signing is requested, add signing key
      if (signWithKey && passphrase) {
        debugLog("Adding signature to encrypted message");

        const signingKeyData = await this.getKeyByFingerprint(signWithKey);
        if (!signingKeyData) {
          throw new Error("Signing key not found");
        }

        const privateKey = await openpgp.readPrivateKey({
          armoredKey: await this._getPrivateKeyArmor(signingKeyData),
        });

        const decryptedPrivateKey = await openpgp.decryptKey({
          privateKey,
          passphrase,
        });

        encryptOptions.signingKeys = decryptedPrivateKey;
      }

      debugLog("Starting encryption");

      // Encrypt the message
      const encrypted = await openpgp.encrypt(encryptOptions);

      debugLog("Encryption successful", {
        encryptedLength: encrypted.length,
      });

      return {
        success: true,
        encrypted,
      };
    } catch (error) {
      errorLog("Encryption failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Decrypt a message
   *
   * @param {Object} options - Decryption options
   * @param {string} options.encrypted - Encrypted message (ASCII-armored)
   * @param {string} options.privateKeyFingerprint - Fingerprint of private key to use
   * @param {string} options.passphrase - Passphrase for private key
   * @param {string} options.verifyWithKey - (Optional) Public key to verify signature
   * @returns {Promise<Object>} Decryption result
   */
  async decrypt({
    encrypted,
    privateKeyFingerprint,
    passphrase,
    verifyWithKey = null,
  }) {
    debugLog("Decrypting message", {
      encryptedLength: encrypted.length,
      willVerify: !!verifyWithKey,
    });

    try {
      // Get the private key
      const keyData = await this.getKeyByFingerprint(privateKeyFingerprint);
      if (!keyData) {
        throw new Error("Private key not found");
      }

      debugLog("Private key loaded from storage");

      // Read and decrypt the private key
      const privateKey = await openpgp.readPrivateKey({
        armoredKey: await this._getPrivateKeyArmor(keyData),
      });

      const decryptedPrivateKey = await openpgp.decryptKey({
        privateKey,
        passphrase,
      });

      debugLog("Private key decrypted");

      const isCleartextSigned = encrypted.startsWith(
        "-----BEGIN PGP SIGNED MESSAGE-----",
      );

      let decrypted,
        signatures,
        outerSignatureInfo = null;

      if (isCleartextSigned) {
        // Handle cleartext signed message: verify outer signature, then decrypt inner content
        debugLog("Detected cleartext signed message");

        const cleartextMessage = await openpgp.readCleartextMessage({
          cleartextMessage: encrypted,
        });

        // Verify the outer cleartext signature if a public key is provided
        if (verifyWithKey) {
          debugLog("Verifying outer cleartext signature");
          const verificationKey = await openpgp.readKey({
            armoredKey: verifyWithKey,
          });
          const verifyResult = await openpgp.verify({
            message: cleartextMessage,
            verificationKeys: verificationKey,
          });
          const outerSig = verifyResult.signatures[0];
          const outerKeyID = outerSig.keyID.toHex();
          try {
            await outerSig.verified;
            outerSignatureInfo = { valid: true, keyID: outerKeyID };
            debugLog("Outer cleartext signature valid");
          } catch (e) {
            outerSignatureInfo = {
              valid: false,
              keyID: outerKeyID,
              error: e.message,
            };
            debugLog("Outer cleartext signature invalid", e);
          }
        } else {
          // No key provided — report signature as unverified
          const outerSig = cleartextMessage.signature.packets[0];
          const outerKeyID = outerSig
            ? outerSig.issuerKeyID.toHex()
            : "unknown";
          outerSignatureInfo = {
            valid: null,
            keyID: outerKeyID,
            note: "Signature found but not verified (no public key provided)",
          };
          debugLog("Outer cleartext signature detected but not verified");
        }

        // The inner content may itself be an encrypted message (dash-unescaped)
        const innerText = cleartextMessage.text.replace(/^- /gm, "");
        const innerIsEncrypted = innerText
          .trim()
          .startsWith("-----BEGIN PGP MESSAGE-----");

        if (innerIsEncrypted) {
          debugLog("Inner content is an encrypted message, decrypting");
          const innerMessage = await openpgp.readMessage({
            armoredMessage: innerText,
          });
          const innerDecryptOpts = {
            message: innerMessage,
            decryptionKeys: decryptedPrivateKey,
          };
          const innerResult = await openpgp.decrypt(innerDecryptOpts);
          decrypted = innerResult.data;
          signatures = innerResult.signatures;
          debugLog("Inner encrypted message decrypted", {
            decryptedLength: decrypted.length,
          });
        } else {
          // Plain signed (not encrypted) content
          decrypted = cleartextMessage.text;
          signatures = [];
        }
      } else {
        // Regular encrypted message (may have embedded signature)
        const message = await openpgp.readMessage({
          armoredMessage: encrypted,
        });
        debugLog("Encrypted message parsed");

        const decryptOptions = {
          message,
          decryptionKeys: decryptedPrivateKey,
        };

        if (verifyWithKey) {
          debugLog("Adding verification key");
          const verificationKey = await openpgp.readKey({
            armoredKey: verifyWithKey,
          });
          decryptOptions.verificationKeys = verificationKey;
        }

        debugLog("Starting decryption");
        const result = await openpgp.decrypt(decryptOptions);
        decrypted = result.data;
        signatures = result.signatures;
        debugLog("Decryption successful", {
          decryptedLength: decrypted.length,
          hasSignatures: signatures && signatures.length > 0,
        });
      }

      // Verify any embedded signatures (from encrypted+signed messages)
      let signatureInfo = outerSignatureInfo;
      if (!signatureInfo && signatures && signatures.length > 0) {
        debugLog("Embedded signatures detected, attempting verification");
        try {
          const sig = signatures[0];
          const keyID = sig.keyID.toHex();
          if (verifyWithKey) {
            await sig.verified;
            debugLog("Embedded signature verified successfully");
            signatureInfo = { valid: true, keyID };
          } else {
            signatureInfo = {
              valid: null,
              keyID,
              note: "Signature found but not verified (no public key provided)",
            };
          }
        } catch (error) {
          debugLog("Embedded signature verification failed", error);
          signatureInfo = { valid: false, error: error.message };
        }
      }

      return {
        success: true,
        decrypted,
        signatureInfo,
      };
    } catch (error) {
      errorLog("Decryption failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sign a message
   *
   * @param {Object} options - Signing options
   * @param {string} options.message - Message to sign
   * @param {string} options.privateKeyFingerprint - Fingerprint of private key to use
   * @param {string} options.passphrase - Passphrase for private key
   * @param {boolean} options.detached - Whether to create detached signature
   * @returns {Promise<Object>} Signing result
   */
  async sign({ message, privateKeyFingerprint, passphrase, detached = false }) {
    debugLog("Signing message", {
      messageLength: message.length,
      detached,
    });

    try {
      // Get the private key
      const keyData = await this.getKeyByFingerprint(privateKeyFingerprint);
      if (!keyData) {
        throw new Error("Private key not found");
      }

      debugLog("Private key loaded from storage");

      // Read and decrypt the private key
      const privateKey = await openpgp.readPrivateKey({
        armoredKey: await this._getPrivateKeyArmor(keyData),
      });

      const decryptedPrivateKey = await openpgp.decryptKey({
        privateKey,
        passphrase,
      });

      debugLog("Private key decrypted");

      // Create message object
      const messageObj = await openpgp.createMessage({ text: message });

      debugLog("Starting signing");

      let signed;
      if (detached) {
        // Create detached signature
        signed = await openpgp.sign({
          message: messageObj,
          signingKeys: decryptedPrivateKey,
          detached: true,
        });
      } else {
        // Create cleartext signature (readable message)
        signed = await openpgp.sign({
          message: await openpgp.createCleartextMessage({ text: message }),
          signingKeys: decryptedPrivateKey,
        });
      }

      debugLog("Signing successful", {
        signedLength: signed.length,
      });

      return {
        success: true,
        signed,
      };
    } catch (error) {
      errorLog("Signing failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify a signed message
   *
   * @param {Object} options - Verification options
   * @param {string} options.signedMessage - Signed message (ASCII-armored)
   * @param {string} options.publicKey - Public key to verify with (ASCII-armored)
   * @param {string} options.signature - (Optional) Detached signature if verifying detached
   * @returns {Promise<Object>} Verification result
   */
  async verify({ signedMessage, publicKey, signature = null }) {
    debugLog("Verifying signature", {
      messageLength: signedMessage.length,
      hasDetached: !!signature,
    });

    try {
      // Read the public key
      const verificationKey = await openpgp.readKey({
        armoredKey: publicKey,
      });

      debugLog("Public key loaded");

      let verificationResult;
      let messageText;

      if (signature) {
        // Verify detached signature
        debugLog("Verifying detached signature");

        const message = await openpgp.createMessage({ text: signedMessage });
        const sig = await openpgp.readSignature({
          armoredSignature: signature,
        });

        verificationResult = await openpgp.verify({
          message,
          signature: sig,
          verificationKeys: verificationKey,
        });

        messageText = signedMessage;
      } else {
        // Verify cleartext signature
        debugLog("Verifying cleartext signature");

        const message = await openpgp.readCleartextMessage({
          cleartextMessage: signedMessage,
        });

        verificationResult = await openpgp.verify({
          message,
          verificationKeys: verificationKey,
        });

        messageText = verificationResult.data;
      }

      debugLog("Verification process complete");

      // Check if signature is valid
      const { verified, keyID } = verificationResult.signatures[0];

      try {
        await verified;
        const keyIDHex = keyID.toHex();

        debugLog("Signature is valid", { keyID: keyIDHex });

        return {
          success: true,
          valid: true,
          message: messageText,
          keyID: keyIDHex,
        };
      } catch (error) {
        debugLog("Signature is invalid", error);

        return {
          success: true,
          valid: false,
          message: messageText,
          error: error.message,
        };
      }
    } catch (error) {
      errorLog("Verification failed", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Export a public key by fingerprint
   *
   * @param {string} fingerprint - Key fingerprint
   * @returns {Promise<string|null>} Public key or null
   */
  async exportPublicKey(fingerprint) {
    debugLog("Exporting public key", fingerprint);

    const keyData = await this.getKeyByFingerprint(fingerprint);
    if (keyData) {
      debugLog("Public key exported");
      return keyData.publicKey;
    }

    debugLog("Key not found for export");
    return null;
  }

  /**
   * Export a private key by fingerprint
   *
   * @param {string} fingerprint - Key fingerprint
   * @returns {Promise<string|null>} Private key or null
   */
  async exportPrivateKey(fingerprint) {
    debugLog("Exporting private key", fingerprint);

    const keyData = await this.getKeyByFingerprint(fingerprint);
    if (keyData) {
      debugLog("Private key exported");
      return await this._getPrivateKeyArmor(keyData);
    }

    debugLog("Key not found for export");
    return null;
  }
}

// Create global instance
debugLog("Creating global PGPHandler instance");
const pgpHandler = new PGPHandler();

// Load debug mode preference on startup
pgpHandler.loadDebugMode();

debugLog("PGP Handler module loaded");
