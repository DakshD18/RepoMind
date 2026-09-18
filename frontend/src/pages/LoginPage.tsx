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
        background: '#050505',
        color: '#e5e5e5',
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
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
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
          color: '#a3a3a3',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
          transition: 'color 0.2s',
          '&:hover': { color: '#ffd21f' },
        }}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Home
      </Box>

      {/* Login Card */}
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Card
          sx={{
            background: '#111111',
            border: '1px solid #262626',
            borderRadius: '16px',
            p: { xs: 3, sm: 4 },
            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 25px rgba(255, 210, 31, 0.05)',
          }}
        >
          {/* Logo Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: '#161616',
                border: '1px solid rgba(255, 210, 31, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 210, 31, 0.15)',
                mb: 2,
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 22 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', mb: 0.5 }}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Typography>
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.85rem' }}>
              {isSignUp ? 'Sign up to start analysing repos with AI' : 'Sign in to continue to RepoMind'}
            </Typography>
          </Box>

          {/* Social Logins Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {/* Google OAuth Button */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                '& > div': { width: '100% !important', display: 'flex', justifyContent: 'center' },
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

            {/* GitHub OAuth Button */}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<GitHubIcon sx={{ color: '#ffffff' }} />}
              onClick={handleGitHubRedirect}
              sx={{
                height: 40,
                borderRadius: '8px',
                borderColor: '#262626',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: '#151515',
                transition: 'all 0.15s ease',
                '&:hover': {
                  background: '#1a1a1a',
                  borderColor: '#333333',
                  color: '#ffd21f',
                  '& .MuiButton-startIcon': { color: '#ffd21f' },
                },
              }}
            >
              Continue with GitHub
            </Button>
          </Box>

          <Divider
            sx={{
              borderColor: '#262626',
              color: '#737373',
              fontSize: '0.7rem',
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
                  <Typography sx={{ fontSize: '0.78rem', color: '#a3a3a3', mb: 0.8, fontWeight: 500 }}>
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
                        background: '#0a0a0a',
                        borderRadius: '8px',
                        '& fieldset': { borderColor: '#262626' },
                        '&:hover fieldset': { borderColor: '#333333' },
                        '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                      },
                      '& input::placeholder': { color: '#737373', opacity: 1 },
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#a3a3a3', mb: 0.8, fontWeight: 500 }}>
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
                        background: '#0a0a0a',
                        borderRadius: '8px',
                        '& fieldset': { borderColor: '#262626' },
                        '&:hover fieldset': { borderColor: '#333333' },
                        '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                      },
                      '& input::placeholder': { color: '#737373', opacity: 1 },
                    }}
                  />
                </Box>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: '#a3a3a3', mb: 0.8, fontWeight: 500 }}>
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
                    background: '#0a0a0a',
                    borderRadius: '8px',
                    '& fieldset': { borderColor: '#262626' },
                    '&:hover fieldset': { borderColor: '#333333' },
                    '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                  },
                  '& input::placeholder': { color: '#737373', opacity: 1 },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: '#a3a3a3', mb: 0.8, fontWeight: 500 }}>
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
                    background: '#0a0a0a',
                    borderRadius: '8px',
                    '& fieldset': { borderColor: '#262626' },
                    '&:hover fieldset': { borderColor: '#333333' },
                    '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                  },
                  '& input::placeholder': { color: '#737373', opacity: 1 },
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
                height: 42,
                borderRadius: '8px',
                background: '#ffd21f',
                color: '#050505',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.9rem',
                boxShadow: '0 2px 14px rgba(255, 210, 31, 0.3)',
                '&:hover': {
                  background: '#ffe033',
                  boxShadow: '0 4px 20px rgba(255, 210, 31, 0.45)',
                },
                '&:disabled': { opacity: 0.5 },
              }}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </Box>

          {/* Toggle Sign In / Sign Up */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography sx={{ color: '#737373', fontSize: '0.825rem' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Typography
                component="span"
                onClick={() => setIsSignUp(!isSignUp)}
                sx={{
                  color: '#ffd21f',
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
