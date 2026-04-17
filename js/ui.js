/**
 * UI Controller for OpenPGP Extension
 *
 * Handles all user interface interactions and connects
 * the HTML elements to the PGP handler functionality
 */

console.log("[OpenPGP UI] Initializing UI controller");

/**
 * Display a password prompt modal dialog
 *
 * @param {string} title - The title of the modal
 * @param {string} message - The message/prompt text
 * @returns {Promise<string|null>} The password entered, or null if cancelled
 */
function passwordPrompt(title, message = "") {
  return new Promise((resolve) => {
    const modal = document.getElementById("passwordModal");
    const input = document.getElementById("passwordModalInput");
    const titleEl = document.getElementById("passwordModalTitle");
    const messageEl = document.getElementById("passwordModalMessage");
    const statusEl = document.getElementById("passwordModalStatus");
    const okBtn = document.getElementById("passwordModalOk");
    const cancelBtn = document.getElementById("passwordModalCancel");

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;
    input.value = "";
    statusEl.textContent = "";
    statusEl.style.display = "none";

    // Show modal
    modal.classList.remove("hidden");
    input.focus();

    const cleanup = () => {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
      input.removeEventListener("keypress", handleKeypress);
    };

    const handleOk = () => {
      const value = input.value;
      cleanup();
      resolve(value);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const handleKeypress = (e) => {
      if (e.key === "Enter") {
        handleOk();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
    input.addEventListener("keypress", handleKeypress);
  });
}

/**
 * Display a status message to the user
 *
 * @param {HTMLElement} element - The element to display status in
 * @param {string} message - The message to display
 * @param {string} type - Message type: 'success', 'error', 'info', 'warning'
 */
function showStatus(element, message, type = "info") {
  console.log(`[OpenPGP UI] Status (${type}):`, message);

  element.textContent = message;
  element.className = `status status-${type}`;
  element.style.display = "block";
}

/**
 * Clear a status message
 *
 * @param {HTMLElement} element - The status element to clear
 */
function clearStatus(element) {
  element.textContent = "";
  element.style.display = "none";
}

/**
 * Show/hide an element
 *
 * @param {HTMLElement} element - The element to show/hide
 * @param {boolean} visible - Whether to show or hide
 */
function setVisible(element, visible) {
  if (visible) {
    element.classList.remove("hidden");
  } else {
    element.classList.add("hidden");
  }
}

/**
 * Tab Management
 */
class TabManager {
  constructor() {
    console.log("[OpenPGP UI] Initializing tab manager");

    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabContents = document.querySelectorAll(".tab-content");

    // Set up tab click handlers
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", () =>
        this.switchTab(button.dataset.tab),
      );
    });
  }

  /**
   * Switch to a specific tab
   *
   * @param {string} tabName - Name of tab to switch to
   */
  switchTab(tabName) {
    console.log("[OpenPGP UI] Switching to tab:", tabName);

    // Deactivate all tabs
    this.tabButtons.forEach((btn) => btn.classList.remove("active"));
    this.tabContents.forEach((content) => content.classList.remove("active"));

    // Activate selected tab
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);

    if (activeButton && activeContent) {
      activeButton.classList.add("active");
      activeContent.classList.add("active");

      // Refresh key dropdowns when switching to tabs that need them
      if (["encrypt", "decrypt", "sign"].includes(tabName)) {
        this.refreshKeyDropdowns();
      }
    }
  }

  /**
   * Refresh all key selection dropdowns
   */
  async refreshKeyDropdowns() {
    console.log("[OpenPGP UI] Refreshing key dropdowns");

    const keys = await pgpHandler.getAllKeys();

    // Update all key selection dropdowns
    const dropdowns = [
      document.getElementById("encryptSignerKey"),
      document.getElementById("decryptKey"),
      document.getElementById("signKey"),
    ];

    dropdowns.forEach((dropdown) => {
      if (!dropdown) return;

      dropdown.innerHTML = "";

      if (keys.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No keys available";
        dropdown.appendChild(option);
      } else {
        keys.forEach((key) => {
          const option = document.createElement("option");
          option.value = key.fingerprint;
          option.textContent = `${key.name} <${key.email}> (${key.fingerprint.substring(0, 16)}...)`;
          dropdown.appendChild(option);
        });
      }
    });
  }
}

/**
 * Key Management Controller
 */
class KeyManagement {
  constructor() {
    console.log("[OpenPGP UI] Initializing key management");

    // Get DOM elements
    this.generateBtn = document.getElementById("generateKeyBtn");
    this.refreshBtn = document.getElementById("refreshKeysBtn");
    this.importBtn = document.getElementById("importKeyBtn");
    this.keysList = document.getElementById("keysList");

    // Set up event listeners
    this.generateBtn.addEventListener("click", () => this.generateKey());
    this.refreshBtn.addEventListener("click", () => this.refreshKeys());
    this.importBtn.addEventListener("click", () => this.importKey());

    // Trigger generate when Enter is pressed in passphrase field
    document
      .getElementById("keyPassphrase")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.generateBtn.click();
        }
      });

    // Trigger import when Enter is pressed in passphrase field
    document
      .getElementById("importPassphrase")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.importBtn.click();
        }
      });

    // Set up copy buttons
    this.setupCopyButtons();

    // Check and show first-time setup banner
    this.checkFirstTimeSetup();

    // Initialize master password UI
    this.initMasterPassword();

    // Load keys on startup
    this.refreshKeys();
  }

  async checkFirstTimeSetup() {
    const result = await browser.storage.local.get(
      "hasSeenMasterPasswordSetup",
    );
    const hasSeenSetup = result.hasSeenMasterPasswordSetup || false;
    const hasMasterPassword = await pgpHandler.isMasterPasswordRequired();

    // Only show first-time banner if user hasn't seen it AND hasn't set a master password
    if (!hasSeenSetup && !hasMasterPassword) {
      const banner = document.getElementById("firstTimeSetupBanner");
      setVisible(banner, true);

      // Set up event handlers
      document
        .getElementById("firstTimeSetupYesBtn")
        .addEventListener("click", () => {
          this.handleFirstTimePasswordSetup();
        });

      document
        .getElementById("firstTimeSetupNoBtn")
        .addEventListener("click", () => {
          this.dismissFirstTimeSetup();
        });
    }
  }

  async handleFirstTimePasswordSetup() {
    // Get password from user
    const password = await passwordPrompt(
      "Set Master Password",
      "Enter your master password (minimum 8 characters)",
    );

    if (!password) {
      return; // User cancelled
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    // Confirm password
    const confirmPassword = await passwordPrompt(
      "Confirm Master Password",
      "Re-enter your master password to confirm",
    );

    if (!confirmPassword) {
      return; // User cancelled
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match. Please try again.");
      return;
    }

    // Set the master password
    try {
      await pgpHandler.enableMasterPassword(password);
      alert(
        "Master password has been set successfully! Your private keys will now be encrypted.",
      );

      // Mark as seen and hide banner
      await browser.storage.local.set({ hasSeenMasterPasswordSetup: true });
      const banner = document.getElementById("firstTimeSetupBanner");
      setVisible(banner, false);

      // Refresh the master password section
      this.renderMasterPasswordSection(true, true);
    } catch (err) {
      alert(`Error setting master password: ${err.message}`);
    }
  }

  async dismissFirstTimeSetup() {
    if (
      confirm(
        "Are you sure? Your private keys will be stored unencrypted. You can still set a master password later in the Keys tab.",
      )
    ) {
      await browser.storage.local.set({ hasSeenMasterPasswordSetup: true });
      const banner = document.getElementById("firstTimeSetupBanner");
      setVisible(banner, false);
    }
  }

  async initMasterPassword() {
    const required = await pgpHandler.isMasterPasswordRequired();
    const unlocked = pgpHandler.isMasterPasswordUnlocked();
    const banner = document.getElementById("masterPasswordBanner");

    if (required && !unlocked) {
      setVisible(banner, true);
    }

    this.renderMasterPasswordSection(required, unlocked);

    document
      .getElementById("masterUnlockBtn")
      .addEventListener("click", () => this.unlockMasterPassword());
    document
      .getElementById("masterUnlockInput")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.unlockMasterPassword();
      });
  }

  renderMasterPasswordSection(isSet, isUnlocked) {
    const section = document.getElementById("masterPasswordSection");
    if (isSet) {
      /*
      TODO:
  UNSAFE_VAR_ASSIGNMENT   Unsafe assignment to innerHTML    Due to both security and performance concerns, this may not be   js/ui.js        203    7     
      set using dynamic values which have not been adequately                                       
      sanitized. This can lead to security issues or fairly serious                                 
      performance degradation.
      */
      section.innerHTML = `
        <p style="color:var(--success-color);font-size:12px;margin-bottom:8px">✓ Private keys are encrypted in storage.</p>
        ${
          isUnlocked
            ? `
          <div class="form-group">
            <input type="password" id="newMasterPwdInput" placeholder="New master password" style="margin-bottom:6px">
            <button id="changeMasterPwdBtn" class="btn btn-secondary btn-small">Change Password</button>
            <button id="disableMasterPwdBtn" class="btn btn-danger btn-small" style="margin-left:6px">Disable Master Password</button>
            <button id="disableMasterPwdAndDeleteKeysBtn" class="btn btn-danger btn-small" style="margin-left:6px;margin-top:6px">Delete All Private Keys AND Disable Master Password</button>
            <div id="masterPwdSetStatus" class="status"></div>
          </div>
        `
            : `
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Unlock above to change or disable.</p>
          <button id="disableMasterPwdAndDeleteKeysBtn" class="btn btn-danger btn-small">Forgot Password? Delete All Keys</button>
          <div id="masterPwdSetStatus" class="status"></div>
        `
        }
      `;
      if (isUnlocked) {
        document
          .getElementById("changeMasterPwdBtn")
          .addEventListener("click", () => this.changeMasterPassword());
        document
          .getElementById("disableMasterPwdBtn")
          .addEventListener("click", () => this.disableMasterPassword());
        document
          .getElementById("disableMasterPwdAndDeleteKeysBtn")
          .addEventListener("click", () =>
            this.disableMasterPwdAndDeleteKeysBtn(),
          );
      } else {
        // Even when locked, allow deleting keys if password is forgotten
        document
          .getElementById("disableMasterPwdAndDeleteKeysBtn")
          .addEventListener("click", () =>
            this.disableMasterPwdAndDeleteKeysBtn(),
          );
      }
    } else {
      section.innerHTML = `
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Optionally encrypt stored private keys with a master password.</p>
        <input type="password" id="newMasterPwdInput" placeholder="Master password" style="display:block;width:100%;margin-bottom:6px">
        <button id="enableMasterPwdBtn" class="btn btn-secondary btn-small">Enable Protection</button>
        <div id="masterPwdSetStatus" class="status"></div>
      `;
      document
        .getElementById("enableMasterPwdBtn")
        .addEventListener("click", () => this.enableMasterPassword());
    }
  }

  async unlockMasterPassword() {
    const input = document.getElementById("masterUnlockInput");
    const statusEl = document.getElementById("masterUnlockStatus");
    const password = input.value;
    if (!password) {
      showStatus(statusEl, "Enter master password", "error");
      return;
    }
    input.disabled = true;
    const success = await pgpHandler.unlockWithMasterPassword(password);
    input.disabled = false;
    if (success) {
      input.value = "";
      setVisible(document.getElementById("masterPasswordBanner"), false);
      this.renderMasterPasswordSection(true, true);
      await this.refreshKeys();
    } else {
      input.value = "";
      showStatus(statusEl, "Incorrect master password", "error");
    }
  }

  async enableMasterPassword() {
    const input = document.getElementById("newMasterPwdInput");
    const statusEl = document.getElementById("masterPwdSetStatus");
    const password = input.value;
    if (!password || password.length < 8) {
      showStatus(statusEl, "Password must be at least 8 characters", "error");
      return;
    }
    showStatus(statusEl, "Encrypting keys...", "info");
    try {
      await pgpHandler.enableMasterPassword(password);
      input.value = "";
      showStatus(statusEl, "Master password enabled!", "success");
      this.renderMasterPasswordSection(true, true);
    } catch (err) {
      showStatus(statusEl, `Error: ${err.message}`, "error");
    }
  }

  async changeMasterPassword() {
    const input = document.getElementById("newMasterPwdInput");
    const statusEl = document.getElementById("masterPwdSetStatus");
    const password = input.value;
    if (!password || password.length < 8) {
      showStatus(
        statusEl,
        "New password must be at least 8 characters",
        "error",
      );
      return;
    }
    showStatus(statusEl, "Re-encrypting keys...", "info");
    try {
      await pgpHandler.enableMasterPassword(password);
      input.value = "";
      showStatus(statusEl, "Master password changed!", "success");
    } catch (err) {
      showStatus(statusEl, `Error: ${err.message}`, "error");
    }
  }

  async disableMasterPassword() {
    const statusEl = document.getElementById("masterPwdSetStatus");

    if (
      !confirm(
        "This will remove master password protection and store private keys unencrypted. Continue?",
      )
    ) {
      return;
    }

    showStatus(statusEl, "Removing master password protection...", "info");

    try {
      await pgpHandler.disableMasterPassword();
      showStatus(statusEl, "Master password protection disabled", "success");
      setTimeout(() => {
        this.renderMasterPasswordSection(false, false);
      }, 1500);
    } catch (err) {
      showStatus(statusEl, `Error: ${err.message}`, "error");
    }
  }

  async disableMasterPwdAndDeleteKeysBtn() {
    const statusEl = document.getElementById("masterPwdSetStatus");

    if (
      !confirm(
        "This will delete all of your private keys AND remove master password protection. Use this only if you forgot your master password! Private keys will be lost forever! Continue?",
      )
    ) {
      return;
    }

    showStatus(statusEl, "Deleting keys and removing protection...", "info");

    try {
      // Delete the storage variables
      await browser.storage.local.remove([
        "MiniPGP_keys",
        "MiniPGP_master_verify",
      ]);

      showStatus(
        statusEl,
        "All keys deleted and master password removed",
        "success",
      );

      // Refresh the UI
      setTimeout(() => {
        this.renderMasterPasswordSection(false, false);
        this.refreshKeys();
      }, 1500);
    } catch (err) {
      showStatus(statusEl, `Error: ${err.message}`, "error");
    }
  }
  /**
   * Set up click handlers for all copy buttons
   */
  setupCopyButtons() {
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const textarea = document.getElementById(targetId);
        const text = textarea.value.trim();

        if (!text) {
          return;
        }

        try {
          await navigator.clipboard.writeText(text);
          console.log(`[OpenPGP UI] ${targetId} copied to clipboard`);

          // Visual feedback
          btn.classList.add("copied");
          btn.textContent = "✓";

          // Show status message if there's a status div
          const statusDiv = document.getElementById(
            targetId.replace("Key", "Status"),
          );
          if (statusDiv) {
            const originalText = statusDiv.textContent;
            const originalClass = statusDiv.className;
            showStatus(statusDiv, "Copied to clipboard!", "success");
            setTimeout(() => {
              if (originalText) {
                statusDiv.textContent = originalText;
                statusDiv.className = originalClass;
              } else {
                clearStatus(statusDiv);
              }
            }, 2000);
          }

          // Reset button after delay
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.textContent = "📋";
          }, 2000);
        } catch (err) {
          console.error("[OpenPGP UI] Copy failed:", err);
          textarea.select();
        }
      });
    });
  }

  /**
   * Generate a new key pair
   */
  async generateKey() {
    console.log("[OpenPGP UI] Generate key button clicked");

    const statusEl = document.getElementById("keyGenerationStatus");
    const name = document.getElementById("keyName").value.trim();
    const email = document.getElementById("keyEmail").value.trim();
    const passphrase = document.getElementById("keyPassphrase").value;

    // Validate inputs
    if (!name || !email || !passphrase) {
      showStatus(statusEl, "Please fill in all fields", "error");
      return;
    }

    if (passphrase.length < 8) {
      showStatus(statusEl, "Passphrase must be at least 8 characters", "error");
      return;
    }

    // Show progress
    showStatus(
      statusEl,
      "Generating key pair... This may take a minute.",
      "info",
    );
    this.generateBtn.disabled = true;

    try {
      console.log("[OpenPGP UI] Calling PGP handler to generate key");

      // Generate the key
      const result = await pgpHandler.generateKey({
        name,
        email,
        passphrase,
        keySize: 16392,
      });

      if (result.success) {
        console.log("[OpenPGP UI] Key generated successfully");
        showStatus(
          statusEl,
          `Key pair generated successfully! Fingerprint: ${result.fingerprint}`,
          "success",
        );

        // Clear form
        document.getElementById("keyName").value = "";
        document.getElementById("keyEmail").value = "";
        document.getElementById("keyPassphrase").value = "";

        // Refresh keys list
        await this.refreshKeys();
      } else {
        console.error("[OpenPGP UI] Key generation failed:", result.error);
        showStatus(statusEl, `Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error(
        "[OpenPGP UI] Unexpected error during key generation:",
        error,
      );
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.generateBtn.disabled = false;
    }
  }

  /**
   * Refresh the keys list display
   */
  async refreshKeys() {
    console.log("[OpenPGP UI] Refreshing keys list");

    try {
      const keys = await pgpHandler.getAllKeys();

      console.log("[OpenPGP UI] Found", keys.length, "keys");

      /*
      MiniPGP_keys:"[{"name":"asd","email":"asd@asd.asd","privateKey":{"e":"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","s":"09K8ik/cENOJ08BVNW8AMA==","i":"arwlAR27B3Lq51IO"},"publicKey":"-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nxsBNBGnarwEBCAC+rkknpH+MkwBEddIIPlGqji62MCMdhDNy8mZN6l3wEv7c\nLDE5YA/jTHpuhHvtPyiYiJBXHRu3sO6JNOomFo17MkhAC7n/Byet8N1AxVxi\niQJY5FfaN6kcUZR8o3tEhlxdxkNQ2PgJtAZlcG6wcox6MahsfqxZTxOyiFHO\n/nHTqWEtouGJIJJwICmCaA6PpZV7Czhe4Bogh/ozGA/CjTPadUCZs+a0B1j7\njUav90FDn3ZIEsNz6KOeNQGceW4cLLl+T0WvRbJQ+F6nJu+rbxlzN6WF6T46\nYrjjSDZvhaQX7mj9YgssTsfN19NRajt0+w4fnqkhCCeE+1SEgVs+a1OPABEB\nAAHNEWFzZCA8YXNkQGFzZC5hc2Q+wsCKBBABCAA+BYJp2q8BBAsJBwgJkFKz\n4gOYaf4tAxUICgQWAAIBAhkBApsDAh4BFiEERNbJzbuknnqmDnYrUrPiA5hp\n/i0AAPBnCAChYTQM5yvTGZuqXzvJ0zrjOII6NZu5DiBX/9yMKqyiO4+HlogU\nL21sIv4ECzVadVxVpwx/b7A3nKqj51NUZitbNQX2urQd0p+rFRwzneV4bpYO\nxpdqg/kUrNJmu9eViY595rtOC3ZHHa06m4b4jSfRYVkyYrJEnsJHbtA/foVr\nF3zhQ+Y2WCaNDzOVEHmsFi4MP+Uv+BRSq22fSf6J4galJH8waUNU6/j/XN/x\n/jb9mh0/yiNOoZ5+89CTsfkFOadxSb6jsSZTPDdYoVCd/0VRnAegrf0/ZOiF\n/p7/QNpyZtbU23jnr6A8gaEcmTOI1rvHrwHDKJO7aoU4+iFFMjGpzsBNBGna\nrwEBCADea9uVsp0BMnBIbmtIDPp2Kd/41yQsMdCD+VGrQsEbm7fWfTAZ4KKt\n2syuU6f9qVDTyDSKylcFy8nMznVBfGqsnAkgLW1Ol/M7k2KcuIRDPwSImtC0\nBIwW9Jqe94HNqTaBS1CSuRFYIrVTTUmkgZCXVKTx6bx1yz9azOYEm/oyV/eS\n4wBjFVh0BEH7c89ihhXbIZ4LiOedkxvOrdmPz0OzSxWupwrXKi0Iuujsur/2\n4V+P3NfMFFMjY/I5hz0c+6TOXf1phvoLykVf6V3ZiwDz9IjwxUqywuB9fnKV\nbZuW0ofo9dbFphgZXK7IUez/kUXRPMwEB526sRmvD91QbxslABEBAAHCwHYE\nGAEIACoFgmnarwEJkFKz4gOYaf4tApsMFiEERNbJzbuknnqmDnYrUrPiA5hp\n/i0AAKvkCACmomzmVF/nxe6WQNMbbwQQECVMT1iwmNYYpqzrxyHZS+U8IOrA\nIghk8xLRuS2k3aFEvFHaHIRv8H1UX1/bSKQqTvH812gr4OkP73yF0c4D8t6K\nyFXUsoy2KhKLdDwwNYDJN147+6eyFnWrtS8hwFBxKIVRaQy4VBVeglqlCSFu\nuczquE1PP/GORTlxgHxb1Gh3mLurIgAjXFJUpDAFAMMfy3r71FYErwCy9zsT\nYXhIv0lt0dAx6mrD4H8i2kKdnn/YNH5vOJU5lYPKTJROlEZqRcmLWt7AVTn/\nMNSnuw2YX0UXo4mE663vCKqCcJmPJSpWtTP9DaibiagAtc/mcicw\n=+90K\n-----END PGP PUBLIC KEY BLOCK-----\n","fingerprint":"44d6c9cdbba49e7aa60e762b52b3e2039869fe2d","keyID":"52b3e2039869fe2d","created":"2026-04-11T20:28:49.908Z","revocationCertificate":"-----BEGIN PGP PUBLIC KEY BLOCK-----\nComment: This is a revocation certificate\n\nwsB2BCABCAAqBYJp2q8BCZBSs+IDmGn+LQKdABYhBETWyc27pJ56pg52K1Kz\n4gOYaf4tAAAkiQf/Ur+/1aSviGx77N4/Ed0ga+QSNXC9oB5fLmgWegUStrhK\nTpzeCaylGkoyo9XmJs2dcnKj43X3Gu48LmDWDzVHJPsVrtqHuiQXku4pLSnx\ns05YqGuG7D4bkBLRAhDsOebmKS/Ov6YMag589ezGN/f0QYm1SkvQeTTnl7SA\ndmPFTePOlxfWA2u1JM2hFa1Id5+hqnKzWdYp8N5F5Ar5cZ16fVCllIEzvb4d\nxsJuhcYqdA7xGcCg1X+ltevzFAtRu9+9wFxfDSwPM9T9jkeFAZdElO2gQ1vb\nZWohdDzB+deXEsaZjqMTuRGrFAGQT/Xiia4e2y31bCOM9DAtYiow9DzJig==\n=ExAT\n-----END PGP PUBLIC KEY BLOCK-----\n","privateKeyEncrypted":true}]"
      MiniPGP_master_verify:"{"e":"87HRqvFH1z12JM+sFwXm6Q1wpIow3Y6yuBzIH6xXfKNleg==","s":"90GAkN11SWECYHc1X9ZH6Q==","i":"M31mZSFQwyvmGBB6"}"
      */

      // Check if master password protection is enabled
      const masterPasswordRequired =
        await pgpHandler.isMasterPasswordRequired();
      const masterPasswordUnlocked = pgpHandler.isMasterPasswordUnlocked();

      console.log(
        "[OpenPGP UI] Master password required:",
        masterPasswordRequired,
      );
      console.log(
        "[OpenPGP UI] Master password unlocked:",
        masterPasswordUnlocked,
      );

      // If master password is required but not unlocked, show unlock prompt
      if (masterPasswordRequired && !masterPasswordUnlocked) {
        console.log(
          "[OpenPGP UI] Keys are encrypted - master password required",
        );
        setVisible(document.getElementById("masterPasswordBanner"), true);
        this.keysList.innerHTML =
          '<div class="alert" style="background: var(--warning-bg); color: var(--warning-color); padding: 12px; border-radius: 4px;">' +
          "<strong>🔒 Keys are encrypted</strong><br>" +
          "Please unlock with your master password above to view and manage your keys." +
          "</div>";
        return;
      }

      // Keys are either not encrypted, or master password is unlocked
      if (!masterPasswordRequired) {
        console.log(
          "[OpenPGP UI] Keys are NOT encrypted - displaying directly",
        );
      } else {
        console.log(
          "[OpenPGP UI] Master password unlocked - displaying decrypted keys",
        );
      }

      if (keys.length === 0) {
        this.keysList.innerHTML =
          '<p class="text-muted">No keys found. Generate a key pair to get started.</p>';
      } else {
        // Build keys display
        let html = "";

        keys.forEach((key) => {
          html += `
      <div class="key-item" data-fingerprint="${key.fingerprint}">
          <div class="key-info">
              <strong>${this.escapeHtml(key.name)}</strong> &lt;${this.escapeHtml(key.email)}&gt;
              <br>
              <small>Fingerprint: <code>${key.fingerprint}</code></small>
              <br>
              <small>Created: ${new Date(key.created).toLocaleString()}</small>
          </div>
          <div class="key-actions">
              <button class="btn btn-small btn-secondary export-public" data-fingerprint="${key.fingerprint}">
                  Export Public
              </button>
              <button class="btn btn-small btn-secondary export-private" data-fingerprint="${key.fingerprint}">
                  Export Private
              </button>
              <button class="btn btn-small btn-danger delete-key" data-fingerprint="${key.fingerprint}">
                  Delete
              </button>
          </div>
      </div>
    `;
        });
        /*
          TODO - UNSAFE_VAR_ASSIGNMENT (x3)   Unsafe assignment to innerHTML                    js/ui.js        933,935,938    13
              Due to both security and performance concerns, this may not be set using dynamic values which have not been adequately                                       
              sanitized. This can lead to security issues or fairly serious performance degradation.                      
          */
        this.keysList.innerHTML = html;

        // Registering click listeners for the indivudual keys "Export Public"/"Export Private"/"Delete"
        this.keysList.querySelectorAll(".export-public").forEach((btn) => {
          btn.addEventListener("click", (e) =>
            this.exportPublicKey(e.target.dataset.fingerprint),
          );
        });
        this.keysList.querySelectorAll(".export-private").forEach((btn) => {
          btn.addEventListener("click", (e) =>
            this.exportPrivateKey(e.target.dataset.fingerprint),
          );
        });
        this.keysList.querySelectorAll(".delete-key").forEach((btn) => {
          btn.addEventListener("click", (e) =>
            this.deleteKey(e.target.dataset.fingerprint),
          );
        });
      }
    } catch (error) {
      console.error("[OpenPGP UI] Error refreshing keys:", error);
      this.keysList.innerHTML =
        '<p class="text-muted text-error">Error loading keys</p>';
    }
  }

  async encryptedText(fingerprint) {
    const textarea = document.getElementById("encryptedText");
    console.log(
      "[OpenPGP UI] Copied encryptedText to clipboard! Contents: '" +
        textarea.innerHTML +
        "'",
    );
    return this.copyToClipboard(textarea.innerHTML);
  }
  /**
   * Export a public key
   *
   * @param {string} fingerprint - Key fingerprint
   */
  async exportPublicKey(fingerprint) {
    const publicKey = await pgpHandler.exportPublicKey(fingerprint);
    if (publicKey) {
      console.log("[OpenPGP UI] Exporting public key to textarea", fingerprint);

      // Display key in textarea
      const textarea = document.getElementById("exportedPublicKey");
      const outputDiv = document.getElementById("exportedPublicOutput");
      const statusDiv = document.getElementById("exportPublicStatus");

      textarea.value = publicKey;
      setVisible(outputDiv, true);

      // Scroll to the output
      outputDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /**
   * Export a public key
   *
   * @param {string} fingerprint - Key fingerprint
   */
  async exportPrivateKey(fingerprint) {
    console.log("[OpenPGP UI] Exporting private key:", fingerprint);

    if (
      !confirm(
        "Warning: Exporting your private key can be dangerous. Only do this if you know what you're doing. Continue?",
      )
    ) {
      return;
    }

    const privateKey = await pgpHandler.exportPrivateKey(fingerprint);
    if (privateKey) {
      // Display key in textarea
      const textarea = document.getElementById("exportedPrivateKey");
      const outputDiv = document.getElementById("exportedPrivateOutput");
      const statusDiv = document.getElementById("exportPrivateStatus");

      textarea.value = privateKey;
      setVisible(outputDiv, true);

      // Scroll to the output
      outputDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /**
   * Delete a key
   *
   * @param {string} fingerprint - Key fingerprint
   */
  async deleteKey(fingerprint) {
    console.log("[OpenPGP UI] Delete key requested:", fingerprint);

    if (
      !confirm(
        "Are you sure you want to delete this key? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await pgpHandler.deleteKey(fingerprint);
      console.log("[OpenPGP UI] Key deleted successfully");
      await this.refreshKeys();
    } catch (error) {
      console.error("[OpenPGP UI] Error deleting key:", error);
      alert("Error deleting key: " + error.message);
    }
  }

  /**
   * Import a private key
   */
  async importKey() {
    console.log("[OpenPGP UI] Import key button clicked");

    const statusEl = document.getElementById("importStatus");
    const keyText = document.getElementById("importKey").value.trim();
    const passphrase = document.getElementById("importPassphrase").value;

    if (!keyText || !passphrase) {
      showStatus(
        statusEl,
        "Please provide both the private key and passphrase",
        "error",
      );
      return;
    }

    showStatus(statusEl, "Importing key...", "info");
    this.importBtn.disabled = true;

    try {
      const result = await pgpHandler.importPrivateKey(keyText, passphrase);

      if (result.success) {
        console.log("[OpenPGP UI] Key imported successfully");
        showStatus(
          statusEl,
          `Key imported successfully! Fingerprint: ${result.fingerprint}`,
          "success",
        );

        document.getElementById("importKey").value = "";
        document.getElementById("importPassphrase").value = "";

        await this.refreshKeys();
      } else {
        console.error("[OpenPGP UI] Key import failed:", result.error);
        showStatus(statusEl, `Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("[OpenPGP UI] Unexpected error during import:", error);
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.importBtn.disabled = false;
    }
  }

  /**
   * Download text as a file
   *
   * @param {string} filename - Name of file to download
   * @param {string} content - Content of file
   */
  downloadTextFile(filename, content) {
    console.log("[OpenPGP UI] Downloading file:", filename);

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    // Use downloads API for Firefox extension
    browser.downloads
      .download({
        url: url,
        filename: filename,
        saveAs: true,
      })
      .then(() => {
        console.log("[OpenPGP UI] Download started");
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error("[OpenPGP UI] Download failed:", error);
      });
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Encryption Controller
 */
class EncryptionController {
  constructor() {
    console.log("[OpenPGP UI] Initializing encryption controller");

    this.encryptBtn = document.getElementById("encryptBtn");
    this.signCheckbox = document.getElementById("encryptSign");
    this.signOptions = document.getElementById("encryptSignOptions");

    this.encryptBtn.addEventListener("click", () => this.encrypt());
    this.signCheckbox.addEventListener("change", () => {
      setVisible(this.signOptions, this.signCheckbox.checked);
    });

    document
      .getElementById("copyEncryptedBtn")
      .addEventListener("click", () => {
        this.updateClipboard("encryptedText");
      });

    // Trigger encrypt when Enter is pressed in passphrase field
    document
      .getElementById("encryptSignPassphrase")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.encryptBtn.click();
        }
      });
  }

  /**
   * Encrypt a message
   */
  async encrypt() {
    console.log("[OpenPGP UI] Encrypt button clicked");

    const statusEl = document.getElementById("encryptStatus");
    const message = document.getElementById("encryptMessage").value.trim();
    const publicKey = document.getElementById("encryptRecipient").value.trim();
    const shouldSign = document.getElementById("encryptSign").checked;

    if (!message || !publicKey) {
      showStatus(
        statusEl,
        "Please provide both message and recipient public key",
        "error",
      );
      return;
    }

    showStatus(statusEl, "Encrypting message...", "info");
    this.encryptBtn.disabled = true;

    try {
      const options = {
        message,
        publicKey,
      };

      // Add signing if requested
      if (shouldSign) {
        const signerKey = document.getElementById("encryptSignerKey").value;
        const passphrase = document.getElementById(
          "encryptSignPassphrase",
        ).value;

        if (!signerKey || !passphrase) {
          showStatus(
            statusEl,
            "Please select signing key and enter passphrase",
            "error",
          );
          this.encryptBtn.disabled = false;
          return;
        }

        options.signWithKey = signerKey;
        options.passphrase = passphrase;
      }

      console.log("[OpenPGP UI] Calling PGP handler to encrypt");

      const result = await pgpHandler.encrypt(options);

      if (result.success) {
        console.log("[OpenPGP UI] Encryption successful");
        showStatus(statusEl, "Message encrypted successfully!", "success");

        document.getElementById("encryptedText").value = result.encrypted;
        setVisible(document.getElementById("encryptedOutput"), true);
      } else {
        console.error("[OpenPGP UI] Encryption failed:", result.error);
        showStatus(statusEl, `Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("[OpenPGP UI] Unexpected error during encryption:", error);
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.encryptBtn.disabled = false;
    }
  }

  /**
   * Copy text to clipboard
   *
   * @param {string} elementId - ID of textarea to copy from
   */
  async copyToClipboard(elementId) {
    const element = document.getElementById(elementId);

    try {
      await navigator.clipboard.writeText(element.value);
      console.log("[OpenPGP UI] Copied to clipboard");
      alert("Copied to clipboard!");
    } catch (error) {
      console.error("[OpenPGP UI] Copy failed:", error);
      // Fallback: select text
      element.select();
      alert("Please use Ctrl+C to copy");
    }
  }
}

/**
 * Decryption Controller
 */
class DecryptionController {
  constructor() {
    console.log("[OpenPGP UI] Initializing decryption controller");

    this.decryptBtn = document.getElementById("decryptBtn");

    this.decryptBtn.addEventListener("click", () => this.decrypt());
    document
      .getElementById("copyDecryptedBtn")
      .addEventListener("click", () => {
        this.copyToClipboard("decryptedText");
      });

    // Trigger decrypt when Enter is pressed in passphrase field
    document
      .getElementById("decryptPassphrase")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.decryptBtn.click();
        }
      });
  }

  /**
   * Decrypt a message
   */
  async decrypt() {
    console.log("[OpenPGP UI] Decrypt button clicked");

    const statusEl = document.getElementById("decryptStatus");
    const encrypted = document.getElementById("decryptMessage").value.trim();
    const privateKeyFingerprint = document.getElementById("decryptKey").value;
    const passphrase = document.getElementById("decryptPassphrase").value;
    const verifyWithKey =
      document.getElementById("decryptVerifyKey").value.trim() || null;

    if (!encrypted || !privateKeyFingerprint || !passphrase) {
      showStatus(
        statusEl,
        "Please provide encrypted message, select key, and enter passphrase",
        "error",
      );
      return;
    }

    showStatus(statusEl, "Decrypting message...", "info");
    this.decryptBtn.disabled = true;

    try {
      console.log("[OpenPGP UI] Calling PGP handler to decrypt");

      const result = await pgpHandler.decrypt({
        encrypted,
        privateKeyFingerprint,
        passphrase,
        verifyWithKey,
      });

      if (result.success) {
        console.log("[OpenPGP UI] Decryption successful");
        showStatus(statusEl, "Message decrypted successfully!", "success");

        document.getElementById("decryptedText").value = result.decrypted;

        // Display signature info if present
        const sigInfo = document.getElementById("signatureInfo");
        if (result.signatureInfo) {
          if (result.signatureInfo.valid === true) {
            sigInfo.innerHTML = `<div class="signature-valid">✓ Valid signature from key: ${result.signatureInfo.keyID}</div>`;
          } else if (result.signatureInfo.valid === false) {
            sigInfo.innerHTML = `<div class="signature-invalid">✗ Invalid signature: ${result.signatureInfo.error}</div>`;
          } else {
            // valid === null means signature detected but not verified
            sigInfo.innerHTML = `<div class="signature-unverified">⚠ Signature detected from key: ${result.signatureInfo.keyID}<br><small>${result.signatureInfo.note}</small></div>`;
          }
        } else {
          sigInfo.innerHTML =
            '<div class="signature-none">No signature found</div>';
        }

        setVisible(document.getElementById("decryptedOutput"), true);
      }
    } catch (error) {
      console.error("[OpenPGP UI] Unexpected error during decryption:", error);
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.decryptBtn.disabled = false;
    }
  }

  /**
   * Copy text to clipboard
   *
   * @param {string} elementId - ID of textarea to copy from
   */
  async copyToClipboard(elementId) {
    const element = document.getElementById(elementId);

    try {
      await navigator.clipboard.writeText(element.value);
      console.log("[OpenPGP UI] Copied to clipboard");
      alert("Copied to clipboard!");
    } catch (error) {
      console.error("[OpenPGP UI] Copy failed:", error);
      element.select();
      alert("Please use Ctrl+C to copy");
    }
  }
}

/**
 * Signing Controller
 */
class SigningController {
  constructor() {
    console.log("[OpenPGP UI] Initializing signing controller");

    this.signBtn = document.getElementById("signBtn");

    this.signBtn.addEventListener("click", () => this.sign());
    document.getElementById("copySignedBtn").addEventListener("click", () => {
      this.copyToClipboard("signedText");
    });

    // Trigger sign when Enter is pressed in passphrase field
    document
      .getElementById("signPassphrase")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.signBtn.click();
        }
      });
  }

  /**
   * Sign a message
   */
  async sign() {
    console.log("[OpenPGP UI] Sign button clicked");

    const statusEl = document.getElementById("signStatus");
    const message = document.getElementById("signMessage").value.trim();
    const privateKeyFingerprint = document.getElementById("signKey").value;
    const passphrase = document.getElementById("signPassphrase").value;
    const signType = document.querySelector(
      'input[name="signType"]:checked',
    ).value;

    if (!message || !privateKeyFingerprint || !passphrase) {
      showStatus(
        statusEl,
        "Please provide message, select key, and enter passphrase",
        "error",
      );
      return;
    }

    showStatus(statusEl, "Signing message...", "info");
    this.signBtn.disabled = true;

    try {
      console.log("[OpenPGP UI] Calling PGP handler to sign");

      const result = await pgpHandler.sign({
        message,
        privateKeyFingerprint,
        passphrase,
        detached: signType === "detached",
      });

      if (result.success) {
        console.log("[OpenPGP UI] Signing successful");
        showStatus(statusEl, "Message signed successfully!", "success");

        document.getElementById("signedText").value = result.signed;
        setVisible(document.getElementById("signedOutput"), true);
      } else {
        console.error("[OpenPGP UI] Signing failed:", result.error);
        showStatus(statusEl, `Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("[OpenPGP UI] Unexpected error during signing:", error);
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.signBtn.disabled = false;
    }
  }

  /**
   * Copy text to clipboard
   *
   * @param {string} elementId - ID of textarea to copy from
   */
  async copyToClipboard(elementId) {
    const element = document.getElementById(elementId);

    try {
      await navigator.clipboard.writeText(element.value);
      console.log("[OpenPGP UI] Copied to clipboard");
      alert("Copied to clipboard!");
    } catch (error) {
      console.error("[OpenPGP UI] Copy failed:", error);
      element.select();
      alert("Please use Ctrl+C to copy");
    }
  }
}

/**
 * Verification Controller
 */
class VerificationController {
  constructor() {
    console.log("[OpenPGP UI] Initializing verification controller");

    this.verifyBtn = document.getElementById("verifyBtn");

    this.verifyBtn.addEventListener("click", () => this.verify());
  }

  /**
   * Verify a signed message
   */
  async verify() {
    console.log("[OpenPGP UI] Verify button clicked");

    const statusEl = document.getElementById("verifyStatus");
    const signedMessage = document.getElementById("verifyMessage").value.trim();
    const publicKey = document.getElementById("verifyPublicKey").value.trim();

    if (!signedMessage || !publicKey) {
      showStatus(
        statusEl,
        "Please provide both signed message and public key",
        "error",
      );
      return;
    }

    showStatus(statusEl, "Verifying signature...", "info");
    this.verifyBtn.disabled = true;

    try {
      console.log("[OpenPGP UI] Calling PGP handler to verify");

      const result = await pgpHandler.verify({
        signedMessage,
        publicKey,
      });

      if (result.success) {
        console.log("[OpenPGP UI] Verification complete");

        /*
         */
        if (result.valid) {
          showStatus(statusEl, "Signature is VALID ✓", "success");
          document.getElementById("verifyResult").innerHTML = `
                        <div class="signature-valid">
                            <h3>✓ Valid Signature</h3>
                            <p>Signed by key: <code>${result.keyID}</code></p>
                        </div>
                    `;
        } else {
          showStatus(statusEl, "Signature is INVALID ✗", "error");
          document.getElementById("verifyResult").innerHTML = `
                        <div class="signature-invalid">
                            <h3>✗ Invalid Signature</h3>
                            <p>Error: ${result.error}</p>
                        </div>
                    `;
        }
        if (result.message) {
          document.getElementById("verifyMessageText").innerHTML = `
                        <h3>Message:</h3>
                        <pre>${this.escapeHtml(result.message)}</pre>
                    `;
        }

        setVisible(document.getElementById("verifyOutput"), true);
      } else {
        console.error("[OpenPGP UI] Verification failed:", result.error);
        showStatus(statusEl, `Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error(
        "[OpenPGP UI] Unexpected error during verification:",
        error,
      );
      showStatus(statusEl, `Unexpected error: ${error.message}`, "error");
    } finally {
      this.verifyBtn.disabled = false;
    }
  }

  /**
   * Escape HTML to prevent XSS
   *
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Initialize all controllers when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("[OpenPGP UI] DOM loaded, initializing controllers");

  // Initialize controllers
  const tabManager = new TabManager();
  const keyManagement = new KeyManagement();
  const encryptionController = new EncryptionController();
  const decryptionController = new DecryptionController();
  const signingController = new SigningController();
  const verificationController = new VerificationController();

  // Set up debug mode toggle
  const debugCheckbox = document.getElementById("debugMode");

  // Load debug mode state
  browser.storage.local.get("debugMode").then((result) => {
    if (result.debugMode !== undefined) {
      debugCheckbox.checked = result.debugMode;
    }
  });

  debugCheckbox.addEventListener("change", () => {
    pgpHandler.setDebugMode(debugCheckbox.checked);
    console.log("[OpenPGP UI] Debug mode toggled:", debugCheckbox.checked);
  });

  // Listen for lock requests from the background script (e.g. on browser startup / suspend)
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "lockMasterPassword") {
      console.log("[OpenPGP UI] Received lockMasterPassword — locking session");
      pgpHandler.lockMasterPassword();
      // Re-show the unlock banner if master password is configured
      pgpHandler.isMasterPasswordRequired().then((required) => {
        if (required) {
          setVisible(document.getElementById("masterPasswordBanner"), true);
          keyManagement.renderMasterPasswordSection(true, false);
        }
      });
    }
  });

  console.log("[OpenPGP UI] All controllers initialized successfully");
});
