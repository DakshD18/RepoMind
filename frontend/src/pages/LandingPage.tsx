import { Box, Typography, Container, Chip } from '@mui/material';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { googleLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CodeIcon from '@mui/icons-material/Code';
import InsightsIcon from '@mui/icons-material/Insights';

const FeatureChip = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <Chip
    icon={<Box sx={{ color: '#6c63ff !important', display: 'flex' }}>{icon}</Box>}
    label={label}
    sx={{
      background: 'rgba(108, 99, 255, 0.1)',
      border: '1px solid rgba(108, 99, 255, 0.2)',
      color: '#e0e0ff',
      fontSize: '0.85rem',
      py: 0.5,
      '& .MuiChip-icon': { color: '#6c63ff' },
    }}
  />
);

const LandingPage = () => {
  const { login } = useAuth();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Google login failed. Please try again.');
      return;
    }

    const toastId = toast.loading('Signing you in...');
    try {
      const response = await googleLogin(credentialResponse.credential);
      login(response.tokens.access, response.tokens.refresh, response.user);
      toast.success(`Welcome, ${response.user.first_name}!`, { id: toastId });
    } catch (error) {
      toast.error('Authentication failed. Please try again.', { id: toastId });
      console.error('Google login error:', error);
    }
  };

  const handleGoogleError = () => {
    toast.error('Google login was cancelled or failed.');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12101f 50%, #0d0d1a 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Background orbs */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          left: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,200,150,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(108,99,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(108,99,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center', py: 8 }}>

        {/* Badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            background: 'rgba(108, 99, 255, 0.15)',
            border: '1px solid rgba(108, 99, 255, 0.3)',
            borderRadius: '50px',
            px: 2,
            py: 0.75,
            mb: 4,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#6c63ff' }} />
          <Typography sx={{ fontSize: '0.8rem', color: '#a0a0cc', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Phase 1 — Repository Intelligence
          </Typography>
        </Box>

        {/* Headline */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.8rem', md: '4.5rem' },
            fontWeight: 800,
            lineHeight: 1.1,
            mb: 3,
            background: 'linear-gradient(135deg, #ffffff 30%, #6c63ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.02em',
          }}
        >
          Understand any
          <br />
          GitHub Repository
          <br />
          <Box
            component="span"
            sx={{
              background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            instantly.
          </Box>
        </Typography>

        {/* Subheading */}
        <Typography
          sx={{
            fontSize: { xs: '1rem', md: '1.2rem' },
            color: '#8888aa',
            mb: 5,
            maxWidth: '520px',
            mx: 'auto',
            lineHeight: 1.7,
          }}
        >
          Paste a GitHub URL and get instant insights — file structure, language breakdown,
          commit history, and more. Built for developers who want to understand code fast.
        </Typography>

        {/* Feature chips */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            justifyContent: 'center',
            mb: 6,
          }}
        >
          <FeatureChip icon={<CodeIcon fontSize="small" />} label="Language Detection" />
          <FeatureChip icon={<AccountTreeIcon fontSize="small" />} label="File Structure" />
          <FeatureChip icon={<InsightsIcon fontSize="small" />} label="Commit Analysis" />
          <FeatureChip icon={<AutoAwesomeIcon fontSize="small" />} label="Instant Metadata" />
        </Box>

        {/* Google Login Button */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box
            sx={{
              p: '2px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6c63ff, #00c896)',
              boxShadow: '0 0 40px rgba(108,99,255,0.3)',
              transition: 'box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: '0 0 60px rgba(108,99,255,0.5)',
              },
            }}
          >
            <Box
              sx={{
                background: '#12101f',
                borderRadius: '10px',
                px: 1,
                py: 0.5,
              }}
            >
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                size="large"
                text="continue_with"
                shape="rectangular"
              />
            </Box>
          </Box>

          <Typography sx={{ fontSize: '0.75rem', color: '#555577' }}>
            No password required. Secured with Google OAuth 2.0.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
