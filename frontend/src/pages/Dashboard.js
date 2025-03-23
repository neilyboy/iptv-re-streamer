import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  CircularProgress, 
  Divider, 
  Button, 
  Chip, 
  useTheme, 
  Card, 
  CardContent,
  IconButton,
  LinearProgress,
  Fade,
  Tooltip,
  Avatar
} from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  Stop as StopIcon, 
  CheckCircle as HealthyIcon, 
  Warning as DegradedIcon, 
  Error as ErrorIcon,
  MemoryOutlined as MemoryIcon,
  StorageOutlined as StorageIcon,
  DeveloperBoard as CpuIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  BarChart as ChartIcon,
  Videocam as VideocamIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { motion } from 'framer-motion';

// Register Chart.js components
ChartJS.register(ArcElement, ChartTooltip, Legend);

const Dashboard = () => {
  const [healthData, setHealthData] = useState(null);
  const [systemData, setSystemData] = useState(null);
  const [streamsData, setStreamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [healthResponse, systemResponse, streamsResponse] = await Promise.all([
        axios.get('/api/health'),
        axios.get('/api/system'),
        axios.get('/api/streams')
      ]);
      
      setHealthData(healthResponse.data);
      setSystemData(systemResponse.data);
      setStreamsData(streamsResponse.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Poll data every 10 seconds
    const interval = setInterval(fetchData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Update chart styles when theme changes
  useEffect(() => {
    // Set global Chart.js defaults for dark mode
    ChartJS.defaults.color = theme.palette.text.primary;
    ChartJS.defaults.borderColor = theme.palette.divider;
    
    // Force update any existing charts
    const updateCharts = () => {
      Object.values(ChartJS.instances).forEach(chart => {
        if (chart) chart.update();
      });
    };
    
    updateCharts();
  }, [theme]);

  const handleRefresh = () => {
    fetchData();
  };

  if (loading && !healthData) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        sx={{ background: 'linear-gradient(145deg, #0a1929 0%, #132f4c 100%)' }}
      >
        <CircularProgress 
          size={60} 
          thickness={4} 
          sx={{ 
            color: theme.palette.primary.main,
            boxShadow: '0 0 20px rgba(58, 123, 213, 0.5)',
          }} 
        />
        <Typography 
          variant="h6" 
          sx={{ 
            mt: 3, 
            color: theme.palette.text.primary,
            fontWeight: 500,
            letterSpacing: '0.5px'
          }}
        >
          Loading Dashboard...
        </Typography>
      </Box>
    );
  }

  if (error && !healthData) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
        sx={{ background: 'linear-gradient(145deg, #0a1929 0%, #132f4c 100%)' }}
      >
        <ErrorIcon sx={{ fontSize: 60, color: theme.palette.error.main, mb: 2 }} />
        <Typography 
          variant="h5" 
          color="error" 
          sx={{ 
            fontWeight: 600,
            textAlign: 'center',
            maxWidth: '80%'
          }}
        >
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleRefresh} 
          startIcon={<RefreshIcon />}
          sx={{ mt: 3 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Calculate stream status counts
  const streamStatusCounts = {
    running: streamsData.filter(stream => stream.status === 'running').length,
    stopped: streamsData.filter(stream => stream.status === 'stopped').length,
    error: streamsData.filter(stream => stream.status === 'error').length
  };

  // Calculate stream health counts
  const streamHealthCounts = {
    good: streamsData.filter(stream => stream.health === 'good').length,
    degraded: streamsData.filter(stream => stream.health === 'degraded').length,
    failed: streamsData.filter(stream => stream.health === 'failed').length,
    unknown: streamsData.filter(stream => stream.health === 'unknown' || !stream.health).length
  };

  // Chart data for stream status
  const streamStatusData = {
    labels: ['Running', 'Stopped', 'Error'],
    datasets: [{
      data: [
        streamStatusCounts.running,
        streamStatusCounts.stopped,
        streamStatusCounts.error
      ],
      backgroundColor: [
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
      ],
      borderColor: [
        theme.palette.success.dark,
        theme.palette.warning.dark,
        theme.palette.error.dark,
      ],
      borderWidth: 1,
    }]
  };

  // Chart data for stream health
  const streamHealthData = {
    labels: ['Good', 'Degraded', 'Failed', 'Unknown'],
    datasets: [{
      data: [
        streamHealthCounts.good,
        streamHealthCounts.degraded,
        streamHealthCounts.failed,
        streamHealthCounts.unknown
      ],
      backgroundColor: [
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
        theme.palette.grey[500],
      ],
      borderColor: [
        theme.palette.success.dark,
        theme.palette.warning.dark,
        theme.palette.error.dark,
        theme.palette.grey[700],
      ],
      borderWidth: 1,
    }]
  };

  // Common chart options for dark theme
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: theme.palette.text.primary,
          padding: 20,
          font: {
            size: 12,
            family: theme.typography.fontFamily
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 4,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value}`;
          }
        }
      }
    },
    cutout: '70%',
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 800,
      easing: 'easeOutQuart'
    }
  };

  // Helper functions for formatting system data
  const formatMemory = (bytes) => {
    if (!bytes || bytes === 0) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatCpuUsage = (cpuData) => {
    if (!cpuData || !cpuData.length) return 'N/A';
    
    // Calculate average CPU usage across all cores
    const totalTime = cpuData.reduce((acc, cpu) => {
      return acc + Object.values(cpu).reduce((sum, val) => sum + val, 0);
    }, 0);
    
    const userTime = cpuData.reduce((acc, cpu) => acc + (cpu.user || 0), 0);
    const sysTime = cpuData.reduce((acc, cpu) => acc + (cpu.sys || 0), 0);
    
    // Calculate percentage (user + system time)
    const usagePercent = ((userTime + sysTime) / totalTime * 100).toFixed(1);
    return `${usagePercent}%`;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m ${Math.floor(seconds % 60)}s`;
    }
  };

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
          component={motion.div}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          sx={{ 
            color: theme.palette.text.primary,
            fontWeight: 700,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px'
          }}
        >
          Stream Dashboard
        </Typography>
        
        <Tooltip title="Refresh Dashboard">
          <IconButton 
            onClick={handleRefresh} 
            disabled={refreshing}
            component={motion.button}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            sx={{ 
              color: theme.palette.primary.main,
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
              p: 1.5,
              borderRadius: '12px',
              '&:hover': {
                background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
              }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {refreshing && (
        <Fade in={refreshing} timeout={300}>
          <LinearProgress 
            sx={{ 
              mb: 3, 
              height: 4, 
              borderRadius: 2,
              background: theme.palette.background.paper,
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }
            }} 
          />
        </Fade>
      )}
      
      <Grid container spacing={3}>
        {/* Stream Status Summary */}
        <Grid item xs={12}>
          <Card 
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            sx={{ 
              borderRadius: '16px',
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              position: 'relative',
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
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <VideocamIcon sx={{ color: theme.palette.primary.main }} />
                Stream Overview
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: 'rgba(46, 125, 50, 0.1)', 
                        color: theme.palette.success.main,
                        width: 48,
                        height: 48
                      }}
                    >
                      <PlayIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Running Streams</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {streamStatusCounts.running}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: 'rgba(237, 108, 2, 0.1)', 
                        color: theme.palette.warning.main,
                        width: 48,
                        height: 48
                      }}
                    >
                      <StopIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Stopped Streams</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {streamStatusCounts.stopped}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box 
                    sx={{ 
                      p: 2, 
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: 'rgba(211, 47, 47, 0.1)', 
                        color: theme.palette.error.main,
                        width: 48,
                        height: 48
                      }}
                    >
                      <ErrorIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Error Streams</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        {streamStatusCounts.error}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Stream Status Chart */}
        <Grid item xs={12} md={6}>
          <Card 
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            sx={{ 
              height: '100%',
              borderRadius: '16px',
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              position: 'relative',
              '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.3)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <ChartIcon sx={{ color: theme.palette.primary.main }} />
                Stream Status
              </Typography>
              
              <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                height={280} 
                position="relative"
                component={motion.div}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                {streamsData.length > 0 ? (
                  <Doughnut 
                    data={streamStatusData} 
                    options={chartOptions} 
                    key="status-chart"
                  />
                ) : (
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: theme.palette.text.secondary,
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}
                  >
                    No streams configured
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Stream Health Chart */}
        <Grid item xs={12} md={6}>
          <Card 
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            sx={{ 
              height: '100%',
              borderRadius: '16px',
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              position: 'relative',
              '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.3)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${theme.palette.secondary.main}, ${theme.palette.success.main})`,
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <SpeedIcon sx={{ color: theme.palette.secondary.main }} />
                Stream Health
              </Typography>
              
              <Box 
                display="flex" 
                justifyContent="center" 
                alignItems="center" 
                height={280} 
                position="relative"
                component={motion.div}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {streamsData.length > 0 ? (
                  <Doughnut 
                    data={streamHealthData} 
                    options={chartOptions}
                    key="health-chart"
                  />
                ) : (
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: theme.palette.text.secondary,
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}
                  >
                    No streams configured
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* System Information */}
        <Grid item xs={12}>
          <Card 
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            sx={{ 
              borderRadius: '16px',
              background: `linear-gradient(145deg, ${theme.palette.background.paper}, ${theme.palette.background.default})`,
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.primary.main})`,
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <CpuIcon sx={{ color: theme.palette.info.main }} />
                System Information
              </Typography>
              
              <Divider sx={{ mb: 3, backgroundColor: theme.palette.divider }} />
              
              <Grid container spacing={4}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box 
                    component={motion.div}
                    whileHover={{ y: -5 }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Box 
                      sx={{
                        bgcolor: `rgba(33, 150, 243, 0.1)`,
                        p: 1.5,
                        borderRadius: '50%',
                        width: 60,
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <StorageIcon sx={{ color: theme.palette.info.main, fontSize: 30 }} />
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Disk Space
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {systemData?.disk?.free ? formatMemory(systemData.disk.free) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Free of {systemData?.disk?.total ? formatMemory(systemData.disk.total) : 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box 
                    component={motion.div}
                    whileHover={{ y: -5 }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Box 
                      sx={{
                        bgcolor: `rgba(76, 175, 80, 0.1)`,
                        p: 1.5,
                        borderRadius: '50%',
                        width: 60,
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <MemoryIcon sx={{ color: theme.palette.success.main, fontSize: 30 }} />
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Memory Usage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {systemData?.memory?.used ? formatMemory(systemData.memory.used) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Used of {systemData?.memory?.total ? formatMemory(systemData.memory.total) : 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box 
                    component={motion.div}
                    whileHover={{ y: -5 }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Box 
                      sx={{
                        bgcolor: `rgba(156, 39, 176, 0.1)`,
                        p: 1.5,
                        borderRadius: '50%',
                        width: 60,
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <CpuIcon sx={{ color: theme.palette.secondary.main, fontSize: 30 }} />
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      CPU Usage
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {systemData?.cpu ? formatCpuUsage(systemData.cpu) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Total CPU Time
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Box 
                    component={motion.div}
                    whileHover={{ y: -5 }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      borderRadius: '12px',
                      background: `linear-gradient(145deg, ${theme.palette.background.default}, ${theme.palette.background.paper})`,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <Box 
                      sx={{
                        bgcolor: `rgba(255, 152, 0, 0.1)`,
                        p: 1.5,
                        borderRadius: '50%',
                        width: 60,
                        height: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshIcon sx={{ color: theme.palette.warning.main, fontSize: 30 }} />
                      </motion.div>
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      System Uptime
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {systemData?.uptime ? formatUptime(systemData.uptime) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Since Last Restart
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
