import React from 'react';
import { Box, Typography, Button, Container, Grid, Card, CardContent, Avatar, AvatarGroup } from '@mui/material';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CodeIcon from '@mui/icons-material/Code';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import GitHubIcon from '@mui/icons-material/GitHub';
import { googleLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error('Google login failed. Please try again.');
      return;
    }

    const toastId = toast.loading('Signing you in...');
    try {
      const response = await googleLogin(credentialResponse.credential);
      login(response.tokens.access, response.tokens.refresh, response.user);
      toast.success(`Welcome back, ${response.user.first_name || 'Developer'}!`, { id: toastId });
      navigate('/dashboard');
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
        background: '#09090d',
        color: '#e0e0ff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          right: '5%',
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
          bottom: '10%',
          left: '-5%',
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

      {/* Top Navbar matching Screenshot #3 */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(9, 9, 13, 0.8)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(108,99,255,0.4)',
                }}
              >
                <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                RepoMind
              </Typography>
            </Box>

            {/* Navigation links */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              {['Features', 'How it works', 'Testimonials', 'Pricing'].map((item) => (
                <Typography
                  key={item}
                  sx={{
                    fontSize: '0.9rem',
                    color: '#a0a0cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {item}
                </Typography>
              ))}
            </Box>

            {/* Right Action buttons matching Screenshot #3 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              {isAuthenticated ? (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="contained"
                  sx={{
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6c63ff, #5a52e0)',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2.5,
                  }}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Typography
                    onClick={() => navigate('/login')}
                    sx={{
                      fontSize: '0.875rem',
                      color: '#a0a0cc',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'color 0.2s',
                      '&:hover': { color: '#ffffff' },
                    }}
                  >
                    Log in
                  </Typography>

                  <Button
                    onClick={() => navigate('/login')}
                    variant="contained"
                    sx={{
                      borderRadius: '8px',
                      background: '#ffffff',
                      color: '#09090d',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      px: 2.5,
                      py: 0.8,
                      '&:hover': {
                        background: '#e0e0ff',
                      },
                    }}
                  >
                    Get Started →
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section matching Screenshot #3 */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 10, md: 16 }, position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} sx={{ alignItems: 'center' }}>
          {/* Left Hero Text */}
          <Grid size={{ xs: 12, md: 6 }}>
            {/* Version Pill */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                background: 'rgba(108, 99, 255, 0.12)',
                border: '1px solid rgba(108, 99, 255, 0.25)',
                borderRadius: '50px',
                px: 2,
                py: 0.6,
                mb: 3,
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#6c63ff', boxShadow: '0 0 8px #6c63ff' }} />
              <Typography sx={{ fontSize: '0.8rem', color: '#b0b0ee', fontWeight: 600 }}>
                RepoMind 2.0 is now live
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                mb: 3,
                color: '#ffffff',
              }}
            >
              Understand Any
              <br />
              GitHub Repository
              <br />
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                in Minutes.
              </Box>
            </Typography>

            {/* Subtitle */}
            <Typography
              sx={{
                fontSize: '1.1rem',
                color: '#8888aa',
                lineHeight: 1.7,
                mb: 5,
                maxWidth: 480,
              }}
            >
              Paste a link. Get instant architectural understanding, dependency maps, and an AI that knows every line of the codebase. The first stop before your first commit.
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 5 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                size="large"
                text="continue_with"
                shape="rectangular"
              />
              <Button
                variant="outlined"
                sx={{
                  height: 44,
                  borderRadius: '8px',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#e0e0ff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  '&:hover': {
                    borderColor: 'rgba(108, 99, 255, 0.5)',
                    background: 'rgba(108, 99, 255, 0.08)',
                  },
                }}
              >
                Learn More
              </Button>
            </Box>

            {/* Social Proof Stack */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: '0.75rem', borderColor: '#09090d' } }}>
                <Avatar alt="Dev 1" src="https://i.pravatar.cc/100?img=11" />
                <Avatar alt="Dev 2" src="https://i.pravatar.cc/100?img=33" />
                <Avatar alt="Dev 3" src="https://i.pravatar.cc/100?img=60" />
                <Avatar alt="Dev 4" src="https://i.pravatar.cc/100?img=68" />
              </AvatarGroup>
              <Typography sx={{ fontSize: '0.85rem', color: '#777799', fontWeight: 500 }}>
                Trusted by <strong style={{ color: '#e0e0ff' }}>10,000+</strong> developers
              </Typography>
            </Box>
          </Grid>

          {/* Right Side Glass Window Mockup matching Screenshot #3 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                position: 'relative',
                borderRadius: '20px',
                background: '#0d0d16',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(108, 99, 255, 0.15)',
                overflow: 'hidden',
              }}
            >
              {/* Window Header */}
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ef5350' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ffb703' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#00c896' }} />
                </Box>
                <Box
                  sx={{
                    mx: 'auto',
                    px: 2,
                    py: 0.4,
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    maxWidth: 240,
                  }}
                >
                  <GitHubIcon sx={{ fontSize: 14, color: '#6c63ff' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#8888aa' }}>
                    https://github.com/facebook/react
                  </Typography>
                </Box>
              </Box>

              {/* Window Canvas Graphics (Network Graph Visualizer Mockup) */}
              <Box
                sx={{
                  height: 320,
                  position: 'relative',
                  background: 'radial-gradient(circle at 50% 50%, #131224 0%, #0c0c14 100%)',
                  p: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Simulated Nodes & Glowing Connectors */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.8,
                    background: `
                      radial-gradient(circle at 30% 40%, rgba(108, 99, 255, 0.3) 0%, transparent 40%),
                      radial-gradient(circle at 70% 60%, rgba(0, 200, 150, 0.2) 0%, transparent 40%)
                    `,
                  }}
                />

                {/* SVG Graph Lines */}
                <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                  <line x1="20%" y1="30%" x2="50%" y2="50%" stroke="rgba(108, 99, 255, 0.4)" strokeWidth="1.5" strokeDasharray="4 2" />
                  <line x1="80%" y1="30%" x2="50%" y2="50%" stroke="rgba(108, 99, 255, 0.4)" strokeWidth="1.5" />
                  <line x1="50%" y1="50%" x2="35%" y2="75%" stroke="rgba(0, 200, 150, 0.4)" strokeWidth="1.5" />
                  <line x1="50%" y1="50%" x2="65%" y2="80%" stroke="rgba(108, 99, 255, 0.4)" strokeWidth="1.5" />
                </svg>

                {/* Node Circles */}
                <Box sx={{ position: 'absolute', top: '28%', left: '18%', p: 1, borderRadius: '50%', background: 'rgba(108,99,255,0.2)', border: '1px solid #6c63ff' }}>
                  <CodeIcon sx={{ fontSize: 16, color: '#6c63ff' }} />
                </Box>
                <Box sx={{ position: 'absolute', top: '28%', right: '18%', p: 1, borderRadius: '50%', background: 'rgba(0,200,150,0.2)', border: '1px solid #00c896' }}>
                  <AccountTreeIcon sx={{ fontSize: 16, color: '#00c896' }} />
                </Box>
                <Box sx={{ position: 'absolute', top: '46%', left: '46%', p: 1.5, borderRadius: '50%', background: 'rgba(108,99,255,0.4)', border: '2px solid #6c63ff', boxShadow: '0 0 20px #6c63ff' }}>
                  <AutoAwesomeIcon sx={{ fontSize: 24, color: '#fff' }} />
                </Box>

                {/* Floating Alert Box matching Screenshot #3 */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    right: 20,
                    p: 2,
                    borderRadius: '12px',
                    background: 'rgba(18, 18, 28, 0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(108, 99, 255, 0.3)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(108,99,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AutoAwesomeIcon sx={{ color: '#6c63ff', fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.825rem', fontWeight: 700, color: '#ffffff' }}>
                      Architecture Analysis Complete
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8888aa' }}>
                      Identified 4 main modules. The reconciliation engine tightly couples with the fiber tree.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Feature Cards Grid */}
        <Box sx={{ mt: 16 }}>
          <Typography
            sx={{
              textAlign: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#6c63ff',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            POWERFUL FEATURES
          </Typography>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: '#ffffff',
              mb: 8,
              fontSize: { xs: '1.8rem', sm: '2.5rem' },
            }}
          >
            Everything you need to master codebases
          </Typography>

          <Grid container spacing={3}>
            {[
              {
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Architecture Mapping',
                desc: 'Instantly visualize files, folder structures, and high-level module relationships.',
              },
              {
                icon: <CodeIcon sx={{ color: '#00c896' }} />,
                title: 'Language Intelligence',
                desc: 'Automatic extension scanning and language breakdown across all project files.',
              },
              {
                icon: <InsightsIcon sx={{ color: '#ffb703' }} />,
                title: 'Commit History Tracking',
                desc: 'Inspect last commit timestamps, branch count, and maintainer activity.',
              },
              {
                icon: <SecurityIcon sx={{ color: '#ef5350' }} />,
                title: 'Security & Health Auditing',
                desc: 'Identify technical debt, large directory hot spots, and structural complexity.',
              },
            ].map((f) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '16px',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      border: '1px solid rgba(108, 99, 255, 0.3)',
                      background: 'rgba(108, 99, 255, 0.05)',
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', mb: 1 }}>
                      {f.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#8888aa', lineHeight: 1.6 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
