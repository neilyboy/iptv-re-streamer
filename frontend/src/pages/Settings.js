import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Grid,
  TextField
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Upload as UploadIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import axios from 'axios';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [backupData, setBackupData] = useState('');
  const [importData, setImportData] = useState('');

  const handleExportConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/backup');
      
      // Format JSON with indentation for readability
      const formattedData = JSON.stringify(response.data, null, 2);
      setBackupData(formattedData);
      
      // Create a file for download
      const blob = new Blob([formattedData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restream-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSnackbar({
        open: true,
        message: 'Configuration exported successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error exporting configuration:', error);
      setSnackbar({
        open: true,
        message: 'Error exporting configuration. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportConfig = async () => {
    if (!importData.trim()) {
      setSnackbar({
        open: true,
        message: 'Please enter valid JSON configuration data',
        severity: 'warning'
      });
      return;
    }
    
    setLoading(true);
    try {
      // Parse and validate JSON
      const configData = JSON.parse(importData);
      
      // Import configuration
      await axios.post('/api/restore', {
        config: configData,
        mode: 'overwrite'
      });
      
      setSnackbar({
        open: true,
        message: 'Configuration imported successfully',
        severity: 'success'
      });
      
      // Clear import field
      setImportData('');
    } catch (error) {
      console.error('Error importing configuration:', error);
      
      let errorMessage = 'Error importing configuration. ';
      if (error instanceof SyntaxError) {
        errorMessage += 'Invalid JSON format.';
      } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage += error.response.data.error;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        // Validate JSON
        JSON.parse(content);
        setImportData(content);
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Invalid JSON file. Please upload a valid backup file.',
          severity: 'error'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Settings
      </Typography>
      
      <Grid container spacing={3}>
        {/* Backup Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            backgroundColor: '#1e1e1e', 
            color: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
                Backup Configuration
              </Typography>
              <Divider sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} paragraph>
                Export your current stream configuration as a JSON file for backup purposes.
              </Typography>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                onClick={handleExportConfig}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                Export Configuration
              </Button>
              
              {backupData && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
                    Backup Data Preview:
                  </Typography>
                  <TextField
                    multiline
                    fullWidth
                    variant="outlined"
                    value={backupData}
                    InputProps={{
                      readOnly: true,
                      style: { fontFamily: 'monospace', fontSize: '0.75rem' }
                    }}
                    minRows={8}
                    maxRows={12}
                    sx={{ 
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
                      '& .MuiInputBase-input': {
                        color: '#ffffff',
                      },
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Restore Section */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            backgroundColor: '#1e1e1e', 
            color: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#ffffff' }}>
                Restore Configuration
              </Typography>
              <Divider sx={{ mb: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
              
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} paragraph>
                Import a previously exported configuration. This will replace your current stream configuration.
              </Typography>
              
              <Typography variant="body2" color="error" paragraph>
                Warning: This will stop all currently running streams and replace your existing configuration.
              </Typography>
              
              <Button
                variant="outlined"
                color="primary"
                component="label"
                startIcon={<UploadIcon />}
                sx={{ 
                  mt: 1,
                  borderColor: '#377b58', 
                  color: '#377b58',
                  '&:hover': {
                    borderColor: '#5fa980',
                    backgroundColor: 'rgba(55, 123, 88, 0.1)',
                  }
                }}
              >
                Upload Backup File
                <input
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleFileUpload}
                />
              </Button>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
                  Or paste JSON configuration:
                </Typography>
                <TextField
                  multiline
                  fullWidth
                  variant="outlined"
                  placeholder="Paste your backup JSON here..."
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  InputProps={{
                    style: { fontFamily: 'monospace', fontSize: '0.75rem' }
                  }}
                  minRows={8}
                  maxRows={12}
                  sx={{ 
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
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                      '&::placeholder': {
                        color: 'rgba(255, 255, 255, 0.5)',
                        opacity: 1,
                      },
                    },
                  }}
                />
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  onClick={handleImportConfig}
                  disabled={loading || !importData.trim()}
                  sx={{ mt: 2 }}
                >
                  Import Configuration
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
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

export default Settings;
