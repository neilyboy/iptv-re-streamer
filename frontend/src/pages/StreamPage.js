import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  CircularProgress,
  Chip,
  IconButton,
  Divider,
  Tooltip,
  Snackbar,
  Alert,
  TextField,
  InputAdornment,
  Avatar,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  ContentCopy as CopyIcon,
  Videocam as VideocamIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import StreamViewer from '../components/StreamViewer';
import moment from 'moment';
import { motion } from 'framer-motion';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 }
  }
};

const StreamPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [streamStartTime, setStreamStartTime] = useState(null);
  const [uptime, setUptime] = useState(0);

  // State for auto-refresh of diagnostics
  const [autoRefreshDiagnostics, setAutoRefreshDiagnostics] = useState(true);
  const diagnosticsIntervalRef = useRef(null);

  // Calculate and update uptime in real-time
  useEffect(() => {
    let uptimeInterval;
    
    if (stream && stream.status === 'running' && stream.stats && stream.stats.lastRestart) {
      // Store the start time
      if (!streamStartTime) {
        setStreamStartTime(new Date(stream.stats.lastRestart));
      }
      
      // Calculate initial uptime
      const calculateUptime = () => {
        if (streamStartTime) {
          const now = new Date();
          const diffSeconds = Math.floor((now - streamStartTime) / 1000);
          setUptime(diffSeconds);
        }
      };
      
      // Calculate uptime immediately
      calculateUptime();
      
      // Update uptime every second
      uptimeInterval = setInterval(calculateUptime, 1000);
    }
    
    return () => {
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
      }
    };
  }, [stream, streamStartTime]);

  // Fetch stream data
  const fetchStream = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      console.log(`StreamPage: Fetching stream data for ID: ${id}`);
      const response = await axios.get(`/api/streams/${id}`);
      
      if (!response.data) {
        throw new Error('Failed to fetch stream');
      }
      
      const streamData = response.data;
      console.log('StreamPage: Stream data received:', streamData);
      setStream(streamData);
      
      // If stream is running, get detailed analysis
      if (streamData.status === 'running') {
        try {
          console.log('StreamPage: Stream is running, getting detailed analysis');
          const analyzeResponse = await axios.post(`/api/streams/${id}/analyze`);
          if (analyzeResponse.status === 200) {
            console.log('StreamPage: Analysis successful:', analyzeResponse.data);
            // Refresh stream data to get the latest analysis
            const refreshResponse = await axios.get(`/api/streams/${id}`);
            if (refreshResponse.status === 200) {
              const refreshedData = refreshResponse.data;
              console.log('StreamPage: Refreshed data after analysis:', refreshedData);
              setStream(refreshedData);
            }
          }
        } catch (analyzeError) {
          console.error('StreamPage: Error analyzing stream:', analyzeError);
          // Add fallback streamInfo if missing
          if (!streamData.streamInfo) {
            console.log('StreamPage: Adding fallback stream info');
            streamData.streamInfo = {
              resolution: 'Unknown',
              videoCodec: 'Unknown',
              audioCodec: 'Unknown',
              bitrate: 0,
              fps: 0
            };
          }
          setStream(streamData);
        }
      }
    } catch (error) {
      console.error('StreamPage: Error fetching stream:', error);
      setError('Failed to fetch stream data. Please try again.');
    } finally {
      console.log('StreamPage: Fetch complete, setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // Function to fetch only stream diagnostics data (lightweight)
  const fetchStreamDiagnostics = useCallback(async () => {
    try {
      console.log(`StreamPage: Fetching diagnostics for stream ID: ${id}`);
      const response = await axios.get(`/api/streams/${id}/diagnostics`);
      
      if (response.data) {
        console.log('StreamPage: Diagnostics data received:', response.data);
        // Update only the diagnostics part of the stream
        setStream(prevStream => ({
          ...prevStream,
          health: response.data.health || prevStream.health,
          diagnostics: response.data.diagnostics || prevStream.diagnostics,
          stats: response.data.stats || prevStream.stats,
          streamInfo: response.data.streamInfo || prevStream.streamInfo
        }));
      }
    } catch (error) {
      console.error('StreamPage: Error fetching diagnostics:', error);
      // Don't set main error state, just log it
    }
  }, [id]);

  useEffect(() => {
    console.log('StreamPage: Initial load, fetching stream data');
    setLoading(true);
    fetchStream();
    
    // We're removing the automatic polling to prevent fullscreen exit
    // but adding a manual refresh button instead
  }, [fetchStream]);

  // Setup auto-refresh for diagnostics
  useEffect(() => {
    if (autoRefreshDiagnostics && stream && stream.status === 'running') {
      console.log('StreamPage: Setting up diagnostics auto-refresh');
      // Clear any existing interval
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
      }
      
      // Create new interval for auto-refresh
      diagnosticsIntervalRef.current = setInterval(() => {
        fetchStreamDiagnostics();
      }, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (diagnosticsIntervalRef.current) {
        console.log('StreamPage: Clearing diagnostics auto-refresh interval');
        clearInterval(diagnosticsIntervalRef.current);
        diagnosticsIntervalRef.current = null;
      }
    };
  }, [autoRefreshDiagnostics, stream, fetchStreamDiagnostics]);

  // Handle stream actions (start, stop, restart)
  const handleStreamAction = async (action) => {
    try {
      setActionLoading(true);
      await axios.post(`/api/streams/${id}/${action}`);
      
      // Show success toast notification
      setSnackbar({
        open: true,
        message: `Stream ${action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted'} successfully`,
        severity: 'success'
      });
      
      // Reset stream start time if stopping
      if (action === 'stop') {
        setStreamStartTime(null);
        setUptime(0);
      }
      
      // Set a new start time if starting or restarting
      if (action === 'start' || action === 'restart') {
        setStreamStartTime(new Date());
      }
      
      fetchStream(); // Refresh stream data
    } catch (err) {
      console.error(`Error ${action}ing stream:`, err);
      setError(`Failed to ${action} stream`);
      
      // Show error toast notification
      setSnackbar({
        open: true,
        message: `Failed to ${action} stream`,
        severity: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const startStream = () => handleStreamAction('start');
  const stopStream = () => handleStreamAction('stop');
  const restartStream = () => handleStreamAction('restart');

  // Get HLS URL for the stream
  const getHlsUrl = (streamId) => {
    if (!streamId) return null;
    
    // Make sure we use the correct port and path format
    return `http://${window.location.hostname}:8088/hls/${streamId}/playlist.m3u8`;
  };

  // Local Stream URL for sharing/copying
  const getLocalStreamUrl = (streamId) => {
    return `http://${window.location.hostname}:8088/hls/${streamId}/playlist.m3u8`;
  };

  // Copy stream URL to clipboard
  const copyStreamUrl = () => {
    try {
      const streamUrl = getLocalStreamUrl(id);
      
      // Create a temporary textarea element
      const textArea = document.createElement('textarea');
      textArea.value = streamUrl;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      let success = false;
      try {
        // Execute copy command
        success = document.execCommand('copy');
      } catch (err) {
        console.error('execCommand error', err);
        success = false;
      }
      
      // Remove the temporary element
      document.body.removeChild(textArea);
      
      if (success) {
        // Show success notification
        setSnackbar({
          open: true,
          message: 'Stream URL copied to clipboard',
          severity: 'success'
        });
      } else {
        // Show the URL in a notification so user can manually copy
        setSnackbar({
          open: true,
          message: `Copy this URL manually: ${streamUrl}`,
          severity: 'info'
        });
      }
    } catch (err) {
      console.error('Copy failed: ', err);
      setSnackbar({
        open: true,
        message: 'Failed to copy URL',
        severity: 'error'
      });
    }
  };

  // Format uptime
  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return '-';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Format bitrate
  const formatBitrate = (bitrate) => {
    if (!bitrate) return 'Unknown';
    
    const kilobitrate = bitrate / 1000;
    const megabitrate = kilobitrate / 1000;
    
    if (megabitrate >= 1) {
      return `${megabitrate.toFixed(2)} Mbps`;
    } else if (kilobitrate >= 1) {
      return `${kilobitrate.toFixed(0)} Kbps`;
    } else {
      return `${bitrate} bps`;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'error';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // Function to get health color based on status
  const getHealthColor = (health) => {
    switch (health) {
      case 'good':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'poor':
        return 'error';
      default:
        return 'info';
    }
  };

  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box sx={{ 
      p: 3, 
      width: '100%',
      minHeight: '100vh'
    }}>
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/streams')}
          sx={{ 
            mb: 3, 
            color: '#ffffff',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
        >
          Back to Streams
        </Button>
      </motion.div>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CircularProgress sx={{ color: '#4ade80' }} />
          </motion.div>
        </Box>
      ) : error ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ 
            mt: 2, 
            p: 3, 
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.2)'
          }}>
            <Typography variant="h6" color="error" gutterBottom>
              {error}
            </Typography>
            <Button 
              variant="contained" 
              sx={{
                background: 'linear-gradient(45deg, #ff5252 30%, #ff1744 90%)',
                boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
              }}
              onClick={fetchStream}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          </Box>
        </motion.div>
      ) : stream ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Stream Header with Name and Status */}
          <motion.div variants={itemVariants}>
            <Box
              sx={{
                p: 2,
                backgroundColor: 'rgba(15, 25, 35, 0.8)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                mb: 3,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2
              }}
            >
              <Avatar
                sx={{
                  bgcolor: stream.status === 'running' ? '#4caf50' : 
                           stream.status === 'stopped' ? '#ff9800' : '#f44336',
                  width: 64,
                  height: 64,
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                <VideocamIcon sx={{ fontSize: 36 }} />
              </Avatar>
              
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    {stream.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={stream.status}
                      color={getStatusColor(stream.status)}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                    {stream.health && (
                      <Chip
                        label={stream.health}
                        color={getHealthColor(stream.health)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: 2, 
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {stream.status === 'running' ? (
                      <Button
                        variant="contained"
                        color="error"
                        startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <StopIcon />}
                        onClick={stopStream}
                        disabled={actionLoading}
                        sx={{ 
                          boxShadow: '0 2px 5px rgba(244, 67, 54, 0.3)',
                          '&:hover': {
                            backgroundColor: '#d32f2f'
                          }
                        }}
                      >
                        Stop Stream
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                        onClick={startStream}
                        disabled={actionLoading}
                        sx={{ 
                          boxShadow: '0 2px 5px rgba(76, 175, 80, 0.3)',
                          '&:hover': {
                            backgroundColor: '#43a047'
                          }
                        }}
                      >
                        Start Stream
                      </Button>
                    )}
                    
                    {stream.status === 'running' && (
                      <>
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                          onClick={restartStream}
                          disabled={actionLoading}
                          sx={{ 
                            borderColor: '#f59f00', 
                            color: '#f59f00',
                            '&:hover': {
                              borderColor: '#f8bb43',
                              backgroundColor: 'rgba(245, 159, 0, 0.1)',
                            }
                          }}
                        >
                          Restart
                        </Button>
                        <Button
                          variant="outlined"
                          color="primary"
                          startIcon={<CopyIcon />}
                          onClick={copyStreamUrl}
                          sx={{ 
                            borderColor: 'rgba(100, 181, 246, 0.5)',
                            color: '#64B5F6',
                            '&:hover': {
                              borderColor: '#64B5F6',
                              backgroundColor: 'rgba(100, 181, 246, 0.08)'
                            }
                          }}
                        >
                          Copy URL
                        </Button>
                      </>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </motion.div>

          {/* Video Player */}
          <motion.div variants={itemVariants}>
            <Box
              sx={{
                height: { xs: '300px', sm: '400px', md: '500px' },
                mb: 3,
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#1e1e1e',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              {stream && stream.status === 'running' ? (
                <StreamViewer 
                  key={`stream-${id}-${stream.status}`} 
                  streamId={id} 
                  hlsUrl={getHlsUrl(id)} 
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(10, 25, 41, 0.8)',
                  }}
                >
                  <Typography variant="body1" sx={{ color: '#ffffff', mb: 2 }}>
                    {stream && stream.status === 'stopped' 
                      ? 'Stream is currently stopped. Click Start to begin streaming.' 
                      : 'Loading stream information...'}
                  </Typography>
                  {stream && stream.status === 'stopped' && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<PlayIcon />}
                      onClick={startStream}
                      disabled={actionLoading}
                    >
                      Start Stream
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </motion.div>
          
          {/* Stream URL (only when stream is running) */}
          {stream.status === 'running' && (
            <motion.div variants={itemVariants}>
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(74, 222, 128, 0.2)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography variant="subtitle2" sx={{ color: '#4ade80', mb: 1, fontWeight: 600 }}>
                  Local Stream URL
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={getLocalStreamUrl(id)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Copy URL">
                          <IconButton 
                            edge="end" 
                            onClick={copyStreamUrl} 
                            size="small"
                            sx={{
                              color: '#4ade80',
                              '&:hover': {
                                backgroundColor: 'rgba(74, 222, 128, 0.1)'
                              }
                            }}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                    sx: {
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      color: '#ffffff',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(74, 222, 128, 0.3)'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(74, 222, 128, 0.5)'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(74, 222, 128, 0.8)'
                      }
                    }
                  }}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" sx={{ color: '#aaaaaa', display: 'block' }}>
                  Use this URL in VLC, FFPlay, or other media players to view the stream
                </Typography>
              </Box>
            </motion.div>
          )}
          
          {/* Stream Diagnostics Section */}
          <motion.div variants={itemVariants}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 2 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentIcon sx={{ mr: 1, color: '#64B5F6' }} />
                  <Typography variant="h6" sx={{ color: '#64B5F6' }}>
                    Stream Diagnostics
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoRefreshDiagnostics}
                        onChange={(e) => setAutoRefreshDiagnostics(e.target.checked)}
                        color="primary"
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: '#aaaaaa' }}>
                        Auto-refresh
                      </Typography>
                    }
                  />
                  <Tooltip title="Refresh Diagnostics">
                    <IconButton 
                      onClick={fetchStreamDiagnostics}
                      sx={{ ml: 1, color: '#64B5F6' }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: 'rgba(15, 25, 35, 0.8)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                  Stream Diagnostics
                </Typography>
                
                <Divider sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                
                <Grid container spacing={2}>
                  {/* Stream Status Information */}
                  <Grid item xs={12} md={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        height: '100%'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ color: '#64B5F6', mb: 2, fontWeight: 500 }}>
                        Stream Status
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Status</Typography>
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.5,
                              mt: 0.5,
                              borderRadius: 5,
                              bgcolor: `${getStatusColor(stream.status)}.main`,
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textTransform: 'capitalize'
                            }}
                          >
                            {stream.status}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Health</Typography>
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.5,
                              mt: 0.5,
                              borderRadius: 5,
                              bgcolor: `${getHealthColor(stream.health || 'good')}.main`,
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textTransform: 'capitalize'
                            }}
                          >
                            {stream.health || 'Good'}
                          </Box>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Uptime</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.status === 'running' && stream.stats && stream.stats.uptime ? 
                              formatUptime(stream.stats.uptime) : 
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Last Restart</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.stats && stream.stats.lastRestart ? 
                              moment(stream.stats.lastRestart).format('MMM D, HH:mm:ss') : 
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Created</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.createdAt ? 
                              moment(stream.createdAt).format('MMM D, YYYY') : 
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Stream ID</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.id}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                  
                  {/* Stream Quality Information */}
                  <Grid item xs={12} md={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        height: '100%'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ color: '#4ade80', mb: 2, fontWeight: 500 }}>
                        Stream Quality
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Resolution</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.streamInfo && stream.streamInfo.resolution ? 
                              stream.streamInfo.resolution : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Codec</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.streamInfo && stream.streamInfo.videoCodec ? 
                              stream.streamInfo.videoCodec : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Audio</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.streamInfo && stream.streamInfo.audioCodec ? 
                              stream.streamInfo.audioCodec : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Frame Rate</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.streamInfo && stream.streamInfo.fps ? 
                              `${stream.streamInfo.fps} fps` : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Bitrate</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.streamInfo && stream.streamInfo.bitrate ? 
                              `${formatBitrate(stream.streamInfo.bitrate)}` : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Source Type</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.url && stream.url.includes('.m3u8') ? 'HLS' : 
                              stream.url && stream.url.includes('.ts') ? 'MPEG-TS' : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>
                  
                  {/* Stream Reliability Information */}
                  <Grid item xs={12} md={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        height: '100%'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ color: '#f59f00', mb: 2, fontWeight: 500 }}>
                        Stream Reliability
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Reconnect Attempts</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.diagnostics && stream.diagnostics.reconnectAttempt !== undefined ? 
                              stream.diagnostics.reconnectAttempt : 
                              stream.stats && stream.stats.reconnectAttempts !== undefined ?
                              stream.stats.reconnectAttempts :
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Max Reconnects</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.diagnostics && stream.diagnostics.maxReconnectAttempts !== undefined ? 
                              stream.diagnostics.maxReconnectAttempts : 
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Source Available</Typography>
                          <Typography variant="body2" sx={{ 
                            color: stream.diagnostics && stream.diagnostics.sourceAvailable === true ? '#4ade80' : 
                                   stream.diagnostics && stream.diagnostics.sourceAvailable === false ? '#ff6b6b' : 
                                   '#ffffff', 
                            mt: 0.5,
                            fontWeight: stream.diagnostics && stream.diagnostics.sourceAvailable !== null ? 500 : 400
                          }}>
                            {stream.diagnostics && stream.diagnostics.sourceAvailable !== null ? 
                              (stream.diagnostics.sourceAvailable ? 'Yes' : 'No') : 
                              'Unknown'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Segment Count</Typography>
                          <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                            {stream.diagnostics && stream.diagnostics.segmentCount !== undefined ? 
                              stream.diagnostics.segmentCount : 
                              '-'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Last Error</Typography>
                          <Typography variant="body2" sx={{ color: '#ff6b6b', mt: 0.5 }}>
                            {stream.diagnostics && stream.diagnostics.lastError ? 
                              stream.diagnostics.lastError : 
                              stream.stats && stream.stats.lastError ?
                              stream.stats.lastError :
                              'None'}
                          </Typography>
                        </Grid>
                        
                        {stream.diagnostics && stream.diagnostics.lastErrorTime && (
                          <Grid item xs={12}>
                            <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Error Time</Typography>
                            <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                              {moment(stream.diagnostics.lastErrorTime).format('MMM D, HH:mm:ss')}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          </motion.div>
          
          {/* Stream Source Information */}
          <motion.div variants={itemVariants}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: 'rgba(15, 25, 35, 0.8)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                Stream Source
              </Typography>
              
              <Divider sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Source URL</Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: '#ffffff', 
                      mt: 0.5, 
                      p: 1.5, 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '4px',
                      wordBreak: 'break-all'
                    }}
                  >
                    {stream.url}
                  </Typography>
                </Grid>
                
                {stream.selectedResolution && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: '#aaaaaa' }}>Selected Resolution</Typography>
                    <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                      {stream.selectedResolution}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </motion.div>
        </motion.div>
      ) : null}
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ 
            width: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StreamPage;
