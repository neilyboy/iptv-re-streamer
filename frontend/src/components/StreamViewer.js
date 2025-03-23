import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

const StreamViewer = ({ streamId, hlsUrl }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const timeoutRef = useRef(null);
  
  // Clean up function to destroy HLS instance and clear timeouts
  const cleanup = useCallback(() => {
    console.log('StreamViewer: Cleaning up HLS instance');
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    const video = videoRef.current;
    if (video) {
      video.removeAttribute('src');
      video.load();
    }
  }, []);
  
  // Initialize HLS player
  const loadStream = useCallback(() => {
    console.log('StreamViewer: Loading stream', { streamId, hlsUrl });
    setError(null);
    setLoading(true);
    setLoadingTimeout(false);
    
    const video = videoRef.current;
    
    // Validate required props
    if (!video || !streamId || !hlsUrl) {
      console.error('StreamViewer: Missing required props', { video: !!video, streamId, hlsUrl });
      setError('Missing required stream information');
      setLoading(false);
      return;
    }
    
    // Clean up any existing HLS instance
    cleanup();
    
    // Set a timeout to show a message if loading takes too long
    timeoutRef.current = setTimeout(() => {
      console.log('StreamViewer: Loading timeout reached');
      if (loading) {
        setLoadingTimeout(true);
      }
    }, 10000); // 10 seconds timeout
    
    try {
      // Check if HLS is supported
      if (Hls.isSupported()) {
        console.log('StreamViewer: HLS.js is supported, initializing player');
        
        // Create new HLS instance
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000, // 60MB
          maxBufferHole: 0.5,
          manifestLoadingTimeOut: 15000, // 15 seconds
          manifestLoadingMaxRetry: 4,
          levelLoadingTimeOut: 15000, // 15 seconds
          levelLoadingMaxRetry: 4,
          fragLoadingTimeOut: 30000, // 30 seconds
          fragLoadingMaxRetry: 6,
        });
        
        // Store HLS instance for cleanup
        hlsRef.current = hls;
        
        // Setup event handlers
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('StreamViewer: Media attached, loading source');
          hls.loadSource(hlsUrl);
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('StreamViewer: Manifest parsed, playing video');
          video.play()
            .then(() => {
              console.log('StreamViewer: Playback started successfully');
              setLoading(false);
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
            })
            .catch(playError => {
              console.error('StreamViewer: Error starting playback', playError);
              // Don't set error here, just log it - the video might still play
              // Some browsers require user interaction to play
            });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('StreamViewer: HLS error', { event, data });
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('StreamViewer: Fatal network error', data.details);
                setError(`Network error: ${data.details}. Please check your connection and try again.`);
                setLoading(false);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('StreamViewer: Fatal media error, trying to recover', data.details);
                hls.recoverMediaError();
                break;
              default:
                console.error('StreamViewer: Fatal error, destroying HLS', data.details);
                setError(`Stream error: ${data.details}. Please try again later.`);
                setLoading(false);
                cleanup();
                break;
            }
          }
        });
        
        // Attach media
        hls.attachMedia(video);
        
        // Add event listener for when video starts playing
        video.addEventListener('playing', () => {
          console.log('StreamViewer: Video is now playing');
          setLoading(false);
          setLoadingTimeout(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        });
        
        // Add event listener for when video is stalled
        video.addEventListener('stalled', () => {
          console.log('StreamViewer: Video is stalled');
          // Don't set loading to true here as it may just be buffering
        });
        
        // Add event listener for when video encounters an error
        video.addEventListener('error', (e) => {
          console.error('StreamViewer: Video element error', e);
          setError(`Video playback error: ${e.target.error ? e.target.error.message : 'Unknown error'}`);
          setLoading(false);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari - it has native HLS support
        console.log('StreamViewer: Using native HLS support');
        video.src = hlsUrl;
        
        video.addEventListener('loadedmetadata', () => {
          console.log('StreamViewer: Video metadata loaded, playing video');
          video.play()
            .then(() => {
              console.log('StreamViewer: Playback started successfully');
              setLoading(false);
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
            })
            .catch(playError => {
              console.error('StreamViewer: Error starting playback', playError);
              // Don't set error here, just log it
            });
        });
        
        video.addEventListener('playing', () => {
          console.log('StreamViewer: Video is now playing');
          setLoading(false);
          setLoadingTimeout(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        });
        
        video.addEventListener('error', (e) => {
          console.error('StreamViewer: Video element error', e);
          setError(`Video playback error: ${e.target.error ? e.target.error.message : 'Unknown error'}`);
          setLoading(false);
        });
      } else {
        // HLS is not supported by the browser
        console.error('StreamViewer: HLS is not supported by this browser');
        setError('HLS streaming is not supported by your browser');
        setLoading(false);
      }
    } catch (err) {
      console.error('StreamViewer: Error initializing player', err);
      setError(`Error initializing player: ${err.message}`);
      setLoading(false);
    }
  }, [streamId, hlsUrl, cleanup]);
  
  // Load stream when component mounts or streamId/hlsUrl changes
  useEffect(() => {
    console.log('StreamViewer: Component mounted or props changed, loading stream');
    loadStream();
    
    // Cleanup when component unmounts or streamId/hlsUrl changes
    return () => {
      console.log('StreamViewer: Component unmounting or props changed, cleaning up');
      cleanup();
    };
  }, [streamId, hlsUrl, loadStream, cleanup]);
  
  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000000',
          display: loading || error ? 'none' : 'block'
        }}
        controls
        playsInline
      />
      
      {loading && (
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}>
          <CircularProgress size={60} thickness={4} sx={{ color: '#ffffff', mb: 2 }} />
          <Typography variant="body1" sx={{ color: '#ffffff', textAlign: 'center', px: 2 }}>
            {loadingTimeout 
              ? 'Stream is taking longer than expected to load. Please wait...' 
              : 'Loading stream...'}
          </Typography>
        </Box>
      )}
      
      {error && (
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          p: 3
        }}>
          <Alert 
            severity="error" 
            variant="filled"
            sx={{ 
              width: '100%', 
              maxWidth: '500px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            {error}
          </Alert>
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#ffffff', 
              mt: 2, 
              textAlign: 'center',
              maxWidth: '500px'
            }}
          >
            Try refreshing the page or check if the stream is running correctly.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default StreamViewer;
