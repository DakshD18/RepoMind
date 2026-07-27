import React, { useState, useEffect } from 'react';
import { Box, Card, Typography, TextField, Button, Divider, Container } from '@mui/material';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GitHubIcon from '@mui/icons-material/GitHub';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { googleLogin, githubLogin, emailLogin, emailRegister } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle GitHub OAuth Redirect Code if present in URL (?code=...)
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleGitHubCode(code);
    }
  }, [searchParams]);

  const handleGitHubCode = async (code: string) => {
    const toastId = toast.loading('Authenticating with GitHub...');
    try {
      const response = await githubLogin(code);
      login(response.tokens.access, response.tokens.refresh, response.user);
      toast.success(`Welcome back, ${response.user.first_name || 'Developer'}!`, { id: toastId });
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'GitHub authentication failed.';
      toast.error(msg, { id: toastId });
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Google login failed. Please try again.');
      return;
    }

    const toastId = toast.loading('Signing you in with Google...');
    try {
      const response = await googleLogin(credentialResponse.credential);
      login(response.tokens.access, response.tokens.refresh, response.user);
      toast.success(`Welcome back, ${response.user.first_name || 'Developer'}!`, { id: toastId });
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Google authentication failed.';
      toast.error(msg, { id: toastId });
    }
  };

  const handleGoogleError = () => {
    toast.error('Google login was cancelled or failed.');
  };

  const handleGitHubRedirect = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
    if (!clientId || clientId === 'your-github-client-id') {
      toast.error('GitHub Client ID is not configured in environment variables.');
      return;
    }
    const redirectUri = window.location.origin + '/login';
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    window.location.href = githubAuthUrl;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password.');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading(isSignUp ? 'Creating account...' : 'Signing in...');

    try {
      let response;
      if (isSignUp) {
        response = await emailRegister(email, password, firstName, lastName);
      } else {
        response = await emailLogin(email, password);
      }

      login(response.tokens.access, response.tokens.refresh, response.user);
      toast.success(`Welcome, ${response.user.first_name || 'Developer'}!`, { id: toastId });
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.error || (isSignUp ? 'Registration failed.' : 'Login failed.');
      toast.error(msg, { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: '#09090d',
        color: '#e0e0ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        py: 6,
      }}
    >
      {/* Background ambient lighting */}
      <Box
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)',
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

      {/* Back to Home Link */}
      <Box
        onClick={() => navigate('/')}
        sx={{
          position: 'absolute',
          top: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#8888aa',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
          transition: 'color 0.2s',
          '&:hover': { color: '#ffffff' },
        }}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Home
      </Box>

      {/* Login Card matching Image #2 from reference */}
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Card
          sx={{
            background: 'rgba(13, 13, 22, 0.95)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            borderRadius: '24px',
            p: { xs: 3, sm: 4 },
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(108, 99, 255, 0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(108,99,255,0.5)',
                mb: 2,
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 26 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Typography>
            <Typography sx={{ color: '#8888aa', fontSize: '0.875rem' }}>
              {isSignUp ? 'Sign up to start analysing repos with AI' : 'Sign in to continue to RepoMind'}
            </Typography>
          </Box>

          {/* Social Logins Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {/* Google OAuth Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                size="large"
                text="continue_with"
                shape="rectangular"
                width="100%"
              />
            </Box>

            {/* GitHub OAuth Button */}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GitHubIcon sx={{ color: '#ffffff' }} />}
              onClick={handleGitHubRedirect}
              sx={{
                height: 42,
                borderRadius: '8px',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              Continue with GitHub
            </Button>
          </Box>

          <Divider
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.08)',
              color: '#555577',
              fontSize: '0.75rem',
              my: 2.5,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            or continue with email
          </Divider>

          {/* Email / Password Form */}
          <Box component="form" onSubmit={handleEmailSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isSignUp && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#a0a0cc', mb: 0.8, fontWeight: 500 }}>
                    First Name
                  </Typography>
                  <TextField
                    fullWidth
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#ffffff',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '10px',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(108, 99, 255, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#6c63ff' },
                      },
                      '& input::placeholder': { color: '#555577', opacity: 1 },
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#a0a0cc', mb: 0.8, fontWeight: 500 }}>
                    Last Name
                  </Typography>
                  <TextField
                    fullWidth
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#ffffff',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '10px',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(108, 99, 255, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#6c63ff' },
                      },
                      '& input::placeholder': { color: '#555577', opacity: 1 },
                    }}
                  />
                </Box>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#a0a0cc', mb: 0.8, fontWeight: 500 }}>
                Email address
              </Typography>
              <TextField
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                variant="outlined"
                size="small"
                type="email"
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(108, 99, 255, 0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#6c63ff' },
                  },
                  '& input::placeholder': { color: '#555577', opacity: 1 },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#a0a0cc', mb: 0.8, fontWeight: 500 }}>
                Password
              </Typography>
              <TextField
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                variant="outlined"
                size="small"
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(108, 99, 255, 0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#6c63ff' },
                  },
                  '& input::placeholder': { color: '#555577', opacity: 1 },
                }}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              endIcon={<ArrowForwardIcon />}
              sx={{
                mt: 1,
                height: 44,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6c63ff 0%, #4f46e5 100%)',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.9rem',
                boxShadow: '0 4px 20px rgba(108, 99, 255, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c73ff 0%, #5f56f5 100%)',
                  boxShadow: '0 6px 25px rgba(108, 99, 255, 0.6)',
                },
                '&:disabled': { opacity: 0.6 },
              }}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </Box>

          {/* Toggle Sign In / Sign Up */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography sx={{ color: '#8888aa', fontSize: '0.825rem' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Typography
                component="span"
                onClick={() => setIsSignUp(!isSignUp)}
                sx={{
                  color: '#6c63ff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Typography>
            </Typography>
          </Box>
        </Card>
      </Container>
    </Box>
  );
};

export default LoginPage;
