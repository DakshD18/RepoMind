import React from 'react';
import { Box, Typography, Button, Container, Grid, Card, CardContent, Avatar, AvatarGroup } from '@mui/material';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CodeIcon from '@mui/icons-material/Code';
import InsightsIcon from '@mui/icons-material/Insights';
import GitHubIcon from '@mui/icons-material/GitHub';
import ChatIcon from '@mui/icons-material/Chat';
import HistoryIcon from '@mui/icons-material/History';
import StorageIcon from '@mui/icons-material/Storage';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BoltIcon from '@mui/icons-material/Bolt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
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
        background: '#050505',
        color: '#e5e5e5',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting - subtle cyber yellow glow */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          right: '5%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '15%',
          left: '-5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.03) 0%, transparent 70%)',
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

      {/* Top Navbar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(5, 5, 5, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #262626',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <Box
              onClick={() => navigate('/')}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  background: '#111111',
                  border: '1px solid rgba(255, 210, 31, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(255, 210, 31, 0.2)',
                }}
              >
                <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 20 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  RepoMind
                </Typography>
                <Box
                  component="span"
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#ffd21f',
                    boxShadow: '0 0 6px #ffd21f',
                    display: 'inline-block',
                  }}
                />
              </Box>
            </Box>

            {/* Navigation links */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              {[
                { label: 'Features', id: 'features' },
                { label: 'How it works', id: 'how-it-works' },
              ].map((item) => (
                <Typography
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                  sx={{
                    fontSize: '0.875rem',
                    color: '#a3a3a3',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffd21f' },
                  }}
                >
                  {item.label}
                </Typography>
              ))}
            </Box>

            {/* Right Action buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              {isAuthenticated ? (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="contained"
                  endIcon={<ArrowForwardIcon fontSize="small" />}
                  sx={{
                    borderRadius: '8px',
                    background: '#ffd21f',
                    color: '#050505',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.5,
                    boxShadow: '0 2px 14px rgba(255, 210, 31, 0.3)',
                    '&:hover': {
                      background: '#ffe033',
                      boxShadow: '0 4px 20px rgba(255, 210, 31, 0.45)',
                    },
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
                      color: '#a3a3a3',
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
                      background: '#ffd21f',
                      color: '#050505',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      px: 2.5,
                      py: 0.8,
                      boxShadow: '0 2px 14px rgba(255, 210, 31, 0.3)',
                      '&:hover': {
                        background: '#ffe033',
                        boxShadow: '0 4px 20px rgba(255, 210, 31, 0.45)',
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

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 10, md: 16 }, position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} sx={{ alignItems: 'center' }}>
          {/* Left Hero Text */}
          <Grid size={{ xs: 12, md: 6 }}>
            {/* Tag badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: '20px',
                background: '#111111',
                border: '1px solid #262626',
                mb: 3,
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#ffd21f', boxShadow: '0 0 8px #ffd21f' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffd21f', letterSpacing: '0.05em' }}>
                REPOMIND INTELLIGENCE ENGINE
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.5rem', md: '3.8rem' },
                fontWeight: 900,
                lineHeight: 1.12,
                letterSpacing: '-0.03em',
                mb: 3,
                color: '#ffffff',
              }}
            >
              The Living{' '}
              <Box
                component="span"
                sx={{
                  color: '#ffd21f',
                  textShadow: '0 0 30px rgba(255, 210, 31, 0.3)',
                }}
              >
                Intelligence Layer
              </Box>
              <br />
              for Every GitHub Repository
            </Typography>

            {/* Subtitle */}
            <Typography
              sx={{
                fontSize: '1.05rem',
                color: '#a3a3a3',
                lineHeight: 1.7,
                mb: 5,
                maxWidth: 480,
              }}
            >
              Paste a link. Get instant architectural understanding, dependency maps, and an AI that knows every line of the codebase. The first stop before your first commit.
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 5 }}>
              <Box
                sx={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 210, 31, 0.4)',
                  boxShadow: '0 0 15px rgba(255, 210, 31, 0.15)',
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
              <Button
                variant="outlined"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                sx={{
                  height: 44,
                  borderRadius: '8px',
                  borderColor: '#333333',
                  background: '#111111',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#ffd21f',
                    background: '#151515',
                    color: '#ffd21f',
                  },
                }}
              >
                Learn More
              </Button>
            </Box>

            {/* Social Proof Stack */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: '0.75rem', borderColor: '#050505', background: '#1a1a1a', color: '#ffd21f' } }}>
                <Avatar alt="Dev 1" src="https://i.pravatar.cc/100?img=11" />
                <Avatar alt="Dev 2" src="https://i.pravatar.cc/100?img=33" />
                <Avatar alt="Dev 3" src="https://i.pravatar.cc/100?img=60" />
                <Avatar alt="Dev 4" src="https://i.pravatar.cc/100?img=68" />
              </AvatarGroup>
              <Typography sx={{ fontSize: '0.85rem', color: '#737373', fontWeight: 500 }}>
                Trusted by <strong style={{ color: '#ffffff' }}>10,000+</strong> developers
              </Typography>
            </Box>
          </Grid>

          {/* Right Side Hero Visual */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: '-10px',
                  background: 'radial-gradient(ellipse at center, rgba(255, 210, 31, 0.12) 0%, transparent 70%)',
                  filter: 'blur(35px)',
                  zIndex: 0,
                  pointerEvents: 'none',
                },
              }}
            >
              <Box
                component="img"
                src="/hero-modern.png"
                alt="RepoMind AI Intelligence Platform"
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  width: '100%',
                  height: 'auto',
                  borderRadius: '14px',
                  border: '1px solid #262626',
                  boxShadow: '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 210, 31, 0.08)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    borderColor: 'rgba(255, 210, 31, 0.35)',
                    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 45px rgba(255, 210, 31, 0.15)',
                  },
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Box id="features" sx={{ mt: 6, mb: 16 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.4,
                borderRadius: '20px',
                background: '#111111',
                border: '1px solid #262626',
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffd21f', letterSpacing: '0.05em' }}>
                PLATFORM CAPABILITIES
              </Typography>
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#ffffff',
                mb: 2,
                fontSize: { xs: '2rem', sm: '2.5rem' },
                letterSpacing: '-0.02em',
              }}
            >
              Everything your team needs to master any codebase
            </Typography>
            <Typography
              sx={{
                color: '#a3a3a3',
                maxWidth: 600,
                mx: 'auto',
                fontSize: '1rem',
              }}
            >
              Stop wasting hours tracing spaghetti code. Get instant, AI-powered understanding of architecture, intent, and impact.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {[
              {
                icon: <ChatIcon sx={{ color: '#ffd21f' }} />,
                title: 'Repository Intelligence',
                desc: 'Chat naturally with an entire GitHub repository. Understand authentication, APIs, business logic, dependencies, and workflows instantly.',
                tag: undefined
              },
              {
                icon: <HistoryIcon sx={{ color: '#ffd21f' }} />,
                title: 'Repository Memory',
                desc: 'Understand why decisions were made by analyzing commits, pull requests, issues, and documentation in a unified knowledge graph.',
                tag: '⭐ Flagship Feature'
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#ffd21f' }} />,
                title: 'Impact Analysis',
                desc: 'Before changing code, instantly understand what APIs, services, and modules may be affected across the system.',
                tag: undefined
              },
              {
                icon: <InsightsIcon sx={{ color: '#ffd21f' }} />,
                title: 'Repository Health Dashboard',
                desc: 'Monitor code quality, documentation, maintainability, technical debt, dependency health, and overall repository metrics.',
                tag: undefined
              },
              {
                icon: <AutoAwesomeIcon sx={{ color: '#ffd21f' }} />,
                title: 'Productivity Intelligence',
                desc: 'Automatically generate release notes, changelogs, sprint summaries, and documentation from your repository\'s history.',
                tag: undefined
              },
            ].map((f, index) => (
              <Grid size={{ xs: 12, md: index < 2 ? 6 : 4 }} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: '#111111',
                    border: '1px solid #262626',
                    borderRadius: '14px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      border: '1px solid rgba(255, 210, 31, 0.4)',
                      background: '#151515',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(255, 210, 31, 0.08)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    {f.tag && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 20,
                          right: 20,
                          background: 'rgba(255, 210, 31, 0.1)',
                          color: '#ffd21f',
                          border: '1px solid rgba(255, 210, 31, 0.3)',
                          px: 1.25,
                          py: 0.4,
                          borderRadius: '16px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        {f.tag}
                      </Box>
                    )}
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '10px',
                        background: '#1a1a1a',
                        border: '1px solid #262626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2.5,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#ffffff', mb: 1.2 }}>
                      {f.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#a3a3a3', lineHeight: 1.6 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Workflow Section */}
        <Box id="how-it-works" sx={{ mb: 16 }}>
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.4,
                borderRadius: '20px',
                background: '#111111',
                border: '1px solid #262626',
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffd21f', letterSpacing: '0.05em' }}>
                HOW IT WORKS
              </Typography>
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#ffffff',
                mb: 2,
                fontSize: { xs: '2rem', sm: '2.5rem' },
                letterSpacing: '-0.02em',
              }}
            >
              From repository URL to deep intelligence
            </Typography>
            <Typography
              sx={{
                color: '#a3a3a3',
                maxWidth: 600,
                mx: 'auto',
                fontSize: '1rem',
              }}
            >
              Zero configuration. Total comprehension.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'center', md: 'flex-start' },
              position: 'relative',
              mb: 8,
              maxWidth: 1000,
              mx: 'auto',
              gap: { xs: 4, md: 0 },
            }}
          >
            {/* The horizontal connecting line */}
            <Box
              sx={{
                display: { xs: 'none', md: 'block' },
                position: 'absolute',
                top: 28,
                left: '8%',
                right: '8%',
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 210, 31, 0.35) 50%, transparent 100%)',
                zIndex: 0,
              }}
            />

            {[
              {
                icon: <GitHubIcon sx={{ color: '#ffd21f', fontSize: 22 }} />,
                title: 'Connect GitHub',
                desc: 'Paste URL or connect repo',
              },
              {
                icon: <CodeIcon sx={{ color: '#ffd21f', fontSize: 22 }} />,
                title: 'Repository Parser',
                desc: 'AST & dependency mapping',
              },
              {
                icon: <StorageIcon sx={{ color: '#ffd21f', fontSize: 22 }} />,
                title: 'Knowledge Base',
                desc: 'Vector embeddings generation',
              },
              {
                icon: <PsychologyIcon sx={{ color: '#ffd21f', fontSize: 22 }} />,
                title: 'AI Intelligence',
                desc: 'Grounded contextual reasoning',
              },
              {
                icon: <BoltIcon sx={{ color: '#ffd21f', fontSize: 22 }} />,
                title: 'Developer Insights',
                desc: 'Instant expert codebase answers',
              },
            ].map((step, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  zIndex: 1,
                  flex: 1,
                  px: 2,
                }}
              >
                <Box sx={{ position: 'relative', mb: 2.5 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '12px',
                      background: '#111111',
                      border: '1px solid #262626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        borderColor: '#ffd21f',
                        background: '#151515',
                        boxShadow: '0 0 20px rgba(255, 210, 31, 0.2)',
                      },
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: '#050505',
                      border: '1px solid #ffd21f',
                      color: '#ffd21f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                    }}
                  >
                    {idx + 1}
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.925rem', color: '#ffffff', mb: 0.8 }}>
                  {step.title}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#737373', lineHeight: 1.4 }}>
                  {step.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* CTA Banner */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: '24px',
            background: '#0a0a0a',
            border: '1px solid #262626',
            p: { xs: 6, md: 10 },
            textAlign: 'center',
            mb: 12,
            overflow: 'hidden',
          }}
        >
          {/* Subtle Glow Background */}
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at center, rgba(255, 210, 31, 0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                color: '#ffffff',
                mb: 2.5,
                fontSize: { xs: '2.2rem', md: '3.2rem' },
                letterSpacing: '-0.02em',
              }}
            >
              Start Understanding{' '}
              <Box component="span" sx={{ color: '#ffd21f' }}>
                Your Repositories
              </Box>
            </Typography>
            <Typography sx={{ color: '#a3a3a3', mb: 5, fontSize: '1.05rem', maxWidth: 500, mx: 'auto' }}>
              Join thousands of engineering teams building better software faster with RepoMind.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  p: 0.5,
                  background: '#111111',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 210, 31, 0.4)',
                  boxShadow: '0 0 25px rgba(255, 210, 31, 0.15)',
                }}
              >
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ borderTop: '1px solid #262626', pt: 8, pb: 6 }}>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: '#111111',
                    border: '1px solid rgba(255, 210, 31, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', fontSize: '1.15rem' }}>
                  RepoMind
                </Typography>
              </Box>
              <Typography sx={{ color: '#737373', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 260 }}>
                The AI-powered codebase intelligence platform for modern engineering teams.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 600, mb: 2.5, fontSize: '0.875rem' }}>Product</Typography>
              {['Features', 'Integrations', 'Pricing', 'Changelog'].map((link) => (
                <Typography
                  key={link}
                  sx={{
                    color: '#737373',
                    fontSize: '0.85rem',
                    mb: 1.5,
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffd21f' },
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 600, mb: 2.5, fontSize: '0.875rem' }}>Resources</Typography>
              {['Documentation', 'API Reference', 'Blog', 'Community'].map((link) => (
                <Typography
                  key={link}
                  sx={{
                    color: '#737373',
                    fontSize: '0.85rem',
                    mb: 1.5,
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffd21f' },
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 600, mb: 2.5, fontSize: '0.875rem' }}>Company</Typography>
              {['About', 'Contact', 'Careers', 'Legal'].map((link) => (
                <Typography
                  key={link}
                  sx={{
                    color: '#737373',
                    fontSize: '0.85rem',
                    mb: 1.5,
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffd21f' },
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Grid>
          </Grid>
          <Box
            sx={{
              mt: 8,
              pt: 4,
              borderTop: '1px solid #1a1a1a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Typography sx={{ color: '#737373', fontSize: '0.8rem' }}>
              © 2026 RepoMind Inc. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <GitHubIcon sx={{ color: '#737373', cursor: 'pointer', transition: 'color 0.2s', '&:hover': { color: '#ffd21f' } }} />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
