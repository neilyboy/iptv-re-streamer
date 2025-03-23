import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3a7bd5',
      light: '#63a4ff',
      dark: '#0d47a1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00c853',
      light: '#5efc82',
      dark: '#009624',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0a1929',
      paper: '#132f4c',
      darker: '#071426',
      card: '#1a3a5f',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0bec5',
      disabled: 'rgba(255, 255, 255, 0.5)',
      hint: 'rgba(255, 255, 255, 0.5)',
    },
    success: {
      main: '#00c853',
      light: '#5efc82',
      dark: '#009624',
    },
    warning: {
      main: '#ffc107',
      light: '#fff350',
      dark: '#c79100',
    },
    error: {
      main: '#f44336',
      light: '#ff7961',
      dark: '#ba000d',
    },
    info: {
      main: '#03a9f4',
      light: '#67daff',
      dark: '#007ac1',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  typography: {
    fontFamily: [
      'Poppins',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0a1929',
          color: '#ffffff',
          scrollbarWidth: 'thin',
          scrollbarColor: '#132f4c #071426',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#071426',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#132f4c',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#1a3a5f',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #3a7bd5 30%, #63a4ff 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #4285f4 30%, #72aeff 90%)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(45deg, #00c853 30%, #5efc82 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #00e676 30%, #69fd8e 90%)',
          },
        },
        outlinedPrimary: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.2)',
          border: 'none',
          background: 'linear-gradient(145deg, #132f4c 0%, #0a1929 100%)',
          transition: 'all 0.3s ease-in-out',
          overflow: 'hidden',
          '&:hover': {
            transform: 'translateY(-5px)',
            boxShadow: '0 12px 28px 0 rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '24px',
          '&:last-child': {
            paddingBottom: '24px',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #0a1929 0%, #132f4c 100%)',
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(8px)',
          border: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0a1929',
          backgroundImage: 'linear-gradient(to bottom, #0a1929, #132f4c)',
          borderRight: 'none',
          boxShadow: '4px 0 24px 0 rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#132f4c',
          color: '#ffffff',
        },
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: 'none',
          backgroundImage: 'none',
          backgroundColor: '#132f4c',
        },
        elevation1: {
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.23)',
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3a7bd5',
            borderWidth: '2px',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3a7bd5',
            borderWidth: '2px',
            boxShadow: '0 0 0 3px rgba(58, 123, 213, 0.2)',
          },
          backgroundColor: 'rgba(19, 47, 76, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
        },
        input: {
          padding: '14px 16px',
          color: '#ffffff',
          '&::placeholder': {
            color: 'rgba(255, 255, 255, 0.5)',
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'rgba(255, 255, 255, 0.7)',
          '&.Mui-focused': {
            color: '#3a7bd5',
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          color: '#ffffff',
          '&.Mui-disabled': {
            color: 'rgba(255, 255, 255, 0.38)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          },
        },
        filled: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(19, 47, 76, 0.95)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.75rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.3)',
          backgroundImage: 'linear-gradient(145deg, #132f4c 0%, #0a1929 100%)',
          overflow: 'hidden',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '20px 24px',
          fontSize: '1.25rem',
          fontWeight: 600,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        },
        filledSuccess: {
          backgroundImage: 'linear-gradient(45deg, #00c853 30%, #5efc82 90%)',
        },
        filledError: {
          backgroundImage: 'linear-gradient(45deg, #f44336 30%, #ff7961 90%)',
        },
        filledWarning: {
          backgroundImage: 'linear-gradient(45deg, #ffc107 30%, #fff350 90%)',
        },
        filledInfo: {
          backgroundImage: 'linear-gradient(45deg, #03a9f4 30%, #67daff 90%)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          backgroundColor: '#132f4c',
          backgroundImage: 'linear-gradient(145deg, #132f4c 0%, #0a1929 100%)',
          backdropFilter: 'blur(8px)',
        },
        list: {
          padding: '8px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 0',
          padding: '10px 12px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(58, 123, 213, 0.1)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(58, 123, 213, 0.2)',
            '&:hover': {
              backgroundColor: 'rgba(58, 123, 213, 0.3)',
            },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: '40px',
          color: 'rgba(255, 255, 255, 0.7)',
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
