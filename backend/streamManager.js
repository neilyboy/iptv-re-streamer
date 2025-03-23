const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class StreamManager {
  constructor() {
    // Get configuration from environment variables
    this.outputPort = process.env.STREAMS_PORT || 8088;
    this.maxReconnectAttempts = parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '10');
    this.reconnectDelay = parseInt(process.env.RECONNECT_DELAY || '5') * 1000; // Convert to ms
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30') * 1000; // Convert to ms
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.hlsSegmentTime = parseInt(process.env.HLS_SEGMENT_TIME || '4'); // Segment length in seconds
    this.hlsListSize = parseInt(process.env.HLS_LIST_SIZE || '15'); // Number of segments to keep in playlist
    this.hlsDir = path.join(process.cwd(), 'data', 'hls');
    this.configPath = path.join(process.cwd(), 'data', 'streams.json');
    this.cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL || '60') * 60 * 1000; // Default: 60 minutes
    this.screenshotsDir = path.join(process.cwd(), 'data', 'screenshots');
    this.screenshotInterval = parseInt(process.env.SCREENSHOT_INTERVAL || '60') * 1000; // Default: 60 seconds
    this.maxBackoffDelay = parseInt(process.env.MAX_BACKOFF_DELAY || '60') * 1000; // Maximum backoff delay (default: 60 seconds)
    this.segmentHealthCheckInterval = parseInt(process.env.SEGMENT_HEALTH_CHECK_INTERVAL || '15') * 1000; // Default: 15 seconds
    this.maxSegmentAge = parseInt(process.env.MAX_SEGMENT_AGE || '3') * this.hlsSegmentTime * 1000; // Default: 3x segment time
    
    // Create HLS directory if it doesn't exist
    if (!fs.existsSync(this.hlsDir)) {
      fs.mkdirSync(this.hlsDir, { recursive: true });
    }
    
    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
    
    this.streams = {};
    this.processes = {};
    this.reconnectAttempts = {};
    this.reconnectTimers = {};
    this.screenshotTimers = {};
    this.segmentHealthChecks = {};
    this.monitors = {}; // Add monitors object to track monitoring intervals
    
    // Initialize
    this.initialize();
    
    // Start health check
    this.startHealthCheck();
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    this.log('info', 'Stream Manager initialized');
  }

  initialize() {
    // Load existing configuration
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        
        if (config && config.streams) {
          this.streams = config.streams;
          this.log('info', `Loaded ${Object.keys(this.streams).length} streams from configuration`);
        }
      } else {
        this.log('info', 'No existing configuration found, starting with empty streams');
        this.saveConfig(); // Create initial empty config
      }
    } catch (error) {
      this.log('error', `Failed to load configuration: ${error.message}`);
      // Start with empty streams object
      this.streams = {};
    }
  }

  saveConfig() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(this.configPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Prepare config object
      const config = {
        streams: this.streams,
        updatedAt: new Date().toISOString()
      };
      
      // Write to file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.log('info', 'Configuration saved successfully');
      return true;
    } catch (error) {
      this.log('error', `Failed to save configuration: ${error.message}`);
      return false;
    }
  }

  exportConfig() {
    return {
      streams: this.streams
    };
  }

  importConfig(config, startStreams = true, append = false) {
    if (!append) {
      // Stop all existing streams if in overwrite mode
      this._stopAllStreams();
      
      // Clear existing streams if in overwrite mode
      this.streams = {};
    }

    // Import streams
    for (const id in config.streams) {
      // Skip if stream already exists and we're in append mode
      if (append && this.streams[id]) {
        this.log('info', `Skipping existing stream with ID ${id} in append mode`);
        continue;
      }
      
      const stream = config.streams[id];
      this.streams[id] = {
        id,
        name: stream.name,
        url: stream.url,
        status: 'stopped',
        health: 'unknown',
        stats: {
          uptime: 0,
          restarts: 0,
          lastError: null,
          lastRestart: null
        },
        errorHistory: [], // Add error history tracking
        diagnostics: {    // Add diagnostics object
          lastErrorType: null,
          errorCount: 0,
          networkErrors: 0,
          sourceErrors: 0,
          ffmpegErrors: 0,
          segmentGaps: 0,
          lastHealthCheck: null,
          healthCheckStatus: null
        },
        createdAt: stream.createdAt || new Date().toISOString(),
        // Handle screenshot-related fields
        screenshotPath: null,
        screenshotTimestamp: null
      };

      // Import stream info if available
      if (stream.streamInfo) {
        this.streams[id].streamInfo = stream.streamInfo;
      }

      // Import resolution check count if available
      if (stream.resolutionCheckCount !== undefined) {
        this.streams[id].resolutionCheckCount = stream.resolutionCheckCount;
      }

      if (startStreams) {
        this.startStream(id);
      }
    }

    this.saveConfig();
  }

  getStreams() {
    return Object.values(this.streams);
  }

  getStream(id) {
    return this.streams[id] || null;
  }

  addStream(name, url) {
    const id = uuidv4();
    const stream = {
      id,
      name,
      url,
      status: 'stopped',
      health: 'unknown',
      stats: {
        uptime: 0,
        restarts: 0,
        lastError: null,
        lastRestart: null
      },
      errorHistory: [], // Add error history tracking
      diagnostics: {    // Add diagnostics object
        lastErrorType: null,
        errorCount: 0,
        networkErrors: 0,
        sourceErrors: 0,
        ffmpegErrors: 0,
        segmentGaps: 0,
        lastHealthCheck: null,
        healthCheckStatus: null
      },
      createdAt: new Date().toISOString()
    };

    this.streams[id] = stream;
    this.saveConfig();
    return stream;
  }

  updateStream(id, { name, url }) {
    if (!this.streams[id]) {
      return null;
    }

    // Stop stream if running
    const wasRunning = this.streams[id].status === 'running';
    if (wasRunning) {
      this.stopStream(id);
    }

    // Update stream details
    this.streams[id].name = name;
    this.streams[id].url = url;
    this.streams[id].updatedAt = new Date().toISOString();

    // Restart if it was running
    if (wasRunning) {
      this.startStream(id);
    }

    this.saveConfig();
    return this.streams[id];
  }

  removeStream(id) {
    if (!this.streams[id]) {
      return false;
    }

    // Stop stream if running
    this.stopStream(id);

    // Remove stream
    delete this.streams[id];
    this.saveConfig();
    return true;
  }

  deleteStream(id) {
    if (!this.streams[id]) {
      return false;
    }

    // Stop the stream if it's running
    if (this.streams[id].status === 'running') {
      this.stopStream(id);
    }

    // Delete HLS directory
    const hlsPath = path.join(this.hlsDir, id);
    if (fs.existsSync(hlsPath)) {
      try {
        fs.rm(hlsPath, { recursive: true, force: true }, (err) => {
          if (err) {
            this.log('error', `Error deleting HLS directory for stream ${id}: ${err.message}`);
          }
        });
      } catch (error) {
        this.log('error', `Error deleting HLS directory for stream ${id}: ${error.message}`);
      }
    }

    // Delete screenshot file
    const screenshotPath = path.join(this.screenshotsDir, `${id}.jpg`);
    if (fs.existsSync(screenshotPath)) {
      try {
        fs.unlinkSync(screenshotPath);
      } catch (error) {
        this.log('error', `Error deleting screenshot for stream ${id}: ${error.message}`);
      }
    }

    // Clear any timers
    this._clearScreenshotTimer(id);
    this._clearSegmentHealthCheck(id);
    this._clearMonitoring(id);

    // Delete stream from streams object
    delete this.streams[id];
    
    // Delete process reference if it exists
    if (this.processes[id]) {
      delete this.processes[id];
    }

    this.log('info', `Stream ${id} deleted with all associated files`);
    this.saveConfig();
    return true;
  }

  startStream(id) {
    const stream = this.streams[id];
    if (!stream) {
      return Promise.resolve(false);
    }

    // Check if stream is already running
    if (stream.status === 'running') {
      this.log('info', `Stream ${id} is already running`);
      return Promise.resolve(true);
    }

    // Set stream as starting
    stream.status = 'starting';
    this.saveConfig();

    // Create HLS directory if it doesn't exist
    const hlsPath = path.join(this.hlsDir, id);
    if (!fs.existsSync(hlsPath)) {
      fs.mkdirSync(hlsPath, { recursive: true });
    }

    // Store HLS path in stream object
    stream.hlsPath = hlsPath;

    // Reset reconnect attempts
    this.reconnectAttempts[id] = 0;

    // Clear any existing reconnect timer
    if (this.reconnectTimers[id]) {
      clearTimeout(this.reconnectTimers[id]);
      delete this.reconnectTimers[id];
    }

    // Initialize diagnostics if not already done
    if (!stream.diagnostics) {
      stream.diagnostics = {
        errors: [],
        lastError: null,
        lastErrorTime: null,
        healthCheckStatus: 'Unknown',
        segmentCount: 0,
        sourceAvailable: null,
        sourceCheckInProgress: false,
        sourceCheckResult: null,
        sourceCheckError: null,
        reconnectAttempt: 0,
        maxReconnectAttempts: this.maxReconnectAttempts
      };
    }

    // Return a Promise that resolves when the stream is started
    return new Promise((resolve) => {
      // Analyze HLS playlist to select the highest quality variant
      this.analyzeHlsPlaylist(stream.url).then((selectedUrl) => {
        if (selectedUrl) {
          stream.url = selectedUrl;
          // Store the selected resolution
          if (this.selectedVariantInfo && this.selectedVariantInfo.resolution) {
            stream.selectedResolution = this.selectedVariantInfo.resolution;
            
            // Initialize streamInfo if it doesn't exist
            if (!stream.streamInfo) {
              stream.streamInfo = {};
            }
            
            const resolution = this.selectedVariantInfo.resolution;
            const height = parseInt(resolution.split('x')[1]);
            
            // Convert to standard format (e.g., 720p)
            let formattedResolution;
            if (height >= 1080) formattedResolution = "1080p";
            else if (height >= 720) formattedResolution = "720p";
            else if (height >= 480) formattedResolution = "480p";
            else if (height >= 360) formattedResolution = "360p";
            else formattedResolution = `${height}p`;
            
            stream.streamInfo.resolution = formattedResolution;
            this.log('info', `[${stream.name}] Selected resolution: ${formattedResolution} (${resolution})`);
            this.saveConfig();
          }
        }
        
        // Build FFmpeg command with improved HLS settings
        const ffmpegArgs = [
          // Add protocol options to select the highest bandwidth variant
          '-protocol_whitelist', 'file,http,https,tcp,tls',
          // Use user_agent to mimic a browser
          '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          '-i', stream.url,
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-f', 'hls',
          '-hls_time', '2',
          '-hls_list_size', '10',
          // Use delete_segments flag
          '-hls_flags', 'delete_segments',
          '-hls_segment_filename', path.join(hlsPath, 'segment_%03d.ts'),
          path.join(hlsPath, 'playlist.m3u8')
        ];

        this.log('info', `Starting stream ${id} with command: ffmpeg ${ffmpegArgs.join(' ')}`);

        try {
          // Start FFmpeg process
          const process = spawn('ffmpeg', ffmpegArgs, {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe']
          });

          // Store process reference
          this.processes[id] = process;

          // Set stream as running
          stream.status = 'running';
          
          // Start monitoring
          this._setupMonitoring(id);
          
          // Start screenshot timer
          if (typeof this.startScreenshotTimer === 'function') {
            this.startScreenshotTimer(id);
          } else {
            this.log('warn', `Screenshot timer function not available for stream ${id}`);
          }
          
          // Start segment health check
          this.startSegmentHealthCheck(id);

          // Handle process exit
          process.on('exit', (code, signal) => {
            this.log('warn', `Stream ${id} process exited with code ${code} and signal ${signal}`);
            
            // Only handle if the stream is still in our list and marked as running
            if (this.streams[id] && this.streams[id].status === 'running') {
              // Record error
              this._recordError(id, 'ffmpeg', `Process exited with code ${code} and signal ${signal}`);
              
              // Mark as stopped
              this.streams[id].status = 'error';
              
              // Clean up process reference
              delete this.processes[id];
              
              // Handle reconnection if needed
              this.handleReconnect(id);
            }
          });

          // Log stderr output
          process.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output.includes('Error') || output.includes('error') || output.includes('failed')) {
              this.log('error', `[${stream.name}] FFmpeg error: ${output}`);
              // Record specific FFmpeg errors
              if (output.includes('Connection refused') || output.includes('Connection reset')) {
                this._recordError(id, 'network', `Connection error: ${output.substring(0, 100)}`);
              } else if (output.includes('404') || output.includes('403')) {
                this._recordError(id, 'source', `Source error: ${output.substring(0, 100)}`);
              } else if (output.includes('Invalid data') || output.includes('Error while decoding')) {
                this._recordError(id, 'format', `Format error: ${output.substring(0, 100)}`);
              } else {
                this._recordError(id, 'ffmpeg', `FFmpeg error: ${output.substring(0, 100)}`);
              }
            }
          });

          // Force a health check after a short delay to update initial status
          setTimeout(() => {
            this.checkStreamSegmentHealth(id);
          }, 5000);

          // Check for stream resolution after a short delay
          setTimeout(() => {
            const resolution = this._analyzeStreamResolution(id);
            if (resolution) {
              if (!this.streams[id].streamInfo) {
                this.streams[id].streamInfo = {};
              }
              this.streams[id].streamInfo.resolution = resolution;
              this.log('info', `[${this.streams[id].name}] Detected resolution: ${resolution}`);
              this.saveConfig();
            }
            
            // Analyze detailed stream information
            setTimeout(() => {
              this.analyzeHlsStreamInfo(id);
            }, 5000);
          }, 10000);

          this.saveConfig();
          resolve(true);
        } catch (error) {
          this.log('error', `Failed to start stream ${id}: ${error.message}`);
          stream.status = 'error';
          this._recordError(id, 'system', `Failed to start: ${error.message}`);
          this.saveConfig();
          resolve(false);
        }
      }).catch(error => {
        this.log('error', `Failed to analyze HLS playlist for stream ${id}: ${error.message}`);
        stream.status = 'error';
        this._recordError(id, 'system', `Failed to analyze HLS playlist: ${error.message}`);
        this.saveConfig();
        resolve(false);
      });
    });
  }

  stopStream(id) {
    if (!this.streams[id]) {
      return false;
    }

    // If already stopped, don't stop again
    if (this.streams[id].status === 'stopped') {
      return true;
    }

    try {
      // Kill FFmpeg process
      if (this.processes[id]) {
        this.processes[id].kill('SIGTERM');
        delete this.processes[id];
      }

      // Clear reconnect timer
      if (this.reconnectTimers[id]) {
        clearTimeout(this.reconnectTimers[id]);
        delete this.reconnectTimers[id];
      }
      
      // Clear screenshot timer
      this._clearScreenshotTimer(id);
      
      // Clear segment health check
      this._clearSegmentHealthCheck(id);
      
      // Clear monitoring
      this._clearMonitoring(id);

      // Update stream status
      this.streams[id].status = 'stopped';
      this.streams[id].health = 'unknown';
      this.saveConfig();
      return true;
    } catch (error) {
      this.log('error', `Failed to stop stream ${id}: ${error.message}`);
      return false;
    }
  }

  restartStream(id) {
    if (!this.streams[id]) {
      return false;
    }

    const success = this.stopStream(id);
    if (!success) {
      return false;
    }

    // Reset restart counter on manual restart
    if (this.streams[id]) {
      this.streams[id].stats.restarts = 0;
    }

    // Small delay to ensure process is fully stopped
    setTimeout(() => {
      this.startStream(id);
    }, 1000);

    return true;
  }

  getHealthStatus() {
    const statuses = {
      running: 0,
      stopped: 0,
      error: 0,
      health: {
        good: 0,
        degraded: 0,
        failed: 0,
        unknown: 0
      }
    };

    for (const id in this.streams) {
      const stream = this.streams[id];
      if (stream.status === 'running') {
        statuses.running++;
      } else if (stream.status === 'stopped') {
        statuses.stopped++;
      } else if (stream.status === 'error') {
        statuses.error++;
      }
      
      if (stream.health === 'good') {
        statuses.health.good++;
      } else if (stream.health === 'degraded') {
        statuses.health.degraded++;
      } else if (stream.health === 'failed') {
        statuses.health.failed++;
      } else {
        statuses.health.unknown++;
      }
    }

    return statuses;
  }

  _setupMonitoring(id) {
    // Clear any existing monitoring
    this._clearMonitoring(id);
    
    // Set up monitoring interval to track uptime and check stream health
    this.monitors[id] = {
      uptimeInterval: setInterval(() => {
        if (this.streams[id] && this.streams[id].status === 'running') {
          // Update uptime counter (in seconds)
          if (!this.streams[id].stats.uptime) {
            this.streams[id].stats.uptime = 0;
          }
          this.streams[id].stats.uptime += 1;
          
          // Save config periodically (every 5 minutes) to persist uptime
          if (this.streams[id].stats.uptime % 300 === 0) {
            this.saveConfig();
          }
        }
      }, 1000) // Update every second
    };
    
    this.log('info', `Set up monitoring for stream ${id}`);
  }
  
  _clearMonitoring(id) {
    if (this.monitors[id]) {
      if (this.monitors[id].uptimeInterval) {
        clearInterval(this.monitors[id].uptimeInterval);
      }
      delete this.monitors[id];
      this.log('info', `Cleared monitoring for stream ${id}`);
    }
  }

  _stopAllStreams() {
    for (const id in this.streams) {
      if (this.streams[id].status === 'running') {
        this.stopStream(id);
      }
    }
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    // Make sure we use a valid console method
    const validLevels = ['log', 'info', 'warn', 'error', 'debug'];
    const logMethod = validLevels.includes(level) ? level : 'log';
    console[logMethod](`[${timestamp}] [StreamManager] ${message}`);
  }

  shutdown() {
    this._stopAllStreams();
    
    // Clear intervals
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
  }

  startHealthCheck() {
    // Start health check interval
    this.healthCheckIntervalId = setInterval(() => {
      const healthStatus = this.getHealthStatus();
      this.log('info', `Health check: ${healthStatus.running} running, ${healthStatus.stopped} stopped, ${healthStatus.error} error`);
      
      // Periodically update resolution for running streams
      for (const id in this.streams) {
        const stream = this.streams[id];
        if (stream.status === 'running') {
          // Update resolution every 5 health checks (to avoid too frequent checks)
          if (!stream.resolutionCheckCount) {
            stream.resolutionCheckCount = 0;
          }
          
          stream.resolutionCheckCount++;
          if (stream.resolutionCheckCount >= 5) {
            stream.resolutionCheckCount = 0;
            this._analyzeStreamResolution(id);
          }
          
          // Check if we need to test the source URL
          if (stream.health === 'degraded' && stream.diagnostics && 
              stream.diagnostics.lastErrorType === 'network' && 
              (!stream.diagnostics.lastSourceCheck || 
               (new Date() - new Date(stream.diagnostics.lastSourceCheck)) > 60000)) {
            this.testSourceUrl(id);
          }
        }
      }
    }, this.healthCheckInterval);
  }

  startCleanupInterval() {
    // Start a periodic cleanup to remove stale HLS segments and directories
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupHlsDirectories();
      this.cleanupScreenshots();
      this.cleanupOrphanedFiles();
    }, this.cleanupInterval);
    
    this.log('info', `Scheduled cleanup every ${this.cleanupInterval / (60 * 1000)} minutes`);
  }
  
  cleanupHlsDirectories() {
    try {
      this.log('info', 'Starting HLS directory cleanup');
      
      // Get all directories in the HLS directory
      const hlsDirs = fs.readdirSync(this.hlsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      let cleanedCount = 0;
      let skippedCount = 0;
      
      // Check each directory
      for (const dir of hlsDirs) {
        const streamId = dir;
        const streamDir = path.join(this.hlsDir, dir);
        
        // If this is a stream that doesn't exist or is stopped, clean up old segments
        if (!this.streams[streamId] || this.streams[streamId].status !== 'running') {
          try {
            // Get all .ts files in the directory
            const tsFiles = fs.readdirSync(streamDir)
              .filter(file => file.endsWith('.ts'));
            
            // If there are more than hlsListSize segments, delete the oldest ones
            if (tsFiles.length > this.hlsListSize) {
              // Sort files by name (which should correspond to sequence)
              tsFiles.sort();
              
              // Keep only the newest hlsListSize files
              const filesToDelete = tsFiles.slice(0, tsFiles.length - this.hlsListSize);
              
              for (const file of filesToDelete) {
                fs.unlinkSync(path.join(streamDir, file));
              }
              
              this.log('info', `Cleaned up ${filesToDelete.length} old segments from ${streamId}`);
              cleanedCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            this.log('error', `Error cleaning up HLS directory ${streamId}: ${error.message}`);
          }
        } else {
          // Stream is running, skip it
          skippedCount++;
        }
      }
      
      this.log('info', `HLS cleanup completed: cleaned ${cleanedCount} directories, skipped ${skippedCount} directories`);
    } catch (error) {
      this.log('error', `Error during HLS cleanup: ${error.message}`);
    }
  }

  cleanupScreenshots() {
    try {
      this.log('info', 'Starting screenshots cleanup');
      
      // Get all files in the screenshots directory
      const screenshotFiles = fs.readdirSync(this.screenshotsDir, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jpg'))
        .map(dirent => dirent.name);
      
      let removedCount = 0;
      let keptCount = 0;
      
      // Check each screenshot file
      for (const file of screenshotFiles) {
        // Extract stream ID from filename (assuming format: streamId.jpg)
        const streamId = file.replace('.jpg', '');
        
        // If this is a screenshot for a stream that doesn't exist, remove it
        if (!this.streams[streamId]) {
          try {
            fs.unlinkSync(path.join(this.screenshotsDir, file));
            this.log('info', `Removed orphaned screenshot for non-existent stream: ${streamId}`);
            removedCount++;
          } catch (error) {
            this.log('error', `Error removing orphaned screenshot ${file}: ${error.message}`);
          }
        } else {
          keptCount++;
        }
      }
      
      this.log('info', `Screenshots cleanup completed: removed ${removedCount} orphaned screenshots, kept ${keptCount} valid screenshots`);
    } catch (error) {
      this.log('error', `Error during screenshots cleanup: ${error.message}`);
    }
  }

  cleanupOrphanedFiles() {
    this.log('info', 'Starting periodic cleanup of orphaned files');
    
    try {
      // Get list of all stream IDs
      const streamIds = Object.keys(this.streams);
      
      // Clean up orphaned HLS directories
      if (fs.existsSync(this.hlsDir)) {
        const hlsDirs = fs.readdirSync(this.hlsDir);
        for (const dir of hlsDirs) {
          if (!streamIds.includes(dir)) {
            const dirPath = path.join(this.hlsDir, dir);
            this.log('info', `Removing orphaned HLS directory: ${dirPath}`);
            fs.rm(dirPath, { recursive: true, force: true }, (err) => {
              if (err) {
                this.log('error', `Error removing orphaned HLS directory ${dirPath}: ${err.message}`);
              }
            });
          }
        }
      }
      
      // Clean up orphaned screenshot files
      if (fs.existsSync(this.screenshotsDir)) {
        const screenshotFiles = fs.readdirSync(this.screenshotsDir);
        for (const file of screenshotFiles) {
          // Extract stream ID from filename (remove .jpg extension)
          const fileId = file.replace('.jpg', '');
          if (!streamIds.includes(fileId)) {
            const filePath = path.join(this.screenshotsDir, file);
            this.log('info', `Removing orphaned screenshot file: ${filePath}`);
            fs.unlinkSync(filePath);
          }
        }
      }
      
      this.log('info', 'Periodic cleanup completed');
    } catch (error) {
      this.log('error', `Error during periodic cleanup: ${error.message}`);
    }
  }

  handleReconnect(id) {
    const stream = this.streams[id];
    if (!stream) {
      return;
    }

    // Initialize reconnect attempts if not already set
    if (this.reconnectAttempts[id] === undefined) {
      this.reconnectAttempts[id] = 0;
    }

    // Check if reconnect attempts have exceeded the maximum
    if (this.reconnectAttempts[id] >= this.maxReconnectAttempts) {
      this.log('error', `Stream ${id} failed to reconnect after ${this.maxReconnectAttempts} attempts, giving up`);
      this.streams[id].status = 'error';
      this.streams[id].health = 'failed';
      this.streams[id].diagnostics.healthCheckStatus = 'max_reconnect_exceeded';
      this.saveConfig();
      return;
    }

    // Calculate delay with exponential backoff (with a maximum delay cap)
    const attempt = this.reconnectAttempts[id];
    const baseDelay = this.reconnectDelay;
    const delay = Math.min(baseDelay * Math.pow(1.5, attempt), this.maxBackoffDelay);
    
    this.log('info', `Scheduling reconnect for stream ${id}, attempt ${attempt+1}/${this.maxReconnectAttempts} in ${delay/1000}s`);
    
    // Update diagnostics
    if (this.streams[id]) {
      this.streams[id].diagnostics.nextReconnectTime = new Date(Date.now() + delay).toISOString();
      this.streams[id].diagnostics.reconnectAttempt = attempt + 1;
      this.streams[id].diagnostics.maxReconnectAttempts = this.maxReconnectAttempts;
      this.saveConfig();
    }

    // Schedule reconnect
    this.reconnectAttempts[id]++;
    this.reconnectTimers[id] = setTimeout(() => {
      // Before reconnecting, test if the source is available
      this.testSourceUrl(id).then(isValid => {
        if (isValid) {
          this.startStream(id);
        } else {
          // Source is still unavailable, try again later
          this.log('warning', `Source URL for stream ${id} is still unavailable, continuing reconnect cycle`);
          this.handleReconnect(id);
        }
      });
    }, delay);
  }

  handleProcessExit(id, code, signal) {
    // Clear process reference
    delete this.processes[id];
    
    // Clear screenshot timer
    this._clearScreenshotTimer(id);
    
    // Clear segment health check
    this._clearSegmentHealthCheck(id);
    
    if (!this.streams[id]) {
      return;
    }
    
    this.log('info', `Stream ${id} process exited with code ${code}, signal ${signal}`);
    
    // Update stream status
    this.streams[id].status = 'stopped';
    
    // If the exit was not clean (non-zero exit code or signal), attempt to reconnect
    if (code !== 0 || signal) {
      this.streams[id].health = 'degraded';
      const errorMessage = `Process exited with code ${code}, signal ${signal}`;
      this.streams[id].stats.lastError = errorMessage;
      
      // Track error in diagnostics
      let errorType = 'ffmpeg';
      if (signal === 'SIGKILL') {
        errorType = 'system';
      }
      this.trackStreamError(id, errorType, errorMessage);
      
      this.saveConfig();
      
      // Attempt to reconnect
      this.handleReconnect(id);
    } else {
      // Clean exit
      this.streams[id].health = 'unknown';
      this.saveConfig();
    }
  }

  // New methods for enhanced reliability

  // Track stream errors with categorization
  trackStreamError(id, errorType, message) {
    if (!this.streams[id]) return;
    
    // Initialize error tracking if not already done
    if (!this.streams[id].errors) {
      this.streams[id].errors = {
        total: 0,
        byType: {},
        recent: []
      };
    }
    
    // Initialize diagnostics if not already done
    if (!this.streams[id].diagnostics) {
      this.streams[id].diagnostics = {
        lastErrorType: null,
        errorCount: 0,
        networkErrors: 0,
        sourceErrors: 0,
        ffmpegErrors: 0,
        systemErrors: 0,
        segmentGaps: 0,
        lastHealthCheck: null,
        healthCheckStatus: null
      };
    }
    
    // Add error to history
    this.streams[id].errors.recent.push({
      timestamp: new Date().toISOString(),
      type: errorType,
      message: message.substring(0, 500) // Limit message length
    });
    
    // Keep only the last 10 errors
    if (this.streams[id].errors.recent.length > 10) {
      this.streams[id].errors.recent = this.streams[id].errors.recent.slice(-10);
    }
    
    // Update diagnostics
    this.streams[id].diagnostics.lastErrorType = errorType;
    this.streams[id].diagnostics.errorCount++;
    
    // Update specific error counters
    switch (errorType) {
      case 'network':
        this.streams[id].diagnostics.networkErrors++;
        break;
      case 'source':
        this.streams[id].diagnostics.sourceErrors++;
        break;
      case 'ffmpeg':
        this.streams[id].diagnostics.ffmpegErrors++;
        break;
      case 'system':
        this.streams[id].diagnostics.systemErrors++;
        break;
    }
    
    // Update last error
    this.streams[id].stats.lastError = `[${errorType}] ${message.substring(0, 200)}`;
    
    // Analyze error patterns
    this.analyzeErrorPatterns(id);
    
    // Log the error
    this.log('warn', `[${this.streams[id].name}] ${errorType} error: ${message}`);
    
    this.saveConfig();
  }

  // Update stream health status based on errors
  _updateStreamHealth(id, health) {
    if (!this.streams[id]) return;
    
    // If health is explicitly provided, use it
    if (health) {
      this.streams[id].health = health;
      return;
    }
    
    // Calculate health based on diagnostics and errors
    const stream = this.streams[id];
    const diagnostics = stream.diagnostics || {};
    const errors = stream.errors || { recent: [] };
    
    // Get recent errors (last 5 minutes)
    const recentErrors = errors.recent.filter(err => {
      const errTime = new Date(err.timestamp).getTime();
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return errTime > fiveMinutesAgo;
    });
    
    // Calculate health based on error frequency and types
    if (stream.status !== 'running') {
      // If stream is not running, health is based on last known state
      this.streams[id].health = stream.health === 'unknown' ? 'good' : stream.health;
    } else if (recentErrors.length === 0) {
      // No recent errors = good health
      this.streams[id].health = 'good';
    } else if (recentErrors.length <= 2) {
      // 1-2 recent errors = degraded
      this.streams[id].health = 'degraded';
    } else {
      // More than 2 recent errors = poor
      this.streams[id].health = 'poor';
    }
    
    // Log health update
    this.log('info', `[${this.streams[id].name}] Stream health updated to ${this.streams[id].health}`);
  }

  // Analyze error patterns to update stream health
  analyzeErrorPatterns(id) {
    if (!this.streams[id]) return;
    
    // Update stream health based on error patterns
    this._updateStreamHealth(id);
    
    // Additional analysis can be added here
    const stream = this.streams[id];
    const diagnostics = stream.diagnostics || {};
    
    // Check if we need to update the health check timestamp
    if (!diagnostics.lastHealthCheck || 
        (new Date() - new Date(diagnostics.lastHealthCheck)) > (60 * 1000)) {
      // Update health check timestamp
      if (!this.streams[id].diagnostics) {
        this.streams[id].diagnostics = {};
      }
      this.streams[id].diagnostics.lastHealthCheck = new Date().toISOString();
      
      // Perform additional health checks if needed
      if (stream.status === 'running') {
        // Check if we need to analyze the stream
        this.analyzeHlsStreamInfo(id).catch(err => {
          this.log('error', `[${stream.name}] Error during health check analysis: ${err.message}`);
        });
      }
    }
  }

  // Get detailed diagnostics for a stream
  getStreamDiagnostics(id) {
    const stream = this.streams[id];
    if (!stream) {
      return null;
    }

    // Initialize diagnostics if not already done
    if (!stream.diagnostics) {
      stream.diagnostics = {
        lastHealthCheck: null,
        segmentCount: 0,
        healthCheckStatus: 'Unknown'
      };
    }
    
    // Initialize errors if not already done
    if (!stream.errors) {
      stream.errors = {
        total: 0,
        byType: {},
        recent: []
      };
    }

    // Collect all diagnostic information
    return {
      id: id,
      name: stream.name,
      status: stream.status,
      health: stream.health || 'unknown',
      uptime: stream.stats?.uptime || 0,
      lastRestart: stream.stats?.lastRestart || null,
      
      // Stream details
      source: stream.url,
      sourceStatus: stream.sourceStatus || 'unknown',
      sourceLastChecked: stream.sourceLastChecked || null,
      
      // Segment information
      segmentCount: stream.diagnostics.segmentCount || 0,
      healthCheckStatus: stream.diagnostics.healthCheckStatus || 'Unknown',
      lastHealthCheck: stream.diagnostics.lastHealthCheck || null,
      latestSegment: stream.diagnostics.latestSegment || null,
      latestSegmentAge: stream.diagnostics.latestSegmentAge || null,
      
      // Error statistics
      errors: {
        total: stream.errors.total || 0,
        byType: stream.errors.byType || {},
        recent: stream.errors.recent || []
      },
      
      // Reconnection information
      reconnection: {
        attempts: stream.reconnection?.attempts || 0,
        nextAttempt: stream.reconnection?.nextAttempt || null,
        backoffDelay: stream.reconnection?.currentBackoff || 0
      },
      
      // Stream information
      streamInfo: stream.streamInfo || {}
    };
  }

  // Take a screenshot of the stream
  takeScreenshot(id) {
    if (!this.streams[id] || this.streams[id].status !== 'running') {
      return false;
    }

    const screenshotPath = path.join(this.screenshotsDir, `${id}.jpg`);
    
    try {
      const ffmpegArgs = [
        '-i', this.streams[id].url,
        '-ss', '00:00:01', // Skip to 1 second to avoid black frames
        '-vframes', '1',
        '-q:v', '2', // High quality
        '-y', // Overwrite existing file
        screenshotPath
      ];

      const result = spawnSync('ffmpeg', ffmpegArgs, { timeout: 10000 });
      
      if (result.status === 0) {
        this.log('info', `[${this.streams[id].name}] Screenshot taken successfully`);
        return true;
      } else {
        this.log('error', `[${this.streams[id].name}] Failed to take screenshot: ${result.stderr.toString()}`);
        return false;
      }
    } catch (error) {
      this.log('error', `[${this.streams[id].name}] Error taking screenshot: ${error.message}`);
      return false;
    }
  }

  // Analyze HLS stream to extract detailed information
  analyzeHlsStreamInfo(id) {
    return new Promise((resolve, reject) => {
      if (!this.streams[id]) {
        this.log('error', `Cannot analyze stream ${id}: Stream not found`);
        return resolve(false);
      }
      
      if (this.streams[id].status !== 'running') {
        this.log('warn', `Cannot analyze stream ${id}: Stream is not running (status: ${this.streams[id].status})`);
        return resolve(false);
      }

      // Initialize streamInfo if it doesn't exist
      if (!this.streams[id].streamInfo) {
        this.streams[id].streamInfo = {};
      }

      const hlsPath = this.streams[id].hlsPath;
      if (!hlsPath || !fs.existsSync(hlsPath)) {
        this.log('warn', `[${this.streams[id].name}] HLS path not found for stream analysis: ${hlsPath}`);
        return resolve(false);
      }

      try {
        this.log('info', `[${this.streams[id].name}] Starting stream analysis`);
        
        // First try to extract information from the playlist
        const playlistPath = path.join(hlsPath, 'playlist.m3u8');
        if (fs.existsSync(playlistPath)) {
          this.log('info', `[${this.streams[id].name}] Analyzing playlist: ${playlistPath}`);
          const content = fs.readFileSync(playlistPath, 'utf8');
          
          // Extract bitrate from the playlist
          const bandwidthMatch = content.match(/#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);
          if (bandwidthMatch && bandwidthMatch[1]) {
            const bitrate = parseInt(bandwidthMatch[1]);
            this.streams[id].streamInfo.bitrate = bitrate;
            this.log('info', `[${this.streams[id].name}] Detected bitrate from playlist: ${bitrate} bps`);
          }
          
          // Extract codec information if available
          const codecMatch = content.match(/#EXT-X-STREAM-INF:.*CODECS="([^"]+)"/);
          if (codecMatch && codecMatch[1]) {
            const codecs = codecMatch[1].split(',');
            
            // Usually the first codec is video, second is audio
            if (codecs.length >= 1) {
              this.streams[id].streamInfo.videoCodec = codecs[0].trim();
              this.log('info', `[${this.streams[id].name}] Detected video codec from playlist: ${codecs[0].trim()}`);
            }
            
            if (codecs.length >= 2) {
              this.streams[id].streamInfo.audioCodec = codecs[1].trim();
              this.log('info', `[${this.streams[id].name}] Detected audio codec from playlist: ${codecs[1].trim()}`);
            }
          }
        } else {
          this.log('warn', `[${this.streams[id].name}] Playlist file not found: ${playlistPath}`);
        }
        
        // If we couldn't get all info from the playlist, use ffprobe to analyze a segment
        if (!this.streams[id].streamInfo.videoCodec || 
            !this.streams[id].streamInfo.audioCodec || 
            !this.streams[id].streamInfo.bitrate) {
          
          this.log('info', `[${this.streams[id].name}] Missing stream info, analyzing segments with ffprobe`);
          
          try {
            // Find the latest segment file
            const segmentFiles = fs.readdirSync(hlsPath)
              .filter(file => file.endsWith('.ts'))
              .map(file => ({
                name: file,
                time: fs.statSync(path.join(hlsPath, file)).mtime.getTime()
              }))
              .sort((a, b) => b.time - a.time);
            
            if (segmentFiles.length > 0) {
              const latestSegment = path.join(hlsPath, segmentFiles[0].name);
              this.log('info', `[${this.streams[id].name}] Analyzing latest segment: ${latestSegment}`);
              
              // Use ffprobe to get detailed stream information
              const ffprobeArgs = [
                '-v', 'error',
                '-show_entries', 'stream=codec_name,codec_type,width,height,bit_rate,avg_frame_rate',
                '-of', 'json',
                latestSegment
              ];
              
              try {
                const result = spawnSync('ffprobe', ffprobeArgs, { encoding: 'utf8', timeout: 10000 });
                
                if (result && result.status === 0 && result.stdout) {
                  try {
                    const probeData = JSON.parse(result.stdout);
                    
                    if (probeData.streams && probeData.streams.length > 0) {
                      this.log('info', `[${this.streams[id].name}] Successfully parsed ffprobe data with ${probeData.streams.length} streams`);
                      
                      // Process video stream
                      const videoStream = probeData.streams.find(stream => stream.codec_type === 'video');
                      if (videoStream) {
                        this.log('info', `[${this.streams[id].name}] Found video stream in ffprobe data`);
                        
                        // Video codec
                        if (videoStream.codec_name) {
                          this.streams[id].streamInfo.videoCodec = videoStream.codec_name.toUpperCase();
                          this.log('info', `[${this.streams[id].name}] Detected video codec: ${this.streams[id].streamInfo.videoCodec}`);
                        }
                        
                        // Resolution
                        if (videoStream.width && videoStream.height) {
                          const resolution = `${videoStream.width}x${videoStream.height}`;
                          const height = videoStream.height;
                          
                          // Convert to standard format (e.g., 720p)
                          let formattedResolution;
                          if (height >= 1080) formattedResolution = "1080p";
                          else if (height >= 720) formattedResolution = "720p";
                          else if (height >= 480) formattedResolution = "480p";
                          else if (height >= 360) formattedResolution = "360p";
                          else formattedResolution = `${height}p`;
                          
                          this.streams[id].streamInfo.resolution = formattedResolution;
                          this.streams[id].streamInfo.rawResolution = resolution;
                          this.log('info', `[${this.streams[id].name}] Detected resolution: ${formattedResolution} (${resolution})`);
                        }
                        
                        // Bitrate
                        if (videoStream.bit_rate) {
                          this.streams[id].streamInfo.bitrate = parseInt(videoStream.bit_rate);
                          this.log('info', `[${this.streams[id].name}] Detected video bitrate: ${this.streams[id].streamInfo.bitrate} bps`);
                        }
                        
                        // Frame rate
                        if (videoStream.avg_frame_rate) {
                          const fpsMatch = videoStream.avg_frame_rate.match(/(\d+)\/(\d+)/);
                          if (fpsMatch) {
                            const fps = Math.round((parseInt(fpsMatch[1]) / parseInt(fpsMatch[2])) * 100) / 100;
                            this.streams[id].streamInfo.fps = fps;
                            this.log('info', `[${this.streams[id].name}] Detected frame rate: ${fps} fps`);
                          } else if (videoStream.avg_frame_rate.match(/^\d+$/)) {
                            this.streams[id].streamInfo.fps = parseInt(videoStream.avg_frame_rate);
                            this.log('info', `[${this.streams[id].name}] Detected frame rate: ${this.streams[id].streamInfo.fps} fps`);
                          }
                        }
                      } else {
                        this.log('warn', `[${this.streams[id].name}] No video stream found in ffprobe data`);
                      }
                      
                      // Process audio stream
                      const audioStream = probeData.streams.find(stream => stream.codec_type === 'audio');
                      if (audioStream) {
                        this.log('info', `[${this.streams[id].name}] Found audio stream in ffprobe data`);
                        
                        if (audioStream.codec_name) {
                          this.streams[id].streamInfo.audioCodec = audioStream.codec_name.toUpperCase();
                          this.log('info', `[${this.streams[id].name}] Detected audio codec: ${this.streams[id].streamInfo.audioCodec}`);
                        }
                        
                        if (audioStream.bit_rate) {
                          this.streams[id].streamInfo.audioBitrate = parseInt(audioStream.bit_rate);
                          this.log('info', `[${this.streams[id].name}] Detected audio bitrate: ${this.streams[id].streamInfo.audioBitrate} bps`);
                        }
                      } else {
                        this.log('warn', `[${this.streams[id].name}] No audio stream found in ffprobe data`);
                      }
                    } else {
                      this.log('warn', `[${this.streams[id].name}] No streams found in ffprobe data`);
                    }
                  } catch (parseError) {
                    this.log('error', `[${this.streams[id].name}] Error parsing ffprobe output: ${parseError.message}`);
                  }
                } else if (result) {
                  this.log('warn', `[${this.streams[id].name}] ffprobe returned non-zero status: ${result.status}`);
                  if (result.stderr) {
                    this.log('warn', `[${this.streams[id].name}] ffprobe error: ${result.stderr}`);
                  }
                }
              } catch (ffprobeError) {
                this.log('error', `[${this.streams[id].name}] Error running ffprobe: ${ffprobeError.message}`);
                
                // If ffprobe fails, try to estimate from segment size as fallback
                this._estimateBitrateFromSegments(id, hlsPath, segmentFiles);
              }
            } else {
              this.log('warn', `[${this.streams[id].name}] No segment files found in ${hlsPath}`);
            }
          } catch (segmentError) {
            this.log('error', `[${this.streams[id].name}] Error analyzing segments: ${segmentError.message}`);
          }
        }
        
        // If we still don't have bitrate information, estimate it from segment sizes
        if (!this.streams[id].streamInfo.bitrate) {
          this.log('info', `[${this.streams[id].name}] No bitrate detected, estimating from segments`);
          this._estimateBitrateFromSegments(id, hlsPath);
        }
        
        // Ensure we have at least some basic information
        if (!this.streams[id].streamInfo.videoCodec) {
          this.streams[id].streamInfo.videoCodec = 'UNKNOWN';
        }
        
        if (!this.streams[id].streamInfo.resolution) {
          this.streams[id].streamInfo.resolution = 'UNKNOWN';
        }
        
        if (!this.streams[id].streamInfo.fps) {
          this.streams[id].streamInfo.fps = 0;
        }
        
        // Save the updated stream information
        this.saveConfig();
        this.log('info', `[${this.streams[id].name}] Stream analysis complete`);
        resolve(true);
      } catch (error) {
        this.log('error', `[${this.streams[id].name}] Error analyzing stream: ${error.message}`);
        // Even if there's an error, we might have partial results
        this.saveConfig();
        resolve(false);
      }
    });
  }
  
  // Helper method to estimate bitrate from segment sizes
  _estimateBitrateFromSegments(id, hlsPath, existingSegments = null) {
    try {
      const segmentFiles = existingSegments || fs.readdirSync(hlsPath)
        .filter(file => file.endsWith('.ts'))
        .map(file => ({
          name: file,
          size: fs.statSync(path.join(hlsPath, file)).size,
          time: fs.statSync(path.join(hlsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (segmentFiles.length >= 2) {
        // Take the latest 3 segments (or fewer if not available)
        const samples = segmentFiles.slice(0, Math.min(3, segmentFiles.length));
        const totalSize = samples.reduce((sum, file) => sum + (file.size || 0), 0);
        
        // Estimate bitrate based on segment size and duration (assume 2 seconds per segment)
        const avgSizePerSecond = totalSize / (samples.length * 2);
        const estimatedBitrate = avgSizePerSecond * 8; // Convert bytes to bits
        
        this.streams[id].streamInfo.bitrate = Math.round(estimatedBitrate);
        this.log('info', `[${this.streams[id].name}] Estimated bitrate from segment size: ${Math.round(estimatedBitrate)} bps`);
      }
    } catch (error) {
      this.log('error', `[${this.streams[id].name}] Error estimating bitrate: ${error.message}`);
    }
  }

  // Start screenshot timer for a stream
  startScreenshotTimer(id) {
    if (this.screenshotTimers[id]) {
      clearInterval(this.screenshotTimers[id]);
    }

    this.screenshotTimers[id] = setInterval(() => {
      this.takeScreenshot(id);
    }, this.screenshotInterval);
    
    this.log('info', `Started screenshot timer for stream ${id} (interval: ${this.screenshotInterval / 1000}s)`);
  }

  // Clear screenshot timer
  _clearScreenshotTimer(id) {
    if (this.screenshotTimers[id]) {
      clearInterval(this.screenshotTimers[id]);
      delete this.screenshotTimers[id];
      this.log('info', `Cleared screenshot timer for stream ${id}`);
    }
  }

  // Clear segment health check timer for a stream
  _clearSegmentHealthCheck(id) {
    if (this.segmentHealthChecks[id]) {
      clearInterval(this.segmentHealthChecks[id]);
      delete this.segmentHealthChecks[id];
      this.log('info', `Cleared segment health check for stream ${id}`);
    }
  }

  // Analyze m3u8 playlist to find available resolutions before starting stream
  async analyzeM3u8Playlist(url) {
    try {
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        // Use FFprobe to get information about the stream
        const process = spawn('ffprobe', [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          url
        ]);
        
        let output = '';
        
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          this.log('debug', `FFprobe stderr: ${data.toString()}`);
        });
        
        process.on('close', (code) => {
          if (code !== 0) {
            this.log('warn', `FFprobe exited with code ${code}`);
            resolve(null); // Return null instead of rejecting to handle gracefully
            return;
          }
          
          try {
            const info = JSON.parse(output);
            this.log('debug', `Stream info: ${JSON.stringify(info, null, 2)}`);
            
            // Extract available resolutions and bitrates
            const variants = [];
            
            if (info.streams) {
              for (const stream of info.streams) {
                if (stream.codec_type === 'video' && stream.width && stream.height) {
                  variants.push({
                    resolution: `${stream.width}x${stream.height}`,
                    bitrate: stream.bit_rate ? parseInt(stream.bit_rate) : null,
                    height: stream.height
                  });
                }
              }
            }
            
            // If we found variants, sort by height (resolution) and return the highest
            if (variants.length > 0) {
              variants.sort((a, b) => b.height - a.height);
              this.log('info', `Found ${variants.length} variants, highest resolution: ${variants[0].resolution}`);
              resolve(variants);
            } else {
              this.log('info', 'No variants found in stream');
              resolve(null);
            }
          } catch (error) {
            this.log('error', `Error parsing FFprobe output: ${error.message}`);
            resolve(null);
          }
        });
      });
    } catch (error) {
      this.log('error', `Error analyzing m3u8 playlist: ${error.message}`);
      return null;
    }
  }

  // Analyze an HLS playlist to find the highest quality variant
  async analyzeHlsPlaylist(url) {
    try {
      const { spawn } = require('child_process');
      const https = require('https');
      const http = require('http');

      // Function to fetch the content of a URL with redirect support
      const fetchUrl = (url, maxRedirects = 5) => {
        return new Promise((resolve, reject) => {
          const protocol = url.startsWith('https') ? https : http;
          
          const options = {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          };
          
          protocol.get(url, options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              if (maxRedirects <= 0) {
                reject(new Error('Too many redirects'));
                return;
              }
              
              // Get the redirect URL
              let redirectUrl = res.headers.location;
              
              // Handle relative redirects
              if (!redirectUrl.startsWith('http')) {
                const urlObj = new URL(url);
                redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
              }
              
              this.log('info', `Following redirect from ${url} to ${redirectUrl}`);
              
              // Follow the redirect
              return fetchUrl(redirectUrl, maxRedirects - 1)
                .then(resolve)
                .catch(reject);
            }
            
            if (res.statusCode !== 200) {
              reject(new Error(`Request failed with status code ${res.statusCode}`));
              return;
            }
            
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              resolve(data);
            });
          }).on('error', (err) => {
            reject(err);
          });
        });
      };

      try {
        // Fetch the main playlist
        const content = await fetchUrl(url);
        
        // Check if this is a master playlist with variants
        if (content.includes('#EXT-X-STREAM-INF')) {
          this.log('info', 'Found HLS master playlist with multiple variants');
          
          // Parse the playlist to find variants
          const variants = [];
          
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.includes('#EXT-X-STREAM-INF')) {
              // Extract resolution and bandwidth
              const resolutionMatch = line.match(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)/);
              const bandwidthMatch = line.match(/#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);
              
              // Get the URL from the next line
              const variantUrl = lines[i + 1];
              
              if (variantUrl && !variantUrl.startsWith('#')) {
                // Construct full URL if it's relative
                let fullUrl = variantUrl;
                if (!variantUrl.startsWith('http')) {
                  const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
                  fullUrl = baseUrl + variantUrl;
                }
                
                // Add to variants list
                variants.push({
                  url: fullUrl,
                  resolution: resolutionMatch ? resolutionMatch[1] : null,
                  bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0,
                  height: resolutionMatch ? parseInt(resolutionMatch[1].split('x')[1]) : 0
                });
                
                i++; // Skip the URL line in the next iteration
              }
            }
          }
          
          // Sort variants by bandwidth (highest first)
          variants.sort((a, b) => b.bandwidth - a.bandwidth);
          
          if (variants.length > 0) {
            const selectedVariant = variants[0];
            this.log('info', `Found ${variants.length} variants, selecting highest quality: ${selectedVariant.resolution || 'Unknown'} (${selectedVariant.bandwidth} bps)`);
            
            // Store the selected resolution information for the stream
            // This will be used later to update the stream object
            this.selectedVariantInfo = {
              resolution: selectedVariant.resolution,
              bandwidth: selectedVariant.bandwidth,
              height: selectedVariant.height
            };
            
            return selectedVariant.url;
          }
        }
      } catch (error) {
        this.log('warn', `Error analyzing HLS playlist content: ${error.message}`);
        // Continue with original URL on content analysis error
      }
      
      // If no variants found or not a master playlist, return the original URL
      return url;
    } catch (error) {
      this.log('error', `Error analyzing HLS playlist: ${error.message}`);
      return url; // Return original URL on error
    }
  }

  // Record an error for a stream
  _recordError(id, errorType, message) {
    if (!this.streams[id]) return;
    
    // Initialize error tracking if not already done
    if (!this.streams[id].errors) {
      this.streams[id].errors = {
        total: 0,
        byType: {},
        recent: []
      };
    }
    
    // Initialize diagnostics if not already done
    if (!this.streams[id].diagnostics) {
      this.streams[id].diagnostics = {
        lastErrorType: null,
        errorCount: 0,
        networkErrors: 0,
        sourceErrors: 0,
        ffmpegErrors: 0,
        segmentGaps: 0,
        lastHealthCheck: null,
        healthCheckStatus: null
      };
    }
    
    // Add error to history
    this.streams[id].errors.recent.push({
      timestamp: new Date().toISOString(),
      type: errorType,
      message: message.substring(0, 500) // Limit message length
    });
    
    // Keep only the last 10 errors
    if (this.streams[id].errors.recent.length > 10) {
      this.streams[id].errors.recent = this.streams[id].errors.recent.slice(-10);
    }
    
    // Update diagnostics
    this.streams[id].diagnostics.lastErrorType = errorType;
    this.streams[id].diagnostics.errorCount++;
    
    // Update specific error counters
    switch (errorType) {
      case 'network':
        this.streams[id].diagnostics.networkErrors++;
        break;
      case 'source':
        this.streams[id].diagnostics.sourceErrors++;
        break;
      case 'ffmpeg':
        this.streams[id].diagnostics.ffmpegErrors++;
        break;
      case 'system':
        this.streams[id].diagnostics.systemErrors++;
        break;
    }
    
    // Update last error
    this.streams[id].stats.lastError = `[${errorType}] ${message.substring(0, 200)}`;
    
    // Analyze error patterns
    this.analyzeErrorPatterns(id);
    
    // Log the error
    this.log('warn', `[${this.streams[id].name}] ${errorType} error: ${message}`);
    
    this.saveConfig();
  }

  // Analyze error patterns to adjust reconnection strategy
  analyzeErrorPatterns(id) {
    const stream = this.streams[id];
    if (!stream || !stream.errors || stream.errors.recent.length < 3) return;
    
    // Check for repeated same errors
    const lastThreeErrors = stream.errors.recent.slice(-3);
    const sameErrorType = lastThreeErrors.every(e => e.type === lastThreeErrors[0].type);
    
    if (sameErrorType) {
      this.log('warning', `Stream ${id} has had ${lastThreeErrors.length} consecutive ${lastThreeErrors[0].type} errors`);
      
      if (stream.diagnostics) {
        stream.diagnostics.consecutiveErrorType = lastThreeErrors[0].type;
        stream.diagnostics.consecutiveErrorCount = lastThreeErrors.length;
      }
      
      // For network errors, we might want to increase delay between attempts
      if (lastThreeErrors[0].type === 'network' && this.reconnectAttempts[id] > 0) {
        // Already handled by exponential backoff in handleReconnect
      }
    }
  }

  // Test if source URL is valid and accessible
  async testSourceUrl(id) {
    const stream = this.streams[id];
    if (!stream) return false;
    
    try {
      this.log('info', `Testing source URL for stream ${id}: ${stream.url}`);
      
      // Update diagnostics
      if (stream.diagnostics) {
        stream.diagnostics.lastSourceCheck = new Date().toISOString();
        stream.diagnostics.sourceCheckInProgress = true;
      }
      this.saveConfig();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (ffprobeProcess && !ffprobeProcess.killed) {
            ffprobeProcess.kill('SIGKILL');
          }
          this.log('warning', `Source URL test for stream ${id} timed out`);
          
          // Update diagnostics
          if (stream.diagnostics) {
            stream.diagnostics.sourceCheckInProgress = false;
            stream.diagnostics.sourceAvailable = false;
            stream.diagnostics.sourceCheckResult = 'timeout';
          }
          this.saveConfig();
          
          resolve(false);
        }, 10000); // 10 second timeout
        
        const ffprobeProcess = spawn('ffprobe', [
          '-v', 'error',
          '-i', stream.url,
          '-show_entries', 'format=duration',
          '-of', 'json'
        ]);
        
        let output = '';
        let errorOutput = '';
        
        ffprobeProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ffprobeProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        ffprobeProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          // Update diagnostics
          if (stream.diagnostics) {
            stream.diagnostics.sourceCheckInProgress = false;
            stream.diagnostics.sourceAvailable = code === 0;
            stream.diagnostics.sourceCheckResult = code === 0 ? 'success' : 'failed';
            if (code !== 0 && errorOutput) {
              stream.diagnostics.sourceCheckError = errorOutput.substring(0, 200);
            }
          }
          this.saveConfig();
          
          if (code === 0) {
            this.log('info', `Source URL for stream ${id} is valid`);
            resolve(true);
          } else {
            this.log('warning', `Source URL for stream ${id} appears invalid, code: ${code}, error: ${errorOutput}`);
            resolve(false);
          }
        });
      });
    } catch (error) {
      this.log('error', `Error testing source URL for stream ${id}: ${error.message}`);
      
      // Update diagnostics
      if (stream.diagnostics) {
        stream.diagnostics.sourceCheckInProgress = false;
        stream.diagnostics.sourceAvailable = false;
        stream.diagnostics.sourceCheckResult = 'error';
        stream.diagnostics.sourceCheckError = error.message;
      }
      this.saveConfig();
      
      return false;
    }
  }

  // Start segment health check for a stream
  startSegmentHealthCheck(id) {
    if (this.segmentHealthChecks[id]) {
      clearInterval(this.segmentHealthChecks[id]);
    }

    this.segmentHealthChecks[id] = setInterval(() => {
      this.checkStreamSegmentHealth(id);
    }, this.segmentHealthCheckInterval);
    
    this.log('info', `Started segment health check for stream ${id} (interval: ${this.segmentHealthCheckInterval / 1000}s)`);
  }

  // Analyze stream resolution from the playlist file
  _analyzeStreamResolution(id) {
    if (!this.streams[id] || !fs.existsSync(this.streams[id].hlsPath)) {
      return null;
    }

    try {
      // First check if we already know the resolution from the selected variant
      if (this.streams[id].selectedResolution) {
        const resolution = this.streams[id].selectedResolution;
        // Convert resolution format if needed (e.g., "1280x720" to "720p")
        if (resolution.includes('x')) {
          const height = parseInt(resolution.split('x')[1]);
          if (height >= 1080) return "1080p";
          if (height >= 720) return "720p";
          if (height >= 480) return "480p";
          if (height >= 360) return "360p";
          return resolution; // Return as is if we can't categorize
        }
        return resolution;
      }

      const playlistPath = path.join(this.streams[id].hlsPath, 'playlist.m3u8');
      if (!fs.existsSync(playlistPath)) {
        return null;
      }

      const content = fs.readFileSync(playlistPath, 'utf8');
      
      // Look for resolution in the playlist
      const resolutionMatch = content.match(/#EXT-X-STREAM-INF:.*RESOLUTION=(\d+x\d+)/);
      if (resolutionMatch && resolutionMatch[1]) {
        const resolution = resolutionMatch[1];
        const height = parseInt(resolution.split('x')[1]);
        if (height >= 1080) return "1080p";
        if (height >= 720) return "720p";
        if (height >= 480) return "480p";
        if (height >= 360) return "360p";
        return `${height}p`;
      }
      
      // Try alternative resolution pattern
      const alternativeMatch = content.match(/RESOLUTION=(\d+x\d+)/);
      if (alternativeMatch && alternativeMatch[1]) {
        const resolution = alternativeMatch[1];
        const height = parseInt(resolution.split('x')[1]);
        if (height >= 1080) return "1080p";
        if (height >= 720) return "720p";
        if (height >= 480) return "480p";
        if (height >= 360) return "360p";
        return `${height}p`;
      }
      
      // If no resolution found in the main playlist, check for bandwidth
      const bandwidthMatch = content.match(/#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+)/);
      if (bandwidthMatch && bandwidthMatch[1]) {
        const bandwidth = parseInt(bandwidthMatch[1]);
        // Estimate resolution based on bandwidth
        if (bandwidth > 5000000) return "1080p";
        if (bandwidth > 2500000) return "720p";
        if (bandwidth > 1000000) return "480p";
        return "360p";
      }
      
      // If no resolution info found, try to detect from segment size
      const segmentFiles = fs.readdirSync(this.streams[id].hlsPath)
        .filter(file => file.endsWith('.ts'))
        .map(file => ({
          name: file,
          size: fs.statSync(path.join(this.streams[id].hlsPath, file)).size,
          time: fs.statSync(path.join(this.streams[id].hlsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (segmentFiles.length > 0) {
        const avgSize = segmentFiles.slice(0, Math.min(3, segmentFiles.length))
          .reduce((sum, file) => sum + (file.size || 0), 0) / Math.min(3, segmentFiles.length);
        
        // Estimate resolution based on segment size
        if (avgSize > 2000000) return "1080p";
        if (avgSize > 1000000) return "720p";
        if (avgSize > 500000) return "480p";
        return "360p";
      }
      
      return null;
    } catch (error) {
      this.log('error', `[${this.streams[id].name}] Error analyzing stream resolution: ${error.message}`);
      return null;
    }
  }

  // Check segment health for a stream
  checkStreamSegmentHealth(id) {
    if (!this.streams[id] || this.streams[id].status !== 'running') {
      return;
    }

    try {
      // Ensure the stream has hlsPath property
      if (!this.streams[id].hlsPath) {
        this.streams[id].hlsPath = path.join(this.hlsDir, id);
      }
      
      const hlsPath = this.streams[id].hlsPath;
      
      // Ensure the HLS directory exists
      if (!fs.existsSync(hlsPath)) {
        fs.mkdirSync(hlsPath, { recursive: true });
        this.log('info', `[${this.streams[id].name}] Created HLS directory: ${hlsPath}`);
      }

      // Initialize diagnostics if not already done
      if (!this.streams[id].diagnostics) {
        this.streams[id].diagnostics = {
          lastHealthCheck: null,
          segmentCount: 0,
          healthCheckStatus: 'Unknown'
        };
      }
      
      // Update last health check timestamp
      this.streams[id].diagnostics.lastHealthCheck = new Date().toISOString();

      const playlistPath = path.join(hlsPath, 'playlist.m3u8');
      if (!fs.existsSync(playlistPath)) {
        this.log('warn', `[${this.streams[id].name}] Playlist file not found during health check`);
        this._recordError(id, 'segment', 'Playlist file not found');
        this.streams[id].diagnostics.healthCheckStatus = 'No playlist';
        this._updateStreamHealth(id, 'poor');
        return;
      }

      // Read the playlist file
      const content = fs.readFileSync(playlistPath, 'utf8');
      
      // Count segments
      const segmentCount = (content.match(/\.ts/g) || []).length;
      this.streams[id].diagnostics.segmentCount = segmentCount;
      
      // Check if any segments exist
      if (segmentCount === 0) {
        this.log('warn', `[${this.streams[id].name}] No segments found in playlist`);
        this._recordError(id, 'segment', 'No segments in playlist');
        this.streams[id].diagnostics.healthCheckStatus = 'No segments';
        this._updateStreamHealth(id, 'poor');
        return;
      }
      
      // Get the latest segment file
      const segmentFiles = fs.readdirSync(hlsPath)
        .filter(file => file.endsWith('.ts'))
        .map(file => ({
          name: file,
          time: fs.statSync(path.join(hlsPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (segmentFiles.length === 0) {
        this.log('warn', `[${this.streams[id].name}] No segment files found in directory`);
        this._recordError(id, 'segment', 'No segment files in directory');
        this.streams[id].diagnostics.healthCheckStatus = 'No segment files';
        this._updateStreamHealth(id, 'poor');
        return;
      }
      
      // Check the age of the latest segment
      const latestSegment = segmentFiles[0];
      const segmentAge = (Date.now() - latestSegment.time) / 1000; // Age in seconds
      
      // Update diagnostics
      this.streams[id].diagnostics.latestSegment = latestSegment.name;
      this.streams[id].diagnostics.latestSegmentAge = Math.round(segmentAge);
      
      // Check if the segment is too old
      const maxSegmentAge = process.env.MAX_SEGMENT_AGE || 30; // Default 30 seconds
      if (segmentAge > maxSegmentAge) {
        this.log('warn', `[${this.streams[id].name}] Latest segment is too old (${Math.round(segmentAge)}s)`);
        this._recordError(id, 'segment', `Latest segment is too old (${Math.round(segmentAge)}s)`);
        this.streams[id].diagnostics.healthCheckStatus = 'Stale segments';
        this._updateStreamHealth(id, 'poor');
        return;
      }
      
      // All checks passed
      this.streams[id].diagnostics.healthCheckStatus = 'Healthy';
      this._updateStreamHealth(id, 'good');
      
      // Try to analyze stream resolution if not already set
      if (!this.streams[id].streamInfo || !this.streams[id].streamInfo.resolution) {
        const resolution = this._analyzeStreamResolution(id);
        if (resolution) {
          if (!this.streams[id].streamInfo) {
            this.streams[id].streamInfo = {};
          }
          this.streams[id].streamInfo.resolution = resolution;
          this.log('info', `[${this.streams[id].name}] Detected resolution: ${resolution}`);
          this.saveConfig();
        }
      }
    } catch (error) {
      this.log('error', `[${this.streams[id].name}] Error checking segment health: ${error.message}`);
      this._recordError(id, 'system', `Health check error: ${error.message}`);
      this.streams[id].diagnostics.healthCheckStatus = 'Check error';
      this._updateStreamHealth(id, 'poor');
    }
  }
}

module.exports = StreamManager;
