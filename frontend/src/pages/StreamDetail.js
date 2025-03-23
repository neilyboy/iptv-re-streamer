import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import axios from 'axios';
import moment from 'moment';

const StreamDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [formValues, setFormValues] = useState({ name: '', url: '' });
  const [performing, setPerforming] = useState('');

  const fetchStream = async () => {
    try {
      const response = await axios.get(`/api/streams/${id}`);
      setStream(response.data);
      setFormValues({ name: response.data.name, url: response.data.url });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stream details:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching stream details. Stream may have been deleted.',
        severity: 'error'
      });
      setLoading(false);
      
      // If stream not found, redirect back to streams list
      if (error.response && error.response.status === 404) {
        setTimeout(() => {
          navigate('/streams');
        }, 2000);
      }
    }
  };

  useEffect(() => {
    fetchStream();
    
    // Refresh data every 15 seconds
    const intervalId = setInterval(fetchStream, 15000);
    
    return () => clearInterval(intervalId);
  }, [id]);

  const handleStartStream = async () => {
    setPerforming('starting');
    try {
      await axios.post(`/api/streams/${id}/start`);
      setSnackbar({
        open: true,
        message: 'Stream started successfully',
        severity: 'success'
      });
      fetchStream();
    } catch (error) {
      console.error('Error starting stream:', error);
      setSnackbar({
        open: true,
        message: `Error starting stream: ${error.response?.data?.error || 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setPerforming('');
    }
  };

  const handleStopStream = async () => {
    setPerforming('stopping');
    try {
      await axios.post(`/api/streams/${id}/stop`);
      setSnackbar({
        open: true,
        message: 'Stream stopped successfully',
        severity: 'success'
      });
      fetchStream();
    } catch (error) {
      console.error('Error stopping stream:', error);
      setSnackbar({
        open: true,
        message: `Error stopping stream: ${error.response?.data?.error || 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setPerforming('');
    }
  };

  const handleRestartStream = async () => {
    setPerforming('restarting');
    try {
      await axios.post(`/api/streams/${id}/restart`);
      setSnackbar({
        open: true,
        message: 'Stream restarted successfully',
        severity: 'success'
      });
      fetchStream();
    } catch (error) {
      console.error('Error restarting stream:', error);
      setSnackbar({
        open: true,
        message: `Error restarting stream: ${error.response?.data?.error || 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setPerforming('');
    }
  };

  const handleDeleteStream = async () => {
    if (window.confirm('Are you sure you want to delete this stream?')) {
      setPerforming('deleting');
      try {
        await axios.delete(`/api/streams/${id}`);
        setSnackbar({
          open: true,
          message: 'Stream deleted successfully',
          severity: 'success'
        });
        // Navigate back to streams list after successful deletion
        setTimeout(() => {
          navigate('/streams');
        }, 1500);
      } catch (error) {
        console.error('Error deleting stream:', error);
        setSnackbar({
          open: true,
          message: `Error deleting stream: ${error.response?.data?.error || 'Unknown error'}`,
          severity: 'error'
        });
        setPerforming('');
      }
    }
  };

  const handleOpenEditDialog = () => {
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
  };

  const handleFormChange = (e) => {
    setFormValues({
      ...formValues,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitEditForm = async () => {
    // Validate form
    if (!formValues.name || !formValues.url) {
      setSnackbar({
        open: true,
        message: 'Name and URL are required',
        severity: 'warning'
      });
      return;
    }

    setPerforming('editing');
    try {
      await axios.put(`/api/streams/${id}`, formValues);
      setSnackbar({
        open: true,
        message: 'Stream updated successfully',
        severity: 'success'
      });
      setOpenEditDialog(false);
      fetchStream();
    } catch (error) {
      console.error('Error updating stream:', error);
      setSnackbar({
        open: true,
        message: `Error updating stream: ${error.response?.data?.error || 'Unknown error'}`,
        severity: 'error'
      });
    } finally {
      setPerforming('');
    }
  };

  const copyStreamUrl = () => {
    const streamUrl = `http://${window.location.hostname}:8088/${id}`;
    navigator.clipboard.writeText(streamUrl);
    setSnackbar({
      open: true,
      message: 'Stream URL copied to clipboard',
      severity: 'info'
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStreamStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  const getHealthStatusColor = (health) => {
    switch (health) {
      case 'good':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Helper function to format uptime
  const formatUptime = (seconds) => {
    if (!seconds) return '-';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stream) {
    return (
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Typography variant="h6" color="error">
          Stream not found
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/streams')}
          sx={{ mt: 2 }}
        >
          Back to Streams
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/streams')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
          {stream.name}
        </Typography>
        <Box>
          <Tooltip title="Copy Stream URL">
            <IconButton onClick={copyStreamUrl} sx={{ mr: 1 }}>
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Stream">
            <IconButton onClick={handleOpenEditDialog} sx={{ mr: 1 }}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Stream">
            <IconButton 
              color="error" 
              onClick={handleDeleteStream}
              disabled={performing === 'deleting'}
            >
              {performing === 'deleting' ? <CircularProgress size={24} /> : <DeleteIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Stream Info Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stream Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Box
                    sx={{
                      display: 'inline-block',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 5,
                      bgcolor: `${getStreamStatusColor(stream.status)}.light`,
                      color: `${getStreamStatusColor(stream.status)}.dark`,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}
                  >
                    {stream.status}
                  </Box>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Health
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Box
                    sx={{
                      display: 'inline-block',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 5,
                      bgcolor: `${getHealthStatusColor(stream.health)}.light`,
                      color: `${getHealthStatusColor(stream.health)}.dark`,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}
                  >
                    {stream.health}
                  </Box>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    ID
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">{stream.id}</Typography>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Source URL
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{stream.url}</Typography>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Output URL
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {`http://${window.location.hostname}:8088/${stream.id}`}
                    </Typography>
                    <IconButton size="small" onClick={copyStreamUrl} sx={{ ml: 1 }}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Created
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {moment(stream.createdAt).format('MMM DD, YYYY HH:mm:ss')}
                  </Typography>
                </Grid>

                {stream.updatedAt && (
                  <>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Last Updated
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {moment(stream.updatedAt).format('MMM DD, YYYY HH:mm:ss')}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                {stream.status === 'running' ? (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={performing === 'stopping' ? <CircularProgress size={20} /> : <StopIcon />}
                    onClick={handleStopStream}
                    disabled={performing !== ''}
                  >
                    Stop Stream
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={performing === 'starting' ? <CircularProgress size={20} /> : <PlayIcon />}
                    onClick={handleStartStream}
                    disabled={performing !== ''}
                  >
                    Start Stream
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="info"
                  startIcon={performing === 'restarting' ? <CircularProgress size={20} /> : <RefreshIcon />}
                  onClick={handleRestartStream}
                  disabled={performing !== ''}
                >
                  Restart
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Stream Statistics
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Uptime
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">
                    {stream.status === 'running' ? formatUptime(stream.stats.uptime) : '-'}
                  </Typography>
                </Grid>

                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Restarts
                  </Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2">{stream.stats.restarts}</Typography>
                </Grid>

                {stream.stats.lastRestart && (
                  <>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Last Restart
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2">
                        {moment(stream.stats.lastRestart).format('MMM DD, YYYY HH:mm:ss')}
                      </Typography>
                    </Grid>
                  </>
                )}

                {stream.stats.lastError && (
                  <>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="textSecondary">
                        Last Error
                      </Typography>
                    </Grid>
                    <Grid item xs={8}>
                      <Typography variant="body2" color="error">
                        {stream.stats.lastError}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>

              {stream.status === 'running' && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Stream Output
                  </Typography>
                  <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                    <CardContent>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        To view this stream, use one of the following methods:
                      </Typography>
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          • Direct URL: <code>{`http://${window.location.hostname}:8088/${stream.id}`}</code>
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 1 }}>
                          • VLC: Media &gt; Open Network Stream &gt; <code>{`http://${window.location.hostname}:8088/${stream.id}`}</code>
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 1 }}>
                          • FFPlay: <code>{`ffplay http://${window.location.hostname}:8088/${stream.id}`}</code>
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog 
        open={openEditDialog} 
        onClose={handleCloseEditDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            borderRadius: '12px',
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Edit Stream</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Stream Name"
            type="text"
            fullWidth
            variant="outlined"
            value={formValues.name}
            onChange={handleFormChange}
            error={formValues.name === ''}
            helperText={formValues.name === '' ? 'Stream name is required' : ''}
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
              },
              '& .MuiFormHelperText-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
          <TextField
            margin="dense"
            name="url"
            label="Stream URL"
            type="text"
            fullWidth
            variant="outlined"
            value={formValues.url}
            onChange={handleFormChange}
            error={formValues.url === ''}
            helperText={formValues.url === '' ? 'Stream URL is required' : 'Enter the source URL for the stream (m3u8, ts, mpeg, etc.)'}
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
              },
              '& .MuiFormHelperText-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', p: 2 }}>
          <Button onClick={handleCloseEditDialog} sx={{ color: '#b3b3b3' }}>Cancel</Button>
          <Button 
            onClick={handleSubmitEditForm} 
            variant="contained" 
            color="primary"
            disabled={performing === 'editing' || formValues.name === '' || formValues.url === ''}
          >
            {performing === 'editing' ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StreamDetail;
