const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

// Stream manager
const StreamManager = require('./streamManager');

// Load environment variables
const PORT = process.env.PORT || 8080;
const STREAMS_PORT = process.env.STREAMS_PORT || 8088;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Serve HLS streams
app.use('/hls', (req, res, next) => {
  // Add CORS headers for HLS content
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
}, express.static(path.join(process.cwd(), 'data', 'hls')));

// Serve screenshots
app.use('/api/screenshots', (req, res, next) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  // Add cache control headers to prevent caching
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('Surrogate-Control', 'no-store');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
}, express.static(path.join(process.cwd(), 'data', 'screenshots')));

const server = http.createServer(app);

// Initialize stream manager
const streamManager = new StreamManager();

// Set up HTTP server for streaming output
const streamingServer = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Parse the URL path to get stream ID
  const urlPath = req.url.split('/');
  let streamId = '';
  
  if (urlPath.length > 1 && urlPath[1] === 'hls' && urlPath.length > 2) {
    // Format: /hls/{streamId}/playlist.m3u8
    streamId = urlPath[2];
  } else if (urlPath.length > 1) {
    // Legacy format: /{streamId}
    streamId = urlPath[1];
  }
  
  if (!streamId || !streamManager.getStream(streamId)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Stream not found');
    return;
  }
  
  // Check if this is an HLS request
  if (req.url.includes('.m3u8') || req.url.includes('.ts')) {
    // For HLS segments and playlists, serve the file directly
    const filePath = path.join(process.cwd(), 'data', req.url);
    
    if (fs.existsSync(filePath)) {
      const contentType = req.url.includes('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/MP2T';
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error(`Error streaming file: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });
      
      return;
    }
  }
  
  // Set appropriate headers for streaming
  res.writeHead(200, {
    'Content-Type': 'video/MP2T',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Stream is handled by ffmpeg directly to this port
  req.on('close', () => {
    console.log(`Client disconnected from stream ${streamId}`);
  });
});

// API Routes
app.get('/api/streams', (req, res) => {
  res.json(streamManager.getStreams());
});

app.post('/api/streams', (req, res) => {
  const { name, url } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  try {
    const stream = streamManager.addStream(name, url);
    res.status(201).json(stream);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/streams/:id', (req, res) => {
  const stream = streamManager.getStream(req.params.id);
  
  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  res.json(stream);
});

app.put('/api/streams/:id', (req, res) => {
  const { name, url } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  try {
    const stream = streamManager.updateStream(req.params.id, { name, url });
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    res.json(stream);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/streams/:id', (req, res) => {
  const success = streamManager.deleteStream(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  res.status(204).end();
});

app.post('/api/streams/:id/start', async (req, res) => {
  try {
    // Since startStream is now asynchronous due to HLS playlist analysis
    // we need to handle it properly with await
    const result = await streamManager.startStream(req.params.id);
    
    // The stream might have started successfully even if result is falsy
    // because the startStream method now starts the process asynchronously
    const stream = streamManager.getStream(req.params.id);
    
    if (stream && (stream.status === 'running' || stream.status === 'starting')) {
      return res.json({ success: true });
    } else {
      return res.status(404).json({ error: 'Stream not found or could not be started' });
    }
  } catch (error) {
    console.error(`Error starting stream ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Internal server error when starting stream' });
  }
});

app.post('/api/streams/:id/stop', (req, res) => {
  const success = streamManager.stopStream(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Stream not found or could not be stopped' });
  }
  
  res.json({ success: true });
});

app.post('/api/streams/:id/restart', (req, res) => {
  const success = streamManager.restartStream(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  res.json({ success: true });
});

app.get('/api/streams/:id/diagnostics', async (req, res) => {
  try {
    const id = req.params.id;
    logger.info(`[API] Fetching diagnostics for stream ${id}`);
    
    const stream = streamManager.getStream(id);
    if (!stream) {
      logger.warn(`[API] Stream ${id} not found for diagnostics request`);
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    // For diagnostics endpoint, only return the relevant data for status display
    const diagnosticsData = {
      id: stream.id,
      status: stream.status,
      health: stream.health || 'good', // Default to good if not set
      diagnostics: stream.diagnostics || {},
      stats: stream.stats || {},
      streamInfo: stream.streamInfo || {}
    };
    
    // If stream is running, trigger a health check update
    if (stream.status === 'running') {
      streamManager.analyzeErrorPatterns(id);
      
      // If it's been more than 2 minutes since last analysis, trigger a new one
      // but don't wait for it to complete
      if (!stream.diagnostics?.lastHealthCheck || 
          (new Date() - new Date(stream.diagnostics.lastHealthCheck)) > (2 * 60 * 1000)) {
        streamManager.analyzeHlsStreamInfo(id)
          .catch(err => logger.error(`[API] Error analyzing stream for diagnostics: ${err.message}`));
      }
    }
    
    logger.info(`[API] Successfully fetched diagnostics for stream ${id}`);
    return res.json(diagnosticsData);
  } catch (error) {
    logger.error(`[API] Error fetching stream diagnostics: ${error.message}`);
    return res.status(500).json({ error: 'Failed to fetch stream diagnostics' });
  }
});

app.post('/api/streams/:id/analyze', async (req, res) => {
  const id = req.params.id;
  console.log(`[Server] Analyzing stream ${id}`);
  
  const stream = streamManager.getStream(id);
  
  if (!stream) {
    console.log(`[Server] Stream ${id} not found for analysis`);
    return res.status(404).json({ error: 'Stream not found' });
  }
  
  if (stream.status !== 'running') {
    console.log(`[Server] Cannot analyze stream ${id} - status is ${stream.status}, not running`);
    return res.status(400).json({ error: 'Stream must be running to analyze' });
  }
  
  try {
    console.log(`[Server] Starting analysis for stream ${id}`);
    const success = await streamManager.analyzeHlsStreamInfo(id);
    
    // Even if the analysis wasn't fully successful, return what we have
    const updatedStream = streamManager.getStream(id);
    console.log(`[Server] Analysis complete for stream ${id}. Success: ${success}`, 
      updatedStream.streamInfo ? 'Stream info available' : 'No stream info available');
    
    res.json({ 
      success: success, 
      streamInfo: updatedStream.streamInfo || {},
      message: success ? 'Analysis completed successfully' : 'Analysis completed with partial results'
    });
  } catch (error) {
    console.error(`[Server] Error analyzing stream ${id}:`, error);
    res.status(500).json({ 
      error: 'Failed to analyze stream',
      message: error.message,
      success: false,
      streamInfo: stream.streamInfo || {}
    });
  }
});

app.post('/api/streams/:id/screenshot', (req, res) => {
  const success = streamManager.takeScreenshot(req.params.id);
  
  if (!success) {
    return res.status(404).json({ error: 'Stream not found or could not take screenshot' });
  }
  
  const stream = streamManager.getStream(req.params.id);
  res.json({ 
    success: true, 
    screenshotPath: stream.screenshotPath,
    screenshotTimestamp: stream.screenshotTimestamp
  });
});

// Test a stream URL
app.post('/api/test-stream', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Use ffprobe to check if the stream is valid
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0', // Select first video stream
      '-show_entries', 'stream=width,height,codec_name,bit_rate,avg_frame_rate',
      '-of', 'json',
      '-i', url,
      '-timeout', '5000000'  // 5 second timeout
    ]);
    
    let outputData = '';
    let errorData = '';
    
    ffprobe.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    ffprobe.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return res.status(400).json({ 
          error: 'Invalid stream URL or stream not accessible',
          details: errorData 
        });
      }
      
      try {
        const info = JSON.parse(outputData);
        if (info.streams && info.streams.length > 0) {
          const videoStream = info.streams[0];
          const width = videoStream.width;
          const height = videoStream.height;
          const codec = videoStream.codec_name;
          const bitrate = videoStream.bit_rate ? Math.round(videoStream.bit_rate / 1000) : null;
          const frameRate = videoStream.avg_frame_rate ? eval(videoStream.avg_frame_rate).toFixed(2) : null;
          
          // Determine resolution label (e.g., 1080p, 720p, etc.)
          let resolutionLabel = '';
          if (height >= 2160) resolutionLabel = '4K';
          else if (height >= 1440) resolutionLabel = '1440p';
          else if (height >= 1080) resolutionLabel = '1080p';
          else if (height >= 720) resolutionLabel = '720p';
          else if (height >= 480) resolutionLabel = '480p';
          else if (height >= 360) resolutionLabel = '360p';
          else if (height >= 240) resolutionLabel = '240p';
          else resolutionLabel = `${height}p`;
          
          return res.json({ 
            success: true, 
            message: 'Stream is valid and accessible',
            streamInfo: {
              resolution: resolutionLabel,
              width,
              height,
              codec,
              bitrate,
              frameRate
            }
          });
        } else {
          return res.status(400).json({ error: 'No video stream found in the provided URL' });
        }
      } catch (error) {
        return res.status(500).json({ error: 'Error parsing stream information', details: error.message });
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    streams: streamManager.getHealthStatus()
  });
});

// System information
app.get('/api/system', (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  
  // Get disk space information
  const getDiskInfo = () => {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const stats = fs.statfsSync(dataDir);
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      return { total, free, used };
    } catch (error) {
      console.error('Error getting disk info:', error);
      return { total: 0, free: 0, used: 0 };
    }
  };
  
  const stats = {
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    },
    cpu: os.cpus().map(cpu => cpu.times),
    platform: process.platform,
    nodeVersion: process.version,
    disk: getDiskInfo()
  };
  
  res.json(stats);
});

// Backup and restore
app.get('/api/backup', (req, res) => {
  const backup = streamManager.exportConfig();
  res.json(backup);
});

app.post('/api/restore', (req, res) => {
  const { config, mode } = req.body;
  
  if (!config || !config.streams) {
    return res.status(400).json({ error: 'Invalid backup data' });
  }
  
  try {
    // Validate stream objects have the minimum required properties
    const isValid = Object.values(config.streams).every(stream => 
      stream && 
      typeof stream === 'object' && 
      stream.id && 
      stream.name && 
      stream.url
    );
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid stream data in backup' });
    }
    
    // Mode can be 'append' or 'overwrite' (default is overwrite)
    const append = mode === 'append';
    streamManager.importConfig(config, true, append);
    res.json({ 
      success: true,
      mode: append ? 'append' : 'overwrite',
      streamsCount: Object.keys(config.streams).length 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message 
  });
});

// Start servers
server.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

streamingServer.listen(STREAMS_PORT, () => {
  console.log(`Stream output available on port ${STREAMS_PORT}`);
  
  // Initialize streams from saved config
  streamManager.initialize();
});

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing servers...');
  
  // Close web server first
  server.close(() => {
    console.log('Web server closed');
    
    // Then close streaming server
    streamingServer.close(() => {
      console.log('Streaming server closed');
      
      // Finally shut down all streams
      streamManager.shutdown();
      console.log('All streams shut down');
      
      process.exit(0);
    });
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forcing exit after timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application continues, but we log the error
});
