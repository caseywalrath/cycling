// Google Drive Sync Module for Casey Rides
// Handles OAuth authentication and Drive API operations

const GoogleDriveSync = {
  // Configuration
  CLIENT_ID: '221046726332-pkg4cd9ec5rosr6f1tc8clg1p4mu3noa.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.file',
  BACKUP_FILENAME: 'casey-rides-backup.json',

  // State
  tokenClient: null,
  accessToken: null,
  isInitialized: false,

  /**
   * Initialize the Google Identity Services client
   * Call this once when the app loads
   */
  init() {
    if (this.isInitialized) return;

    if (typeof google === 'undefined' || !google.accounts) {
      console.error('Google Identity Services not loaded');
      return;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('OAuth error:', response.error);
          return;
        }
        this.accessToken = response.access_token;
      }
    });

    this.isInitialized = true;
  },

  /**
   * Request access token (prompts user if needed)
   * Returns a Promise that resolves when authenticated
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        this.init();
      }

      if (!this.tokenClient) {
        reject(new Error('Google Identity Services not available. Please reload the page.'));
        return;
      }

      // Update callback to resolve promise
      this.tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        this.accessToken = response.access_token;
        resolve(response.access_token);
      };

      // Check if we already have a valid token
      if (this.accessToken) {
        resolve(this.accessToken);
        return;
      }

      // Request new token (will show consent popup if needed)
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  /**
   * Search for existing backup file in Drive
   * Returns file metadata if found, null if not
   */
  async findBackupFile() {
    const query = encodeURIComponent(`name='${this.BACKUP_FILENAME}' and trashed=false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.status === 401) {
      this.accessToken = null;
      throw new Error('Session expired. Please try again.');
    }

    if (!response.ok) {
      throw new Error(`Drive API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      return data.files[0];
    }

    return null;
  },

  /**
   * Download backup file contents from Drive
   * Returns parsed JSON object
   */
  async downloadBackup(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.status === 401) {
      this.accessToken = null;
      throw new Error('Session expired. Please try again.');
    }

    if (!response.ok) {
      throw new Error(`Download error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Upload backup to Drive (create new file)
   * Returns created file metadata
   */
  async createBackup(data) {
    const metadata = {
      name: this.BACKUP_FILENAME,
      mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: form
    });

    if (response.status === 401) {
      this.accessToken = null;
      throw new Error('Session expired. Please try again.');
    }

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment.');
    }

    if (!response.ok) {
      throw new Error(`Upload error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Update existing backup file in Drive
   * Returns updated file metadata
   */
  async updateBackup(fileId, data) {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data, null, 2)
    });

    if (response.status === 401) {
      this.accessToken = null;
      throw new Error('Session expired. Please try again.');
    }

    if (response.status === 429) {
      throw new Error('Too many requests. Please wait a moment.');
    }

    if (!response.ok) {
      throw new Error(`Update error: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Main sync function
   * Compares local and remote timestamps, syncs accordingly
   *
   * @param {Object} localData - Current app data
   * @param {Function} onPull - Callback when remote data should replace local
   * @returns {Object} - Sync result with status and message
   */
  async sync(localData, onPull) {
    if (!navigator.onLine) {
      return {
        status: 'error',
        message: 'No internet connection',
        action: 'none'
      };
    }

    try {
      // Step 1: Authenticate
      await this.authenticate();
      console.log('[Sync] Authenticated, token:', this.accessToken ? 'present' : 'missing');

      // Step 2: Find existing backup
      const existingFile = await this.findBackupFile();
      console.log('[Sync] Find backup result:', existingFile);

      // Step 3: Handle first-time sync (no remote file)
      if (!existingFile) {
        const dataToUpload = {
          ...localData,
          syncVersion: 1,
          lastSyncedAt: new Date().toISOString(),
          exportedAt: localData.exportedAt || new Date().toISOString()
        };

        await this.createBackup(dataToUpload);
        const rideCount = (localData.history || []).length;

        return {
          status: 'created',
          message: `Backup created in Google Drive (${rideCount} rides)`,
          action: 'push'
        };
      }

      // Step 4: Download remote backup
      const remoteData = await this.downloadBackup(existingFile.id);
      const localRideCount = (localData.history || []).length;
      const remoteRideCount = (remoteData.history || []).length;
      console.log('[Sync] Local exportedAt:', localData.exportedAt, '| Remote exportedAt:', remoteData.exportedAt);
      console.log('[Sync] Local rides:', localRideCount, '| Remote rides:', remoteRideCount);

      // Step 5: Compare timestamps
      const localTime = new Date(localData.exportedAt || 0).getTime();
      const remoteTime = new Date(remoteData.exportedAt || 0).getTime();
      console.log('[Sync] Local time:', localTime, '| Remote time:', remoteTime);

      // Step 5b: Safeguard — if local has no data but remote does, always pull
      // This handles fresh installs, cleared cache, or any case where local is empty
      if (localRideCount === 0 && remoteRideCount > 0) {
        console.log('[Sync] Local is empty but remote has data — forcing pull');
        remoteData.lastSyncedAt = new Date().toISOString();

        if (onPull && typeof onPull === 'function') {
          onPull(remoteData);
        }

        return {
          status: 'pulled',
          message: `Restored ${remoteRideCount} rides from Google Drive`,
          action: 'pull',
          data: remoteData
        };
      }

      // Step 6: Determine sync action
      if (localTime > remoteTime) {
        // Local is newer - push to Drive
        const dataToUpload = {
          ...localData,
          syncVersion: localData.syncVersion || 1,
          lastSyncedAt: new Date().toISOString()
        };

        await this.updateBackup(existingFile.id, dataToUpload);

        return {
          status: 'pushed',
          message: `Uploaded ${localRideCount} rides to Google Drive`,
          action: 'push'
        };

      } else if (remoteTime > localTime) {
        // Remote is newer - pull from Drive
        remoteData.lastSyncedAt = new Date().toISOString();

        if (onPull && typeof onPull === 'function') {
          onPull(remoteData);
        }

        return {
          status: 'pulled',
          message: `Restored ${remoteRideCount} rides from Google Drive`,
          action: 'pull',
          data: remoteData
        };

      } else {
        return {
          status: 'synced',
          message: `Already in sync (${localRideCount} rides)`,
          action: 'none'
        };
      }

    } catch (error) {
      console.error('[Sync] Error:', error);
      return {
        status: 'error',
        message: error.message || 'Sync failed',
        action: 'none',
        error: error
      };
    }
  },

  /**
   * Sign out and revoke access
   */
  signOut() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
    }
  }
};

export default GoogleDriveSync;
