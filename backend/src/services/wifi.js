/**
 * WiFi provisioning service for Raspberry Pi OS Bookworm
 * Handles network scanning, connection, and wpa_supplicant management
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const { promisify } = require('util');
const logger = require('../utils/logger');

// Create execAsync with UTF-8 locale
const execAsync = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, { 
      encoding: 'utf8', 
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } 
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const WPA_SUPPLICANT_CONF = '/etc/wpa_supplicant/wpa_supplicant.conf';
const WPA_SUPPLICANT_BACKUP = '/etc/wpa_supplicant/wpa_supplicant.conf.backup';

class WiFiService {
  /**
   * List available WiFi networks
   * Works on Raspberry Pi OS Bookworm using nmcli or iw
   * Note: iw can scan even when hotspot is active
   */
  async scanNetworks() {
    try {
      logger.info('Scanning for WiFi networks');
      
      // Check if we're in hotspot mode
      let isHotspot = false;
      try {
        const { stdout: nmstatusOut } = await execAsync('nmcli -t -f GENERAL.STATE,GENERAL.CONNECTION connection show Hotspot 2>/dev/null || echo ""');
        isHotspot = nmstatusOut && nmstatusOut.includes('activated');
      } catch (_) {
        isHotspot = false;
      }
      
      // If in hotspot mode, use iw which can scan even when interface is in AP mode
      if (isHotspot) {
        logger.info('Hotspot active, using iw for scanning');
        try {
          // Trigger a scan
          await execAsync('iw dev wlan0 scan trigger 2>/dev/null || true');
          // Wait a bit for scan to complete
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { stdout } = await execAsync('iw dev wlan0 scan dump 2>/dev/null');
          
          const networks = [];
          const bssBlocks = stdout.split('BSS ');
          
          for (const block of bssBlocks.slice(1)) {
            const ssidMatch = block.match(/SSID: (.+)/);
            const signalMatch = block.match(/signal: ([-\d.]+) dBm/);
            const hasEncryption = block.includes('RSN:') || block.includes('WPA:');
            
            if (ssidMatch && ssidMatch[1] && ssidMatch[1].trim()) {
              const ssid = ssidMatch[1].trim();
              
              // Skip our own hotspot
              if (ssid === 'SmartMirror-Setup' || ssid === 'Hotspot') {
                continue;
              }
              
              // Convert dBm to percentage (approximate)
              let signal = 0;
              if (signalMatch) {
                const dbm = parseFloat(signalMatch[1]);
                signal = Math.min(100, Math.max(0, (dbm + 100) * 2));
              }
              
              // Avoid duplicates
              if (!networks.find(n => n.ssid === ssid)) {
                networks.push({
                  ssid,
                  signal: Math.round(signal),
                  secured: hasEncryption
                });
              }
            }
          }
          
          // Sort by signal strength
          networks.sort((a, b) => b.signal - a.signal);
          
          logger.info('WiFi scan completed (iw - hotspot mode)', { count: networks.length });
          return networks;
        } catch (iwError) {
          logger.warn('iw scan failed in hotspot mode', { error: iwError.message });
        }
      }
      
      // Try nmcli first (NetworkManager - common in Bookworm)
      try {
        logger.info('Attempting nmcli scan');
        // Trigger a rescan
        await execAsync('nmcli device wifi rescan 2>&1 || true');
        logger.info('nmcli rescan triggered, waiting 1s');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logger.info('Fetching wifi list');
        const { stdout } = await execAsync('nmcli -t -f SSID,SIGNAL,SECURITY dev wifi list 2>&1');
        logger.info('Got nmcli output', { length: stdout ? stdout.length : 0 });
        
        if (stdout && stdout.length > 0) {
          const networks = [];
          const lines = stdout.trim().split('\n');
          
          for (const line of lines) {
            const [ssid, signal, security] = line.split(':');
            
            if (ssid && ssid.trim() && ssid !== '--') {
              // Avoid duplicates
              if (!networks.find(n => n.ssid === ssid)) {
                networks.push({
                  ssid: ssid.trim(),
                  signal: parseInt(signal) || 0,
                  secured: security && security !== ''
                });
              }
            }
          }
          
          // Sort by signal strength
          networks.sort((a, b) => b.signal - a.signal);
          
          logger.info('WiFi scan completed (nmcli)', { count: networks.length });
          return networks;
        }
      } catch (nmcliError) {
        logger.debug('nmcli not available, trying iw');
      }
      
      // Fallback to iw (modern replacement for iwlist)
      try {
        const { stdout } = await execAsync('iw dev wlan0 scan 2>/dev/null');
        
        const networks = [];
        const bssBlocks = stdout.split('BSS ');
        
        for (const block of bssBlocks.slice(1)) {
          const ssidMatch = block.match(/SSID: (.+)/);
          const signalMatch = block.match(/signal: ([-\d.]+) dBm/);
          const hasEncryption = block.includes('RSN:') || block.includes('WPA:');
          
          if (ssidMatch && ssidMatch[1] && ssidMatch[1].trim()) {
            const ssid = ssidMatch[1].trim();
            
            // Convert dBm to percentage (approximate)
            let signal = 0;
            if (signalMatch) {
              const dbm = parseFloat(signalMatch[1]);
              signal = Math.min(100, Math.max(0, (dbm + 100) * 2));
            }
            
            // Avoid duplicates
            if (!networks.find(n => n.ssid === ssid)) {
              networks.push({
                ssid,
                signal: Math.round(signal),
                secured: hasEncryption
              });
            }
          }
        }
        
        // Sort by signal strength
        networks.sort((a, b) => b.signal - a.signal);
        
        logger.info('WiFi scan completed (iw)', { count: networks.length });
        return networks;
      } catch (iwError) {
        logger.debug('iw not available, trying iwlist');
      }
      
      // Final fallback to iwlist (legacy)
      const { stdout } = await execAsync('iwlist wlan0 scan 2>/dev/null || echo "SCAN_FAILED"');
      
      if (!stdout || stdout.includes('SCAN_FAILED')) {
        logger.warn('WiFi scan failed - all methods exhausted');
        return [];
      }

      const networks = [];
      const cells = stdout.split('Cell ');
      
      for (const cell of cells.slice(1)) {
        const ssidMatch = cell.match(/ESSID:"(.+?)"/);
        const qualityMatch = cell.match(/Quality=(\d+)\/(\d+)/);
        const encryptionMatch = cell.match(/Encryption key:(on|off)/);
        
        if (ssidMatch && ssidMatch[1]) {
          const ssid = ssidMatch[1];
          const quality = qualityMatch 
            ? Math.round((parseInt(qualityMatch[1]) / parseInt(qualityMatch[2])) * 100)
            : 0;
          const secured = encryptionMatch ? encryptionMatch[1] === 'on' : true;
          
          if (!networks.find(n => n.ssid === ssid)) {
            networks.push({
              ssid,
              signal: quality,
              secured
            });
          }
        }
      }
      
      networks.sort((a, b) => b.signal - a.signal);
      
      logger.info('WiFi scan completed (iwlist)', { count: networks.length });
      return networks;
      
    } catch (error) {
      logger.error('WiFi scan failed', { error: error.message });
      return [];
    }
  }

  async getStatus() {
    try {
      // Get current WiFi status
      const { stdout: iwconfigOut } = await execAsync('iwconfig wlan0 2>/dev/null || echo "NOT_FOUND"');
      
      if (iwconfigOut.includes('NOT_FOUND')) {
        return {
          connected: false,
          ssid: null,
          ipAddress: null,
          message: 'WiFi interface not found'
        };
      }

      const ssidMatch = iwconfigOut.match(/ESSID:"(.+?)"/);
      const ssid = ssidMatch ? ssidMatch[1] : null;
      
      if (!ssid || ssid === 'off/any') {
        return {
          connected: false,
          ssid: null,
          ipAddress: null
        };
      }

      // Get IP address (try multiple methods)
      let ipAddress = null;
      try {
        const { stdout: ipOut } = await execAsync('ip addr show wlan0 2>/dev/null || echo ""');
        const ipMatch = ipOut.match(/inet (\d+\.\d+\.\d+\.\d+)/);
        ipAddress = ipMatch ? ipMatch[1] : null;
      } catch (_) {}
      if (!ipAddress) {
        try {
          const { stdout: nmIp } = await execAsync("nmcli -g IP4.ADDRESS device show wlan0 2>/dev/null | head -n1");
          const m = nmIp.match(/(\d+\.\d+\.\d+\.\d+)/);
          ipAddress = m ? m[1] : null;
        } catch (_) {}
      }
      if (!ipAddress) {
        try {
          const { stdout: hostIp } = await execAsync('hostname -I 2>/dev/null | awk "{print $1}"');
          ipAddress = (hostIp || '').trim() || null;
        } catch (_) {}
      }

      return {
        connected: true,
        ssid,
        ipAddress
      };
      
    } catch (error) {
      logger.error('Failed to get WiFi status', { error: error.message });
      return {
        connected: false,
        ssid: null,
        ipAddress: null,
        error: error.message
      };
    }
  }

  /**
   * Connect to WiFi network
   * Works on Raspberry Pi OS Bookworm with both NetworkManager and wpa_supplicant
   * Supports open networks (no password) and captive portal detection
   * Automatically stops hotspot if active
   */
  async connectToWifi(ssid, password) {
    try {
      logger.info('Attempting to connect to WiFi', { ssid, isOpen: !password });
      
      // Stop hotspot if it's running
      try {
        await this.stopHotspot();
        logger.info('Stopped hotspot before connecting to new network');
        // Wait a moment for the interface to fully release
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Rescan for networks after stopping hotspot
        try {
          await execAsync('nmcli device wifi rescan');
          logger.info('Rescanned for WiFi networks');
          // Wait for scan to complete
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (rescanError) {
          logger.warn('WiFi rescan failed, continuing anyway', { error: rescanError.message });
        }
      } catch (error) {
        logger.debug('No hotspot to stop or failed to stop', { error: error.message });
      }
      
      // Try NetworkManager first (recommended for Bookworm)
      try {
        const { stdout } = await execAsync('which nmcli 2>/dev/null');
        
        if (stdout) {
          logger.info('Using NetworkManager to connect');
          
          // Remove existing connection if it exists
          await execAsync(`nmcli connection delete "${ssid}" 2>/dev/null || true`);
          
          // Add and connect to the network
          if (password && password.trim()) {
            // Secured network
            await execAsync(
              `nmcli device wifi connect "${ssid}" password "${password}" 2>&1`
            );
          } else {
            // Open network (no password)
            await execAsync(
              `nmcli device wifi connect "${ssid}" 2>&1`
            );
          }
          
          // Wait for connection
          await this._waitForConnection(5);
          
          const status = await this.getStatus();
          
          if (status.connected && status.ssid === ssid) {
            // Check for captive portal
            const captivePortal = await this._detectCaptivePortal();
            
            logger.info('Successfully connected to WiFi via NetworkManager', { 
              ssid, 
              hasCaptivePortal: captivePortal.detected 
            });
            
            return {
              success: true,
              message: captivePortal.detected 
                ? 'Connected - Captive portal detected' 
                : 'Connected successfully',
              method: 'nmcli',
              captivePortal: captivePortal.detected,
              portalUrl: captivePortal.url,
              ...status
            };
          }
        }
      } catch (nmcliError) {
        logger.warn('NetworkManager connection failed, trying wpa_supplicant', {
          error: nmcliError.message,
          stderr: nmcliError.stderr,
          stdout: nmcliError.stdout
        });
      }
      
      // Fallback to wpa_supplicant method
      return await this._connectViaWpaSupplicant(ssid, password);
      
    } catch (error) {
      logger.error('WiFi connection failed', { error: error.message, ssid });
      return {
        success: false,
        message: error.message,
        connected: false
      };
    }
  }

  /**
   * Connect via wpa_supplicant (legacy method, works on all systems)
   */
  async _connectViaWpaSupplicant(ssid, password) {
    try {
      logger.info('Using wpa_supplicant to connect', { ssid });
      
      // Read existing wpa_supplicant config
      let existingConfig = '';
      try {
        existingConfig = await fs.readFile(WPA_SUPPLICANT_CONF, 'utf8');
      } catch (error) {
        logger.warn('Could not read existing wpa_supplicant.conf, creating new one');
        existingConfig = 'ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\ncountry=US\n\n';
      }
      
      // Backup existing config
      try {
        await execAsync(`cp ${WPA_SUPPLICANT_CONF} ${WPA_SUPPLICANT_BACKUP} 2>/dev/null`);
        logger.info('Backed up existing wpa_supplicant.conf');
      } catch (error) {
        logger.warn('Could not backup wpa_supplicant.conf');
      }
      
      // Generate PSK hash for better security
      let pskHash = '';
      try {
        const { stdout } = await execAsync(`wpa_passphrase "${ssid}" "${password}" 2>/dev/null`);
        pskHash = stdout;
      } catch (error) {
        logger.warn('wpa_passphrase not available, using plain password');
      }
      
      // Create network block
      let networkBlock;
      
      if (!password || !password.trim()) {
        // Open network (no password)
        networkBlock = `
network={
    ssid="${ssid}"
    key_mgmt=NONE
    priority=10
}
`;
      } else if (pskHash && pskHash.includes('psk=')) {
        // Use hashed PSK
        const pskLine = pskHash.split('\n').find(line => line.includes('psk=') && !line.includes('#psk'));
        const pskValue = pskLine ? pskLine.split('=')[1].trim() : '';
        
        networkBlock = `
network={
    ssid="${ssid}"
    ${pskValue ? `psk=${pskValue}` : `psk="${password}"`}
    key_mgmt=WPA-PSK
    priority=10
}
`;
      } else {
        // Use plain password
        networkBlock = `
network={
    ssid="${ssid}"
    psk="${password}"
    key_mgmt=WPA-PSK
    priority=10
}
`;
      }
      
      // Remove existing network block for this SSID if present
      const ssidPattern = new RegExp(`network=\\{[^}]*ssid="${ssid}"[^}]*\\}`, 'g');
      existingConfig = existingConfig.replace(ssidPattern, '');
      
      // Append new network block
      const newConfig = existingConfig.trim() + '\n' + networkBlock;
      
      // Write to temporary file
      const tempFile = '/tmp/wpa_supplicant_temp.conf';
      await execAsync(`echo '${newConfig.replace(/'/g, "'\\''")}'  | tee ${tempFile} > /dev/null`);
      
      // Copy to actual location
      await execAsync(`cp ${tempFile} ${WPA_SUPPLICANT_CONF}`);
      await execAsync(`chmod 600 ${WPA_SUPPLICANT_CONF}`);
      
      // Restart wpa_supplicant
      await this._restartWpaSupplicant();
      
      // Wait for connection
      await this._waitForConnection(8);
      
      // Check connection status
      const status = await this.getStatus();
      
      if (status.connected && status.ssid === ssid) {
        // Check for captive portal
        const captivePortal = await this._detectCaptivePortal();
        
        logger.info('Successfully connected to WiFi via wpa_supplicant', { 
          ssid,
          hasCaptivePortal: captivePortal.detected 
        });
        
        return {
          success: true,
          message: captivePortal.detected 
            ? 'Connected - Captive portal detected' 
            : 'Connected successfully',
          method: 'wpa_supplicant',
          captivePortal: captivePortal.detected,
          portalUrl: captivePortal.url,
          ...status
        };
      } else {
        logger.warn('WiFi connection attempt unsuccessful', { ssid });
        return {
          success: false,
          message: 'Connection failed - please check credentials',
          ...status
        };
      }
      
    } catch (error) {
      logger.error('wpa_supplicant connection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Restart wpa_supplicant service
   */
  async _restartWpaSupplicant() {
    try {
      logger.info('Restarting wpa_supplicant');
      
      // Try multiple methods to restart wpa_supplicant
      const restartCommands = [
        'systemctl restart wpa_supplicant',
        'wpa_cli -i wlan0 reconfigure',
        'killall wpa_supplicant && wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf'
      ];
      
      for (const cmd of restartCommands) {
        try {
          await execAsync(cmd);
          logger.info('wpa_supplicant restarted successfully', { method: cmd.split(' ')[1] });
          await new Promise(resolve => setTimeout(resolve, 2000));
          return;
        } catch (error) {
          logger.debug('Restart method failed', { cmd, error: error.message });
        }
      }
      
      logger.warn('All wpa_supplicant restart methods failed');
      
    } catch (error) {
      logger.error('Failed to restart wpa_supplicant', { error: error.message });
    }
  }

  /**
   * Wait for WiFi connection to establish
   */
  async _waitForConnection(timeoutSeconds = 10) {
    logger.info('Waiting for WiFi connection', { timeout: timeoutSeconds });
    
    const startTime = Date.now();
    const timeout = timeoutSeconds * 1000;
    
    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus();
      
      if (status.connected && status.ipAddress) {
        logger.info('WiFi connection established', { 
          ssid: status.ssid,
          ip: status.ipAddress 
        });
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.warn('WiFi connection timeout');
    return false;
  }

  /**
   * Detect if the current network requires captive portal authentication
   * Tests connectivity by trying to reach a known endpoint
   */
  async _detectCaptivePortal() {
    try {
      // Try to connect to a captive portal detection endpoint
      // Many systems use http://captive.apple.com or http://connectivitycheck.gstatic.com
      const testUrls = [
        'http://captive.apple.com/hotspot-detect.html',
        'http://connectivitycheck.gstatic.com/generate_204',
        'http://clients3.google.com/generate_204'
      ];

      for (const url of testUrls) {
        try {
          const { stdout } = await execAsync(
            `curl -s -L -I -m 5 --max-redirs 0 "${url}" 2>&1 | head -n 1`,
            { timeout: 6000 }
          );
          
          // If we get a redirect (302, 301) or other non-success code, likely captive portal
          if (stdout.includes('HTTP/1.1 302') || stdout.includes('HTTP/1.1 301') || 
              stdout.includes('HTTP/1.0 302') || stdout.includes('HTTP/1.0 301')) {
            logger.info('Captive portal detected via redirect');
            return { detected: true, url: 'http://captive.apple.com' };
          }
          
          // Check if response is not the expected one
          if (!stdout.includes('HTTP/1.1 200') && !stdout.includes('HTTP/1.1 204')) {
            logger.info('Captive portal likely detected (non-200/204 response)');
            return { detected: true, url: 'http://captive.apple.com' };
          }
        } catch (error) {
          // Timeout or error might indicate captive portal
          logger.debug('Captive portal check error', { error: error.message });
        }
      }
      
      // Try a simple internet connectivity test
      try {
        await execAsync('ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1', { timeout: 4000 });
        logger.info('No captive portal detected - internet accessible');
        return { detected: false, url: null };
      } catch (error) {
        // Can't reach internet but have IP - likely captive portal
        logger.info('Captive portal suspected - no internet access despite connection');
        return { detected: true, url: 'http://captive.apple.com' };
      }
      
    } catch (error) {
      logger.error('Captive portal detection failed', { error: error.message });
      return { detected: false, url: null };
    }
  }

  /**
   * Legacy method name for backward compatibility
   */
  async connect(ssid, password) {
    return await this.connectToWifi(ssid, password);
  }

  async disconnect() {
    try {
      logger.info('Disconnecting from WiFi');
      await execAsync('wpa_cli -i wlan0 disconnect');
      
      return {
        success: true,
        message: 'Disconnected from WiFi'
      };
      
    } catch (error) {
      logger.error('Failed to disconnect WiFi', { error: error.message });
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Start WiFi hotspot using NetworkManager
   */
  async startHotspot(ssid = 'SmartMirror-Setup', password = '') {
    try {
      logger.info('Starting WiFi hotspot', { ssid, password: password ? '***' : 'open' });

      // Ensure NetworkManager is available
      await execAsync('which nmcli');

      // Try bringing up existing hotspot connection first
      try {
        await execAsync('nmcli connection up Hotspot 2>/dev/null');
        logger.info('Existing Hotspot connection brought up');
      } catch (_) {
        // Create a new hotspot (open if no password provided)
        if (password) {
          await execAsync(`nmcli dev wifi hotspot ifname wlan0 ssid "${ssid}" password "${password}"`);
        } else {
          // Open hotspot without password
          await execAsync(`nmcli dev wifi hotspot ifname wlan0 ssid "${ssid}"`);
        }
        logger.info('Created new hotspot', { open: !password });
      }

      // Get hotspot IP (NetworkManager default shared is 10.42.0.1)
      const { stdout } = await execAsync('ip addr show wlan0 | grep -oE "inet \\d+\\.\\d+\\.\\d+\\.\\d+" | awk \'{print $2}\' | head -n1 || true');

      return { success: true, ssid, ipAddress: stdout.trim() || '10.42.0.1' };
    } catch (error) {
      logger.error('Failed to start hotspot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop WiFi hotspot
   */
  async stopHotspot() {
    try {
      logger.info('Stopping WiFi hotspot');
      await execAsync('which nmcli');
      // Try to bring down hotspot connection if active
      await execAsync('nmcli connection down Hotspot 2>/dev/null || true');
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop hotspot', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Hotspot status (basic)
   */
  async hotspotStatus() {
    try {
      await execAsync('which nmcli');
      const { stdout } = await execAsync('nmcli -t -f NAME,TYPE,DEVICE,STATE connection show --active | grep "^Hotspot:" || true');
      const active = !!(stdout && stdout.trim().length > 0);
      return { active };
    } catch (error) {
      return { active: false };
    }
  }

  /**
   * Forget the current (or specified) Wi‑Fi network so the Pi won't auto-reconnect.
   * Prioritizes NetworkManager; falls back to clearing wpa_supplicant.
   */
  async forgetNetwork(targetSsid = null, forgetAll = false) {
    try {
      let ssid = targetSsid;
      if (!ssid) {
        const status = await this.getStatus();
        ssid = status?.ssid || null;
      }

      if (!ssid && !forgetAll) {
        return { success: false, error: 'No SSID to forget' };
      }

      logger.info('Forgetting WiFi network', { ssid, forgetAll });

      // Try NetworkManager first
      try {
        await execAsync('which nmcli');
        // List Wi-Fi connection profiles
        const { stdout: listOut } = await execAsync('nmcli -t -f NAME,UUID,TYPE connection show');
        const wifiConns = listOut
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .map(l => {
            const [name, uuid, type] = l.split(':');
            return { name, uuid, type };
          })
          .filter(c => c.type === 'wifi');

        // Determine which profiles to delete
        const toDelete = [];
        if (forgetAll) {
          toDelete.push(...wifiConns);
        } else {
          // Query connection details to match SSID
          for (const conn of wifiConns) {
            try {
              const { stdout: details } = await execAsync(`nmcli connection show "${conn.name}"`);
              if (details.includes(`ssid = ${ssid}`) || conn.name === ssid || (conn.name && conn.name.includes(ssid))) {
                toDelete.push(conn);
              }
            } catch (_) {}
          }
        }

        // Delete the selected connections
        for (const { name, uuid } of toDelete) {
          try {
            await execAsync(`nmcli connection delete uuid ${uuid}`);
            logger.info('Deleted NM connection (uuid)', { name, uuid });
          } catch (e) {
            logger.warn('Failed to delete NM connection', { name, error: e.message });
          }
        }

        // Remove any persisted NM profiles (.nmconnection files)
        try {
          if (forgetAll) {
            await execAsync(`find /etc/NetworkManager/system-connections -type f -name '*.nmconnection' -exec rm -f {} +`);
            logger.info('Removed all NM system-connections files');
          } else {
            await execAsync(`find /etc/NetworkManager/system-connections -type f -name '*${ssid}*.nmconnection' -exec rm -f {} +`);
            logger.info('Removed NM system-connections files for SSID', { ssid });
          }
          // Restart NetworkManager to flush caches
          try { await execAsync('systemctl restart NetworkManager'); } catch (_) {}
        } catch (e) {
          logger.debug('No NM system-connections files removed', { error: e.message });
        }
        
        // Proactively disconnect device
        try { await execAsync('nmcli device disconnect wlan0'); } catch (_) {}
      } catch (e) {
        logger.debug('nmcli not available or failed, falling back to wpa_supplicant');
      }

      // Also remove from wpa_supplicant (in case NM isn’t managing it)
      try {
        let config = '';
        try {
          config = await fs.readFile(WPA_SUPPLICANT_CONF, 'utf8');
        } catch (_) {}
        if (config) {
          let newConfig = '';
          if (forgetAll) {
            // Strip all network blocks
            newConfig = (config.split('\n')
              .filter(line => !line.trim().startsWith('network={'))
              .join('\n')).trim() + '\n';
            // Also remove lines until matching closing brace
            newConfig = newConfig.replace(/network=\{[\s\S]*?\}/g, '');
          } else {
            const ssidPattern = new RegExp(`network=\\{[^}]*ssid=\"${ssid}\"[^}]*\\}`, 'g');
            newConfig = config.replace(ssidPattern, '').trim() + '\n';
          }
          if (newConfig !== config) {
            const tempFile = '/tmp/wpa_supplicant_temp_forget.conf';
            await execAsync(`echo '${newConfig.replace(/'/g, "'\\''")}' | tee ${tempFile} > /dev/null`);
            await execAsync(`cp ${tempFile} ${WPA_SUPPLICANT_CONF}`);
            await execAsync(`chmod 600 ${WPA_SUPPLICANT_CONF}`);
            await this._restartWpaSupplicant();
            logger.info('Removed SSID from wpa_supplicant', { ssid });
          }
        }
      } catch (e) {
        logger.warn('Failed to update wpa_supplicant while forgetting network', { error: e.message });
      }

      return { success: true, message: forgetAll ? 'All Wi‑Fi profiles forgotten' : 'Network forgotten', ssid, forgetAll };
    } catch (error) {
      logger.error('Failed to forget network', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WiFiService();
