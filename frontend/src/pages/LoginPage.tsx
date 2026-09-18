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
        background: '#050507',
        color: '#e2e8f0',
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
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '750px',
          height: '750px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.08) 0%, rgba(245, 158, 11, 0.02) 45%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
        }}
      />

      {/* Modern subtle cyber dot overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
          opacity: 0.5,
        }}
      />

      {/* Back to Home Link */}
      <Box
        onClick={() => navigate('/')}
        sx={{
          position: 'absolute',
          top: 28,
          left: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          '&:hover': { color: '#ffd21f', transform: 'translateX(-2px)' },
        }}
      >
        <ArrowBackIcon fontSize="small" />
        Back to Home
      </Box>

      {/* Login Card */}
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Card
          sx={{
            background: 'rgba(18, 18, 24, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            p: { xs: 3.5, sm: 4.5 },
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.85), 0 0 35px rgba(255, 210, 31, 0.06)',
          }}
        >
          {/* Logo Header */}
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #181824 0%, #101016 100%)',
                border: '1px solid rgba(255, 210, 31, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(255, 210, 31, 0.25)',
                mb: 2,
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 24 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.025em', mb: 0.6 }}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>
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
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
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
                height: 44,
                borderRadius: '10px',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                background: 'rgba(20, 20, 28, 0.6)',
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: 'rgba(28, 28, 38, 0.9)',
                  borderColor: 'rgba(255, 210, 31, 0.4)',
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
              borderColor: 'rgba(255, 255, 255, 0.08)',
              color: '#64748b',
              fontSize: '0.7rem',
              my: 2.8,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontWeight: 700,
            }}
          >
            or continue with email
          </Divider>

          {/* Email / Password Form */}
          <Box component="form" onSubmit={handleEmailSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isSignUp && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mb: 0.8, fontWeight: 600 }}>
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
                        background: 'rgba(10, 10, 14, 0.85)',
                        borderRadius: '10px',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                      },
                      '& input::placeholder': { color: '#64748b', opacity: 1 },
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mb: 0.8, fontWeight: 600 }}>
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
                        background: 'rgba(10, 10, 14, 0.85)',
                        borderRadius: '10px',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                      },
                      '& input::placeholder': { color: '#64748b', opacity: 1 },
                    }}
                  />
                </Box>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mb: 0.8, fontWeight: 600 }}>
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
                    background: 'rgba(10, 10, 14, 0.85)',
                    borderRadius: '10px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                  },
                  '& input::placeholder': { color: '#64748b', opacity: 1 },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mb: 0.8, fontWeight: 600 }}>
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
                    background: 'rgba(10, 10, 14, 0.85)',
                    borderRadius: '10px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                  },
                  '& input::placeholder': { color: '#64748b', opacity: 1 },
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
                mt: 1.2,
                height: 44,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                color: '#050507',
                fontWeight: 800,
                textTransform: 'none',
                fontSize: '0.925rem',
                boxShadow: '0 4px 18px rgba(255, 210, 31, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                  boxShadow: '0 6px 24px rgba(255, 210, 31, 0.45)',
                },
                '&:disabled': { opacity: 0.5 },
              }}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </Box>

          {/* Toggle Sign In / Sign Up */}
          <Box sx={{ textAlign: 'center', mt: 3.5 }}>
            <Typography sx={{ color: '#64748b', fontSize: '0.85rem' }}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <Typography
                component="span"
                onClick={() => setIsSignUp(!isSignUp)}
                sx={{
                  color: '#ffd21f',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
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
