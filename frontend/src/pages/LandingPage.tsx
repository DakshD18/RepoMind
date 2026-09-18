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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';

import { googleLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { HeroPreviewVisual } from '../components/HeroPreviewVisual';

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
        background: '#050507',
        color: '#e2e8f0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting - subtle cyber yellow & amber glow */}
      <Box
        sx={{
          position: 'absolute',
          top: '-15%',
          right: '8%',
          width: '750px',
          height: '750px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.08) 0%, rgba(245, 158, 11, 0.02) 45%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '-10%',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.05) 0%, transparent 70%)',
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
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 20%, #000 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 20%, #000 60%, transparent 100%)',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* Top Navbar */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(5, 5, 7, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
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
                  width: 38,
                  height: 38,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #181822 0%, #101016 100%)',
                  border: '1px solid rgba(255, 210, 31, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(255, 210, 31, 0.25)',
                }}
              >
                <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 20 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
                  RepoMind
                </Typography>
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffd21f',
                    boxShadow: '0 0 8px #ffd21f',
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
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
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
                    borderRadius: '9px',
                    background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                    color: '#050507',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2.8,
                    py: 1,
                    boxShadow: '0 4px 18px rgba(255, 210, 31, 0.35)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                      boxShadow: '0 6px 24px rgba(255, 210, 31, 0.5)',
                      transform: 'translateY(-1px)',
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
                      color: '#94a3b8',
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
                      borderRadius: '9px',
                      background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                      color: '#050507',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      px: 2.6,
                      py: 0.9,
                      boxShadow: '0 4px 18px rgba(255, 210, 31, 0.3)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                        boxShadow: '0 6px 24px rgba(255, 210, 31, 0.45)',
                        transform: 'translateY(-1px)',
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
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 11 }, pb: { xs: 8, md: 13 }, position: 'relative', zIndex: 1 }}>
        <Grid container spacing={5} sx={{ alignItems: 'center' }}>
          {/* Left Hero Text */}
          <Grid size={{ xs: 12, lg: 5.5 }}>
            {/* Tag badge with live pulse */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.6,
                py: 0.6,
                borderRadius: '24px',
                background: 'rgba(255, 210, 31, 0.08)',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                mb: 3,
                boxShadow: '0 0 16px rgba(255, 210, 31, 0.08)',
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ffd21f',
                  boxShadow: '0 0 10px #ffd21f',
                  animation: 'pulseGlow 2s infinite',
                }}
              />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ffd21f', letterSpacing: '0.06em' }}>
                REPO MIND INTELLIGENCE ENGINE 3.5
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.4rem', md: '3.9rem' },
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: '-0.035em',
                mb: 2.8,
                color: '#ffffff',
              }}
            >
              The Living{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 60%, #fbbf24 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
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
                color: '#94a3b8',
                lineHeight: 1.7,
                mb: 4.5,
                maxWidth: 480,
              }}
            >
              Paste a link. Get instant architectural understanding, dependency maps, and an AI that knows every line of the codebase. The first stop before your first commit.
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 5 }}>
              <Box
                sx={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 210, 31, 0.4)',
                  boxShadow: '0 0 20px rgba(255, 210, 31, 0.18)',
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
                  borderRadius: '10px',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  background: 'rgba(18, 18, 24, 0.6)',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#ffd21f',
                    background: 'rgba(255, 210, 31, 0.08)',
                    color: '#ffd21f',
                  },
                }}
              >
                Learn More
              </Button>
            </Box>

            {/* Social Proof Stack */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    fontSize: '0.75rem',
                    borderColor: '#050507',
                    background: '#181822',
                    color: '#ffd21f',
                  },
                }}
              >
                <Avatar alt="Dev 1" src="https://i.pravatar.cc/100?img=11" />
                <Avatar alt="Dev 2" src="https://i.pravatar.cc/100?img=33" />
                <Avatar alt="Dev 3" src="https://i.pravatar.cc/100?img=60" />
                <Avatar alt="Dev 4" src="https://i.pravatar.cc/100?img=68" />
              </AvatarGroup>
              <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                Trusted by <strong style={{ color: '#ffffff' }}>10,000+</strong> developers
              </Typography>
            </Box>
          </Grid>

          {/* Right Side Hero Visual: REPLACED WITH LIVE INTERACTIVE COMMAND CENTER */}
          <Grid size={{ xs: 12, lg: 6.5 }}>
            <HeroPreviewVisual />
          </Grid>
        </Grid>
      </Container>

      {/* Platform Metrics Strip */}
      <Box
        sx={{
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          background: 'rgba(10, 10, 14, 0.6)',
          backdropFilter: 'blur(12px)',
          py: 4,
          mb: { xs: 10, md: 14 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {[
              { label: 'Grounding Precision', value: '100%', sub: 'Zero hallucinated citations', icon: <CheckCircleIcon sx={{ color: '#ffd21f' }} /> },
              { label: 'Vector Retrieval', value: '< 350ms', sub: 'pgvector multi-stage hybrid search', icon: <SpeedIcon sx={{ color: '#ffd21f' }} /> },
              { label: 'Codebase Memory', value: '100+ Commits', sub: 'Indexed GitHub history & authors', icon: <HistoryIcon sx={{ color: '#ffd21f' }} /> },
              { label: 'Security & Isolation', value: 'AST Grounded', sub: 'Per-repository cryptographic safety', icon: <SecurityIcon sx={{ color: '#ffd21f' }} /> },
            ].map((stat) => (
              <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
                <Box sx={{ px: { xs: 1, sm: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                    {stat.icon}
                    <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {stat.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: { xs: '1.4rem', sm: '1.8rem' }, fontWeight: 800, color: '#ffffff', mb: 0.3 }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {stat.sub}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        <Box id="features" sx={{ mb: 16 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.6,
                py: 0.5,
                borderRadius: '20px',
                background: 'rgba(255, 210, 31, 0.08)',
                border: '1px solid rgba(255, 210, 31, 0.25)',
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffd21f', letterSpacing: '0.06em' }}>
                PLATFORM CAPABILITIES
              </Typography>
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#ffffff',
                mb: 2,
                fontSize: { xs: '2rem', sm: '2.6rem' },
                letterSpacing: '-0.025em',
              }}
            >
              Everything your team needs to master any codebase
            </Typography>
            <Typography
              sx={{
                color: '#94a3b8',
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
                tag: undefined,
              },
              {
                icon: <HistoryIcon sx={{ color: '#ffd21f' }} />,
                title: 'Repository Memory',
                desc: 'Understand why decisions were made by analyzing commits, pull requests, issues, and documentation in a unified knowledge graph.',
                tag: '⭐ Flagship Feature',
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#ffd21f' }} />,
                title: 'Impact Analysis',
                desc: 'Before changing code, instantly understand what APIs, services, and modules may be affected across the system.',
                tag: undefined,
              },
              {
                icon: <InsightsIcon sx={{ color: '#ffd21f' }} />,
                title: 'Repository Health Dashboard',
                desc: 'Monitor code quality, documentation, maintainability, technical debt, dependency health, and overall repository metrics.',
                tag: undefined,
              },
              {
                icon: <AutoAwesomeIcon sx={{ color: '#ffd21f' }} />,
                title: 'Productivity Intelligence',
                desc: 'Automatically generate release notes, changelogs, sprint summaries, and documentation from your repository\'s history.',
                tag: undefined,
              },
            ].map((f, index) => (
              <Grid size={{ xs: 12, md: index < 2 ? 6 : 4 }} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(18, 18, 24, 0.65)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      border: '1px solid rgba(255, 210, 31, 0.45)',
                      background: 'rgba(24, 24, 32, 0.8)',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(255, 210, 31, 0.12)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3.8 }}>
                    {f.tag && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 20,
                          right: 20,
                          background: 'rgba(255, 210, 31, 0.12)',
                          color: '#ffd21f',
                          border: '1px solid rgba(255, 210, 31, 0.35)',
                          px: 1.4,
                          py: 0.45,
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
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        background: '#12121a',
                        border: '1px solid rgba(255, 210, 31, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2.8,
                        boxShadow: '0 0 16px rgba(255, 210, 31, 0.1)',
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#ffffff', mb: 1.2 }}>
                      {f.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.65 }}>
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
                px: 1.6,
                py: 0.5,
                borderRadius: '20px',
                background: 'rgba(255, 210, 31, 0.08)',
                border: '1px solid rgba(255, 210, 31, 0.25)',
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffd21f', letterSpacing: '0.06em' }}>
                HOW IT WORKS
              </Typography>
            </Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#ffffff',
                mb: 2,
                fontSize: { xs: '2rem', sm: '2.6rem' },
                letterSpacing: '-0.025em',
              }}
            >
              From repository URL to deep intelligence
            </Typography>
            <Typography
              sx={{
                color: '#94a3b8',
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
              maxWidth: 1050,
              mx: 'auto',
              gap: { xs: 4, md: 0 },
            }}
          >
            {/* Horizontal illuminated connecting beam */}
            <Box
              sx={{
                display: { xs: 'none', md: 'block' },
                position: 'absolute',
                top: 28,
                left: '8%',
                right: '8%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 210, 31, 0.5) 50%, transparent 100%)',
                zIndex: 0,
              }}
            />

            {[
              {
                icon: <GitHubIcon sx={{ color: '#ffd21f', fontSize: 24 }} />,
                title: 'Connect GitHub',
                desc: 'Paste URL or connect repo',
              },
              {
                icon: <CodeIcon sx={{ color: '#ffd21f', fontSize: 24 }} />,
                title: 'Repository Parser',
                desc: 'AST & dependency mapping',
              },
              {
                icon: <StorageIcon sx={{ color: '#ffd21f', fontSize: 24 }} />,
                title: 'Knowledge Base',
                desc: 'pgvector embeddings generation',
              },
              {
                icon: <PsychologyIcon sx={{ color: '#ffd21f', fontSize: 24 }} />,
                title: 'AI Intelligence',
                desc: 'Grounded contextual reasoning',
              },
              {
                icon: <BoltIcon sx={{ color: '#ffd21f', fontSize: 24 }} />,
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
                      width: 60,
                      height: 60,
                      borderRadius: '14px',
                      background: '#121218',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      '&:hover': {
                        transform: 'scale(1.08)',
                        borderColor: '#ffd21f',
                        background: '#181822',
                        boxShadow: '0 0 25px rgba(255, 210, 31, 0.3)',
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
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#050507',
                      border: '1.5px solid #ffd21f',
                      color: '#ffd21f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    {idx + 1}
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', mb: 0.8 }}>
                  {step.title}
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45 }}>
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
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.8) 0%, rgba(12, 12, 16, 0.95) 100%)',
            border: '1px solid rgba(255, 210, 31, 0.25)',
            p: { xs: 6, md: 9 },
            textAlign: 'center',
            mb: 12,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 210, 31, 0.08)',
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
              background: 'radial-gradient(circle at center, rgba(255, 210, 31, 0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                color: '#ffffff',
                mb: 2.2,
                fontSize: { xs: '2.2rem', md: '3.2rem' },
                letterSpacing: '-0.025em',
              }}
            >
              Start Understanding{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Your Repositories
              </Box>
            </Typography>
            <Typography sx={{ color: '#94a3b8', mb: 4.5, fontSize: '1.05rem', maxWidth: 520, mx: 'auto' }}>
              Join thousands of engineering teams building better software faster with RepoMind.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  p: 0.5,
                  background: '#121218',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 210, 31, 0.4)',
                  boxShadow: '0 0 30px rgba(255, 210, 31, 0.2)',
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
        <Box component="footer" sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', pt: 8, pb: 6 }}>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: '#121218',
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
              <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.65, maxWidth: 280 }}>
                The AI-powered codebase intelligence platform for modern engineering teams.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f', boxShadow: '0 0 8px #27c93f' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                  All Systems Operational
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 600, mb: 2.5, fontSize: '0.875rem' }}>Product</Typography>
              {['Features', 'Integrations', 'Pricing', 'Changelog'].map((link) => (
                <Typography
                  key={link}
                  sx={{
                    color: '#94a3b8',
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
                    color: '#94a3b8',
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
                    color: '#94a3b8',
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
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>
              © 2026 RepoMind Inc. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <GitHubIcon
                sx={{
                  color: '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { color: '#ffd21f', transform: 'scale(1.1)' },
                }}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
