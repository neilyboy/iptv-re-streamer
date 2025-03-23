import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  Fade,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  List,
  ListItem
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon, 
  PlayArrow as PlayArrowIcon, 
  Stop as StopIcon, 
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreIcon,
  Link as LinkIcon,
  Videocam as VideocamIcon,
  ExpandMore as ExpandMoreIcon,
  NetworkCheck,
  Source,
  Code,
  SystemUpdate,
  BrokenImage
} from '@mui/icons-material';
import axios from 'axios';
import moment from 'moment';
import StreamTester from '../components/StreamTester';
import ImportStreams from '../components/ImportStreams';

const StreamsList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add', 'edit', 'delete'
  const [formValues, setFormValues] = useState({ name: '', url: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [streamActions, setStreamActions] = useState({});
  const [openTesterDialog, setOpenTesterDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [activeMenuStream, setActiveMenuStream] = useState(null);
  const [expandedStreamId, setExpandedStreamId] = useState(null);
  const [diagnosticsData, setDiagnosticsData] = useState({});

  // Fetch streams list
  const fetchStreams = useCallback(async () => {
    try {
      const response = await axios.get('/api/streams');
      setStreams(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching streams:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load streams',
        severity: 'error'
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  // Fetch stream diagnostics
  const fetchStreamDiagnostics = useCallback(async (streamId) => {
    try {
      const response = await axios.get(`/api/streams/${streamId}/diagnostics`);
      setDiagnosticsData(prev => ({
        ...prev,
        [streamId]: response.data
      }));
    } catch (error) {
      console.error(`Error fetching diagnostics for stream ${streamId}:`, error);
    }
  }, []);

  // Handle dialog open/close
  const handleOpenAddDialog = () => {
    setDialogMode('add');
    setFormValues({ name: '', url: '' });
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (stream) => {
    setDialogMode('edit');
    setSelectedStream(stream);
    setFormValues({
      name: stream.name,
      url: stream.url
    });
    setOpenDialog(true);
  };

  const handleOpenDeleteDialog = (stream) => {
    setDialogMode('delete');
    setSelectedStream(stream);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedStream(null);
  };

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      if (dialogMode === 'add') {
        // Add new stream
        const response = await axios.post('/api/streams', formValues);
        setStreams(prev => [...prev, response.data]);
        setSnackbar({
          open: true,
          message: 'Stream added successfully',
          severity: 'success'
        });
      } else if (dialogMode === 'edit') {
        // Update existing stream
        const response = await axios.put(`/api/streams/${selectedStream.id}`, formValues);
        setStreams(prev => prev.map(s => s.id === selectedStream.id ? response.data : s));
        setSnackbar({
          open: true,
          message: 'Stream updated successfully',
          severity: 'success'
        });
      } else if (dialogMode === 'delete') {
        // Delete stream
        await axios.delete(`/api/streams/${selectedStream.id}`);
        setStreams(prev => prev.filter(s => s.id !== selectedStream.id));
        setSnackbar({
          open: true,
          message: 'Stream deleted successfully',
          severity: 'success'
        });
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error:', error);
      setSnackbar({
        open: true,
        message: `Failed to ${dialogMode} stream`,
        severity: 'error'
      });
    }
  };

  // Handle stream action (start, stop, restart)
  const handleStreamAction = useCallback(async (streamId, action) => {
    setStreamActions(prev => ({
      ...prev,
      [streamId]: {
        ...prev[streamId],
        [action]: true
      }
    }));

    try {
      await axios.post(`/api/streams/${streamId}/${action}`);
      
      // Show success notification
      const actionText = action === 'start' ? 'started' : action === 'stop' ? 'stopped' : 'restarted';
      setSnackbar({
        open: true,
        message: `Stream ${actionText} successfully`,
        severity: 'success'
      });
      
      // Wait a bit before fetching updated stream status
      setTimeout(async () => {
        await fetchStreams();
        setStreamActions(prev => ({
          ...prev,
          [streamId]: {
            ...prev[streamId],
            [action]: false
          }
        }));
        
        // Also fetch diagnostics if the stream is expanded
        if (expandedStreamId === streamId) {
          fetchStreamDiagnostics(streamId);
        }
      }, 1000);
    } catch (error) {
      console.error(`Error ${action} stream:`, error);
      setStreamActions(prev => ({
        ...prev,
        [streamId]: {
          ...prev[streamId],
          [action]: false
        }
      }));
      
      // Show error notification
      setSnackbar({
        open: true,
        message: `Failed to ${action} stream: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    }
  }, [fetchStreams, expandedStreamId, fetchStreamDiagnostics]);

  // Handle stream expansion for diagnostics
  const handleStreamExpand = (streamId) => {
    if (expandedStreamId === streamId) {
      setExpandedStreamId(null);
    } else {
      setExpandedStreamId(streamId);
      fetchStreamDiagnostics(streamId);
    }
  };

  // Refresh diagnostics for a stream
  const refreshDiagnostics = (streamId) => {
    fetchStreamDiagnostics(streamId);
  };

  // Navigate to stream detail page
  const handleViewStream = (streamId) => {
    navigate(`/streams/${streamId}`);
  };

  // Format the date
  const formatDate = (dateString) => {
    return moment(dateString).format('MMM D, YYYY [at] h:mm A');
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get health icon
  const getHealthIcon = (health) => {
    switch (health) {
      case 'good':
        return <CheckIcon fontSize="small" />;
      case 'degraded':
        return <WarningIcon fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      default:
        return <HelpIcon fontSize="small" />;
    }
  };

  // Get health color
  const getHealthColor = (health) => {
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

  // Check if action is in progress
  const isActionInProgress = (streamId, action) => {
    return streamActions[streamId]?.[action] || false;
  };

  // Render health status chip
  const renderHealthChip = (health) => {
    switch (health) {
      case 'good':
        return <Chip 
          icon={<CheckIcon />} 
          label="Good" 
          color="success" 
          size="small" 
          sx={{ marginRight: 1 }} 
        />;
      case 'degraded':
        return <Chip 
          icon={<WarningIcon />} 
          label="Degraded" 
          color="warning" 
          size="small" 
          sx={{ marginRight: 1 }} 
        />;
      case 'failed':
        return <Chip 
          icon={<ErrorIcon />} 
          label="Failed" 
          color="error" 
          size="small" 
          sx={{ marginRight: 1 }} 
        />;
      default:
        return <Chip 
          icon={<HelpIcon />} 
          label="Unknown" 
          color="default" 
          size="small" 
          sx={{ marginRight: 1 }} 
        />;
    }
  };

  // Render error type icon
  const renderErrorTypeIcon = (errorType) => {
    switch (errorType) {
      case 'network':
        return <Tooltip title="Network Error"><NetworkCheck color="error" /></Tooltip>;
      case 'source':
        return <Tooltip title="Source Error"><Source color="error" /></Tooltip>;
      case 'ffmpeg':
        return <Tooltip title="FFmpeg Error"><Code color="error" /></Tooltip>;
      case 'system':
        return <Tooltip title="System Error"><SystemUpdate color="error" /></Tooltip>;
      default:
        return null;
    }
  };

  // Format date string
  const formatDateString = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format time duration
  const formatDuration = (milliseconds) => {
    if (!milliseconds) return 'Unknown';
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const handleOpenTester = () => {
    setOpenTesterDialog(true);
  };

  const handleCloseTester = () => {
    setOpenTesterDialog(false);
  };

  const handleTestSuccess = (url) => {
    // Pre-fill the URL field after successful test
    setFormValues(prev => ({ ...prev, url }));
    setOpenTesterDialog(false);
    setDialogMode('add');
    setOpenDialog(true);
  };

  const handleOpenImport = () => {
    setOpenImportDialog(true);
  };

  const handleCloseImport = () => {
    setOpenImportDialog(false);
  };

  const handleImportSuccess = (result) => {
    fetchStreams();
    setSnackbar({
      open: true,
      message: `${result.streamsCount} streams ${result.mode === 'append' ? 'added' : 'imported'} successfully`,
      severity: 'success'
    });
  };

  // Handle menu open
  const handleMenuOpen = (event, stream) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveMenuStream(stream);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setActiveMenuStream(null);
  };

  // Get stream icon based on status
  const getStreamAvatar = (stream) => {
    const status = stream.status;
    const bgColor = status === 'running' ? '#4caf50' : status === 'stopped' ? '#ff9800' : '#f44336';
    
    return (
      <Avatar 
        sx={{ 
          bgcolor: bgColor,
          width: 56,
          height: 56
        }}
      >
        <VideocamIcon />
      </Avatar>
    );
  };

  // Handle snackbar close
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleTakeScreenshot = async (streamId) => {
    try {
      const response = await axios.post(`/api/streams/${streamId}/screenshot`);
      
      // Use the timestamp from the server response
      const timestamp = response.data.screenshotTimestamp || new Date().getTime();
      
      setSnackbar({
        open: true,
        message: 'Screenshot taken successfully',
        severity: 'success'
      });
      
      // Update the streams with a new screenshotPath that includes the timestamp
      setStreams(prevStreams => 
        prevStreams.map(stream => 
          stream.id === streamId 
            ? {
                ...stream, 
                screenshotPath: `/api/screenshots/${streamId}.jpg`,
                screenshotTimestamp: timestamp
              } 
            : stream
        )
      );
    } catch (error) {
      console.error('Error taking screenshot:', error);
      setSnackbar({
        open: true,
        message: 'Failed to take screenshot',
        severity: 'error'
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress sx={{ color: '#377b58' }} />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        backgroundColor: 'transparent',
        background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
        minHeight: '100vh',
        p: { xs: 2, sm: 3 },
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            color: theme.palette.text.primary,
            fontWeight: 700,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px'
          }}
        >
          Streams
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Stream
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleOpenTester}
            sx={{ 
              borderColor: '#f59f00', 
              color: '#f59f00',
              '&:hover': {
                borderColor: '#f8bb43',
                backgroundColor: 'rgba(245, 159, 0, 0.1)',
              }
            }}
          >
            Test Stream
          </Button>
          <Tooltip title="Refresh Streams">
            <IconButton 
              onClick={fetchStreams}
              sx={{ 
                color: theme.palette.primary.main,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress sx={{ color: '#377b58' }} />
        </Box>
      ) : streams.length === 0 ? (
        <Box 
          sx={{ 
            p: 4, 
            textAlign: 'center', 
            backgroundColor: 'rgba(19, 47, 76, 0.6)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            }
          }}
        >
          <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
            No streams found
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Your First Stream
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {streams.map((stream) => (
            <Grid item xs={12} sm={streams.length === 1 ? 10 : 8} md={streams.length === 1 ? 8 : 6} key={stream.id} sx={streams.length === 1 ? { mx: 'auto' } : {}}>
              <Fade in={true} timeout={500}>
                <Card 
                  sx={{ 
                    backgroundColor: 'rgba(19, 47, 76, 0.6)',
                    borderRadius: '16px',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.3)',
                    },
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    },
                    height: '100%'
                  }}
                >
                  <Box sx={{ 
                    p: 2, 
                    pt: 3, 
                    pb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: stream.status === 'running' ? '#4caf50' : 
                                 stream.status === 'stopped' ? '#ff9800' : '#f44336',
                        width: 48,
                        height: 48,
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <VideocamIcon />
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" component="div" sx={{ 
                          color: '#ffffff', 
                          fontWeight: 600,
                          fontSize: '1.1rem',
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 'calc(100% - 40px)' // Make room for the menu button
                        }}>
                          {stream.name}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, stream)}
                          sx={{ 
                            color: '#aaaaaa',
                            ml: 1,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              color: '#ffffff'
                            },
                            padding: '6px',
                            minWidth: '32px'
                          }}
                        >
                          <MoreIcon />
                        </IconButton>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={stream.status}
                          color={getStatusColor(stream.status)}
                          size="small"
                          sx={{ 
                            textTransform: 'capitalize',
                            height: '20px',
                            '& .MuiChip-label': {
                              px: 1,
                              fontSize: '0.7rem'
                            }
                          }}
                        />
                        <Chip
                          label={stream.health || 'unknown'}
                          color={getHealthColor(stream.health)}
                          size="small"
                          sx={{ 
                            textTransform: 'capitalize',
                            height: '20px',
                            '& .MuiChip-label': {
                              px: 1,
                              fontSize: '0.7rem'
                            }
                          }}
                        />
                        {stream.streamInfo && (
                          <Chip
                            label={stream.streamInfo.outputResolution || stream.streamInfo.displayResolution || stream.streamInfo.availableResolutions?.[0] || stream.streamInfo.resolution || '1080p'}
                            size="small"
                            sx={{ 
                              textTransform: 'uppercase',
                              height: '20px',
                              backgroundColor: '#2c3e50',
                              color: '#ecf0f1',
                              '& .MuiChip-label': {
                                px: 1,
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                              }
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  
                  <CardContent sx={{ p: 2, pt: 1, pb: 1, flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ 
                      color: '#aaaaaa', 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <VideocamIcon fontSize="small" sx={{ mr: 0.5, color: '#777777', fontSize: '0.9rem' }} />
                      Stream Preview
                    </Typography>
                    
                    <Box sx={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      mb: 1,
                      height: '120px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
                      position: 'relative'
                    }}>
                      {stream.screenshotPath ? (
                        <Box 
                          component="img"
                          src={`${stream.screenshotPath}${stream.screenshotPath.includes('?') ? '&' : '?'}t=${stream.screenshotTimestamp || new Date().getTime()}`}
                          key={`screenshot-${stream.id}-${stream.screenshotTimestamp || new Date().getTime()}`}
                          alt={`${stream.name} preview`}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxMTFhMmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNzc3IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gcHJldmlldyBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                          }}
                        />
                      ) : (
                        <Box sx={{ textAlign: 'center', p: 2 }}>
                          <Typography variant="body2" sx={{ color: '#777777' }}>
                            No preview available
                          </Typography>
                          {stream.status === 'running' && (
                            <Button 
                              size="small" 
                              variant="outlined" 
                              sx={{ mt: 1, fontSize: '0.7rem' }}
                              onClick={() => handleTakeScreenshot(stream.id)}
                            >
                              Take Screenshot
                            </Button>
                          )}
                        </Box>
                      )}
                      {stream.status === 'running' && stream.screenshotPath && (
                        <IconButton 
                          size="small" 
                          onClick={() => handleTakeScreenshot(stream.id)}
                          sx={{ 
                            position: 'absolute',
                            bottom: 5,
                            right: 5,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            color: '#fff',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            },
                            width: 30,
                            height: 30
                          }}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    
                    <Typography variant="caption" sx={{ 
                      color: '#777777', 
                      display: 'block', 
                      textAlign: 'right',
                      mt: 1,
                      fontSize: '0.7rem'
                    }}>
                      {stream.updatedAt ? 
                        `Updated ${moment(stream.updatedAt).fromNow()}` : 
                        (stream.createdAt ? 
                          `Created ${moment(stream.createdAt).fromNow()}` : 
                          (stream.stats && stream.stats.lastRestart ? 
                            `Last restart ${moment(stream.stats.lastRestart).fromNow()}` : 
                            'Recently added'))}
                      {stream.streamInfo && stream.streamInfo.resolution && 
                        ` • ${stream.streamInfo.resolution}`}
                    </Typography>
                  </CardContent>
                  
                  <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                  
                  <CardActions sx={{ 
                    justifyContent: 'space-between', 
                    px: 2, 
                    py: 1.5,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)'
                  }}>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewStream(stream.id)}
                      sx={{ 
                        color: '#64B5F6',
                        borderColor: 'rgba(100, 181, 246, 0.5)',
                        '&:hover': {
                          borderColor: '#64B5F6',
                          backgroundColor: 'rgba(100, 181, 246, 0.08)'
                        }
                      }}
                      variant="outlined"
                    >
                      View
                    </Button>
                    
                    <Box>
                      {stream.status !== 'running' ? (
                        <Tooltip title="Start Stream">
                          <span>
                            <Button
                              size="small"
                              color="success"
                              variant="contained"
                              startIcon={isActionInProgress(stream.id, 'start') ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                              onClick={() => handleStreamAction(stream.id, 'start')}
                              disabled={isActionInProgress(stream.id, 'start')}
                              sx={{ 
                                mr: 1,
                                boxShadow: '0 2px 5px rgba(76, 175, 80, 0.3)',
                                '&:hover': {
                                  backgroundColor: '#43a047'
                                }
                              }}
                            >
                              Start
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Stop Stream">
                          <span>
                            <Button
                              size="small"
                              color="error"
                              variant="contained"
                              startIcon={isActionInProgress(stream.id, 'stop') ? <CircularProgress size={16} /> : <StopIcon />}
                              onClick={() => handleStreamAction(stream.id, 'stop')}
                              disabled={isActionInProgress(stream.id, 'stop')}
                              sx={{ 
                                mr: 1,
                                boxShadow: '0 2px 5px rgba(244, 67, 54, 0.3)',
                                '&:hover': {
                                  backgroundColor: '#d32f2f'
                                }
                              }}
                            >
                              Stop
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </CardActions>
                  
                  {/* Expandable diagnostics section */}
                  <Accordion 
                    expanded={expandedStreamId === stream.id}
                    onChange={() => handleStreamExpand(stream.id)}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Diagnostics</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {diagnosticsData[stream.id] ? (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                            <Button 
                              size="small" 
                              startIcon={<RefreshIcon />}
                              onClick={() => refreshDiagnostics(stream.id)}
                            >
                              Refresh
                            </Button>
                          </Box>
                          
                          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Stream Health</Typography>
                            <Grid container spacing={1}>
                              <Grid item xs={6}>
                                <Typography variant="caption" display="block">
                                  Status: {stream.status}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Health: {stream.health}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Last Restart: {formatDateString(stream.stats?.lastRestart)}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" display="block">
                                  Health Check: {diagnosticsData[stream.id].healthCheckStatus || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Segments: {diagnosticsData[stream.id].segmentCount || 0}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Segment Gaps: {diagnosticsData[stream.id].segmentGaps || 0}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                          
                          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Error Statistics</Typography>
                            <Grid container spacing={1}>
                              <Grid item xs={6}>
                                <Typography variant="caption" display="block">
                                  Total Errors: {diagnosticsData[stream.id].errorCount || 0}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Network Errors: {diagnosticsData[stream.id].networkErrors || 0}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Source Errors: {diagnosticsData[stream.id].sourceErrors || 0}
                                </Typography>
                              </Grid>
                              <Grid item xs={6}>
                                <Typography variant="caption" display="block">
                                  FFmpeg Errors: {diagnosticsData[stream.id].ffmpegErrors || 0}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  System Errors: {diagnosticsData[stream.id].systemErrors || 0}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Last Error Type: {diagnosticsData[stream.id].lastErrorType || 'None'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Paper>
                          
                          {diagnosticsData[stream.id].errorHistory && diagnosticsData[stream.id].errorHistory.length > 0 && (
                            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>Recent Errors</Typography>
                              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                                {diagnosticsData[stream.id].errorHistory.map((error, index) => (
                                  <ListItem key={index} divider={index < diagnosticsData[stream.id].errorHistory.length - 1}>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          {renderErrorTypeIcon(error.type)}
                                          <Typography variant="body2" sx={{ ml: 0.5 }}>
                                            {error.type} error
                                          </Typography>
                                        </Box>
                                      }
                                      secondary={
                                        <>
                                          <Typography variant="caption" display="block">
                                            {formatDateString(error.timestamp)}
                                          </Typography>
                                          <Typography variant="caption" display="block" sx={{ wordBreak: 'break-word' }}>
                                            {error.message}
                                          </Typography>
                                        </>
                                      }
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </Paper>
                          )}
                          
                          {stream.status === 'running' && diagnosticsData[stream.id].sourceAvailable !== undefined && (
                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                              <Typography variant="subtitle2" gutterBottom>Source Status</Typography>
                              <Typography variant="caption" display="block">
                                Source Available: {diagnosticsData[stream.id].sourceAvailable ? 'Yes' : 'No'}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Last Check: {formatDateString(diagnosticsData[stream.id].lastSourceCheck)}
                              </Typography>
                              {diagnosticsData[stream.id].sourceCheckResult && (
                                <Typography variant="caption" display="block">
                                  Check Result: {diagnosticsData[stream.id].sourceCheckResult}
                                </Typography>
                              )}
                              {diagnosticsData[stream.id].sourceCheckError && (
                                <Typography variant="caption" display="block" color="error">
                                  Error: {diagnosticsData[stream.id].sourceCheckError}
                                </Typography>
                              )}
                            </Paper>
                          )}
                          
                          {stream.status === 'running' && diagnosticsData[stream.id].reconnectAttempt !== undefined && (
                            <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>Reconnection Status</Typography>
                              <Typography variant="caption" display="block">
                                Reconnect Attempt: {diagnosticsData[stream.id].reconnectAttempt} / {diagnosticsData[stream.id].maxReconnectAttempts}
                              </Typography>
                              {diagnosticsData[stream.id].nextReconnectTime && (
                                <Typography variant="caption" display="block">
                                  Next Reconnect: {formatDateString(diagnosticsData[stream.id].nextReconnectTime)}
                                </Typography>
                              )}
                            </Paper>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                </Card>
              </Fade>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Stream Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
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
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {dialogMode === 'add' ? 'Add New Stream' : dialogMode === 'edit' ? 'Edit Stream' : 'Delete Stream'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {dialogMode === 'delete' ? (
            <Typography>
              Are you sure you want to delete the stream "{selectedStream?.name}"? This action cannot be undone.
            </Typography>
          ) : (
            <>
              <TextField
                autoFocus
                margin="dense"
                name="name"
                label="Stream Name"
                fullWidth
                value={formValues.name}
                onChange={handleFormChange}
                error={formValues.name === ''}
                helperText={formValues.name === '' ? 'Stream name is required' : ''}
                variant="outlined"
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
                }}
              />
              <TextField
                margin="dense"
                name="url"
                label="Stream URL"
                fullWidth
                value={formValues.url}
                onChange={handleFormChange}
                error={formValues.url === ''}
                helperText={formValues.url === '' ? 'Stream URL is required' : ''}
                variant="outlined"
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
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={handleOpenTester}
                  sx={{ 
                    borderColor: '#f59f00', 
                    color: '#f59f00',
                    '&:hover': {
                      borderColor: '#f8bb43',
                      backgroundColor: 'rgba(245, 159, 0, 0.1)',
                    }
                  }}
                >
                  Test URL
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', p: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#aaaaaa' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color={dialogMode === 'delete' ? 'error' : 'primary'}
            disabled={dialogMode !== 'delete' && (formValues.name === '' || formValues.url === '')}
          >
            {dialogMode === 'add' ? 'Add' : dialogMode === 'edit' ? 'Update' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream Tester */}
      <StreamTester 
        open={openTesterDialog} 
        onClose={handleCloseTester} 
        onSuccess={handleTestSuccess} 
      />

      {/* Import Streams Dialog */}
      <Dialog 
        open={openImportDialog} 
        onClose={handleCloseImport} 
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
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          Import Streams
        </DialogTitle>
        <DialogContent>
          <ImportStreams onSuccess={handleImportSuccess} />
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', p: 2 }}>
          <Button onClick={handleCloseImport} sx={{ color: '#aaaaaa' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stream Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#252525',
            color: '#ffffff',
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            minWidth: '180px',
            '& .MuiMenuItem-root': {
              py: 1.5,
              '&:hover': {
                backgroundColor: 'rgba(55, 123, 88, 0.1)',
              }
            }
          }
        }}
      >
        <MenuItem onClick={() => {
          handleViewStream(activeMenuStream?.id);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" sx={{ color: '#377b58' }} />
          </ListItemIcon>
          <ListItemText>View Stream</ListItemText>
        </MenuItem>
        
        {activeMenuStream?.status === 'running' ? (
          <MenuItem onClick={() => {
            handleStreamAction(activeMenuStream?.id, 'stop');
            handleMenuClose();
          }}>
            <ListItemIcon>
              <StopIcon fontSize="small" sx={{ color: '#f44336' }} />
            </ListItemIcon>
            <ListItemText>Stop Stream</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => {
            handleStreamAction(activeMenuStream?.id, 'start');
            handleMenuClose();
          }}>
            <ListItemIcon>
              <PlayArrowIcon fontSize="small" sx={{ color: '#4caf50' }} />
            </ListItemIcon>
            <ListItemText>Start Stream</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => {
          handleOpenEditDialog(activeMenuStream);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" sx={{ color: '#2196f3' }} />
          </ListItemIcon>
          <ListItemText>Edit Stream</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          handleOpenDeleteDialog(activeMenuStream);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: '#f44336' }} />
          </ListItemIcon>
          <ListItemText>Delete Stream</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StreamsList;
