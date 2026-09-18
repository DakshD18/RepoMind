import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFD21F',
      light: '#FFE033',
      dark: '#F5C400',
      contrastText: '#050505',
    },
    secondary: {
      main: '#E5E5E5',
      contrastText: '#050505',
    },
    background: {
      default: '#050505',
      paper: '#111111',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A3A3A3',
    },
    divider: '#262626',
    action: {
      hover: 'rgba(255, 210, 31, 0.08)',
      selected: 'rgba(255, 210, 31, 0.14)',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111111',
          border: '1px solid #262626',
          borderRadius: 14,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            backgroundColor: '#FFD21F',
            color: '#050505',
            fontWeight: 700,
            boxShadow: '0 2px 12px rgba(255, 210, 31, 0.25)',
            '&:hover': {
              backgroundColor: '#FFE033',
              boxShadow: '0 4px 20px rgba(255, 210, 31, 0.4)',
            },
          },
        },
        {
          props: { variant: 'outlined', color: 'primary' },
          style: {
            borderColor: 'rgba(255, 210, 31, 0.4)',
            color: '#FFD21F',
            '&:hover': {
              borderColor: '#FFD21F',
              backgroundColor: 'rgba(255, 210, 31, 0.08)',
            },
          },
        },
      ],
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111111',
                color: '#FFFFFF',
                border: '1px solid #262626',
                borderRadius: '10px',
                fontSize: '0.875rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 210, 31, 0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#FFD21F',
                  secondary: '#050505',
                },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
