import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Paper,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Grid,
  CircularProgress
} from '@mui/material';
import { 
  PlayArrow, 
  Check, 
  Error, 
  Videocam, 
  Speed, 
  AudioFile, 
  HelpOutline, 
  Add as AddIcon 
} from '@mui/icons-material';
import axios from 'axios';

const StreamTester = ({ open, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [streamInfo, setStreamInfo] = useState(null);

  const handleTest = async () => {
    if (!url) {
      setError('Please enter a URL');
      return;
    }
    
    setTesting(true);
    setError('');
    setResult(null);
    setStreamInfo(null);
    
    try {
      const response = await axios.post('/api/test-stream', { url });
      
      setResult({
        success: true,
        message: response.data.message || 'Stream is valid and accessible'
      });
      
      // Store stream info if available
      if (response.data.streamInfo) {
        setStreamInfo(response.data.streamInfo);
      }
      
      // If successful, trigger callback after a short delay
      setTimeout(() => {
        if (onSuccess && false) { 
          onSuccess(url);
        }
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to test stream. Please check the URL and try again.');
      setResult({
        success: false,
        message: 'Stream test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    
    // Reset state when closing
    setTimeout(() => {
      setUrl('');
      setResult(null);
      setError('');
      setStreamInfo(null);
    }, 300);
  };

  const handleUseUrl = () => {
    if (onSuccess) {
      onSuccess(url);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTest();
    }
  };

  const renderStreamInfo = () => {
    if (!streamInfo) return null;
    
    return (
      <Box sx={{ 
        mt: 2, 
        p: 2, 
        backgroundColor: 'rgba(25, 118, 210, 0.1)', 
        borderRadius: '8px',
        border: '1px solid rgba(25, 118, 210, 0.3)'
      }}>
        <Typography variant="subtitle1" sx={{ color: '#64B5F6', fontWeight: 600, mb: 1 }}>
          Stream Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#aaaaaa', fontWeight: 500 }}>
              Resolution:
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600 }}>
              {streamInfo.width}x{streamInfo.height} ({streamInfo.resolution})
            </Typography>
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="body2" sx={{ color: '#aaaaaa', fontWeight: 500 }}>
              Codec:
            </Typography>
            <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600 }}>
              {streamInfo.codec || 'Unknown'}
            </Typography>
          </Grid>
          
          {streamInfo.bitrate && (
            <Grid item xs={6}>
              <Typography variant="body2" sx={{ color: '#aaaaaa', fontWeight: 500 }}>
                Bitrate:
              </Typography>
              <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600 }}>
                {streamInfo.bitrate} Kbps
              </Typography>
            </Grid>
          )}
          
          {streamInfo.frameRate && (
            <Grid item xs={6}>
              <Typography variant="body2" sx={{ color: '#aaaaaa', fontWeight: 500 }}>
                Frame Rate:
              </Typography>
              <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 600 }}>
                {streamInfo.frameRate} fps
              </Typography>
            </Grid>
          )}
        </Grid>
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleUseUrl}
            startIcon={<AddIcon />}
          >
            Use This Stream
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={!testing ? handleClose : undefined}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          borderRadius: '12px',
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Test Stream URL
        </Typography>
        <Button 
          variant="outlined" 
          color="inherit" 
          size="small"
          onClick={handleClose}
          disabled={testing}
          sx={{ 
            borderColor: 'rgba(255, 255, 255, 0.3)',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.5)',
            }
          }}
        >
          Close
        </Button>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pt: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 2, 
          p: 2, 
          backgroundColor: 'rgba(25, 118, 210, 0.1)', 
          borderRadius: '8px',
          border: '1px solid rgba(25, 118, 210, 0.2)'
        }}>
          <HelpOutline sx={{ color: '#1976d2', mr: 2 }} />
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            This tool validates if a stream URL is accessible and can be used for restreaming. 
            Enter a stream URL (RTMP, RTSP, HLS, etc.) below and click "Test Stream" to check its validity.
          </Typography>
        </Box>
        
        <TextField
          autoFocus
          label="Stream URL"
          fullWidth
          variant="outlined"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={testing}
          margin="normal"
          placeholder="rtmp://example.com/live/stream"
          sx={{ 
            mb: 2,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(30, 30, 30, 0.8)',
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.23)',
              },
              '&:hover fieldset': {
                borderColor: '#377b58',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#377b58',
              },
            },
            '& .MuiInputLabel-root': {
              color: 'rgba(255, 255, 255, 0.7)',
            },
            '& .MuiInputBase-input': {
              color: '#ffffff',
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.5)',
                opacity: 1,
              },
            },
            '& .MuiFormHelperText-root': {
              color: 'rgba(255, 255, 255, 0.7)',
            },
          }}
          helperText="Example formats: rtmp://, rtsp://, http://, https:// (HLS)"
        />
        
        {!url && !testing && !result && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'rgba(0, 0, 0, 0.2)', 
            borderRadius: '8px',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            mb: 2
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Example URLs to test:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'monospace' }}>
                  https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'monospace' }}>
                  rtmp://live.example.com/live/stream
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
        
        {testing && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} gutterBottom>
              Testing stream, please wait...
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={50} 
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Typography 
              variant="body2" 
              sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 1 }} 
              align="right"
            >
              50%
            </Typography>
          </Box>
        )}
        
        {result && (
          <Paper 
            elevation={3} 
            sx={{ 
              mt: 3, 
              p: 2, 
              background: result.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
              border: `1px solid ${result.success ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2
            }}
          >
            {result.success ? (
              <Check sx={{ color: '#4caf50' }} />
            ) : (
              <Error sx={{ color: '#f44336' }} />
            )}
            <Box>
              <Typography variant="subtitle1" sx={{ color: result.success ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                {result.success ? 'Stream Test Successful' : 'Stream Test Failed'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 0.5 }}>
                {result.message}
              </Typography>
              {error && (
                <Typography variant="body2" sx={{ color: '#f44336', mt: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Error: {error}
                </Typography>
              )}
            </Box>
          </Paper>
        )}
        
        {renderStreamInfo()}
        
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        {result && (
          <Button 
            onClick={() => {
              setUrl('');
              setResult(null);
              setError('');
              setStreamInfo(null);
            }}
            color="inherit"
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            Test Another URL
          </Button>
        )}
        <Button 
          onClick={handleTest}
          variant="contained"
          color="primary"
          disabled={!url.trim() || testing}
          startIcon={testing ? <CircularProgress size={20} /> : <PlayArrow />}
        >
          {testing ? 'Testing...' : 'Test Stream'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StreamTester;