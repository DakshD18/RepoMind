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
import ChatIcon from '@mui/icons-material/Chat';
import HistoryIcon from '@mui/icons-material/History';
import StorageIcon from '@mui/icons-material/Storage';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BoltIcon from '@mui/icons-material/Bolt';
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
              {[
                { label: 'Features', id: 'features' },
                { label: 'How it works', id: 'how-it-works' },
              ].map((item) => (
                <Typography
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                  sx={{
                    fontSize: '0.9rem',
                    color: '#a0a0cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {item.label}
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

          {/* Right Side Image */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              component="img"
              src="/hero-graph.png"
              alt="Network Graph Visualization"
              sx={{
                width: '100%',
                height: 'auto',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(108, 99, 255, 0.15)',
              }}
            />
          </Grid>
        </Grid>

      </Container>

      {/* New Sections Container */}
      <Container maxWidth="lg" sx={{ pb: { xs: 10, md: 16 } }}>
        {/* Features Section */}
        <Box id="features" sx={{ mt: 10, mb: 20 }}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: '#ffffff',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem' },
            }}
          >
            Everything your team needs to master any codebase
          </Typography>
          <Typography
            sx={{
              textAlign: 'center',
              color: '#8888aa',
              mb: 8,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Stop wasting hours tracing spaghetti code. Get instant, AI-powered understanding of architecture, intent, and impact.
          </Typography>

          <Grid container spacing={3}>
            {[
              {
                icon: <ChatIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Intelligence',
                desc: 'Chat naturally with an entire GitHub repository. Understand authentication, APIs, business logic, dependencies, and workflows instantly.',
                tag: undefined
              },
              {
                icon: <HistoryIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Memory',
                desc: 'Understand why decisions were made by analyzing commits, pull requests, issues, and documentation in a unified knowledge graph.',
                tag: '⭐ Flagship Feature'
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Impact Analysis',
                desc: 'Before changing code, instantly understand what APIs, services, and modules may be affected across the system.',
                tag: undefined
              },
              {
                icon: <InsightsIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Health',
                desc: 'Monitor code quality, documentation, maintainability, technical debt, dependency health, and overall repository metrics.',
                tag: undefined
              },
              {
                icon: <AutoAwesomeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Productivity Intelligence',
                desc: 'Automatically generate release notes, changelogs, sprint summaries, and documentation from your repository\'s history.',
                tag: undefined
              },
            ].map((f, index) => (
              <Grid size={{ xs: 12, md: index < 2 ? 6 : 4 }} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    '&:hover': {
                      border: '1px solid rgba(108, 99, 255, 0.3)',
                      background: 'rgba(108, 99, 255, 0.05)',
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    {f.tag && (
                      <Box sx={{ position: 'absolute', top: 24, right: 24, background: 'rgba(255, 215, 0, 0.1)', color: '#ffd700', px: 1.5, py: 0.5, borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {f.tag}
                      </Box>
                    )}
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        background: 'rgba(108, 99, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                      }}
                    >
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#fff', mb: 1.5 }}>
                      {f.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: '#8888aa', lineHeight: 1.6 }}>
                      {f.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Workflow Section */}
        <Box id="how-it-works" sx={{ mb: 20 }}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: '#ffffff',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem' },
            }}
          >
            From repository URL to deep intelligence
          </Typography>
          <Typography
            sx={{
              textAlign: 'center',
              color: '#8888aa',
              mb: 12,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Zero configuration. Total comprehension.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'center', md: 'flex-start' }, position: 'relative', mb: 10, maxWidth: 1000, mx: 'auto', gap: { xs: 4, md: 0 } }}>
            {/* The horizontal connecting line */}
            <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 32, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, rgba(108, 99, 255, 0) 0%, rgba(108, 99, 255, 0.4) 50%, rgba(108, 99, 255, 0) 100%)', zIndex: 0 }} />
            
            {[
              {
                icon: <GitHubIcon sx={{ color: '#6c63ff' }} />,
                title: 'Connect GitHub',
                desc: 'Paste URL or install app',
              },
              {
                icon: <CodeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Parser',
                desc: 'AST & dependency analysis',
              },
              {
                icon: <StorageIcon sx={{ color: '#6c63ff' }} />,
                title: 'Knowledge Base',
                desc: 'Vector graph generation',
              },
              {
                icon: <PsychologyIcon sx={{ color: '#6c63ff' }} />,
                title: 'AI Intelligence',
                desc: 'Contextual processing',
              },
              {
                icon: <BoltIcon sx={{ color: '#6c63ff' }} />,
                title: 'Developer Insights',
                desc: 'Instant expert answers',
              }
            ].map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 1, flex: 1, px: 2 }}>
                <Box sx={{ position: 'relative', mb: 3 }}>
                  <Box sx={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s', '&:hover': { transform: 'scale(1.05)', border: '1px solid rgba(108, 99, 255, 0.3)', background: 'rgba(108, 99, 255, 0.05)' } }}>
                    {step.icon}
                  </Box>
                  <Box sx={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', color: '#b0b0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    {idx + 1}
                  </Box>
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', mb: 1 }}>{step.title}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#8888aa', lineHeight: 1.4 }}>{step.desc}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ textAlign: 'center', mt: 16 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mb: 2, fontSize: { xs: '1.75rem', sm: '2rem' } }}>Ask anything about the codebase</Typography>
            <Typography sx={{ color: '#8888aa', maxWidth: 600, mx: 'auto', fontSize: '0.95rem' }}>Natural language queries, instant expert answers backed by real code references.</Typography>
          </Box>
        </Box>

        {/* Modern CTA Banner */}
        <Box
          id="pricing"
          sx={{
            position: 'relative',
            borderRadius: '32px',
            background: '#0d0d14',
            border: '1px solid rgba(108, 99, 255, 0.15)',
            p: { xs: 8, md: 12 },
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
              background: 'radial-gradient(circle at center, rgba(108, 99, 255, 0.15) 0%, rgba(108, 99, 255, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                color: '#ffffff',
                mb: 3,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                letterSpacing: '-0.02em',
              }}
            >
              Start Understanding
              <br />
              <Box component="span" sx={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Your Repositories
              </Box>
            </Typography>
            <Typography sx={{ color: '#8888aa', mb: 6, fontSize: '1.15rem', maxWidth: 500, mx: 'auto' }}>
              Join thousands of engineering teams building better software faster with RepoMind.
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ p: 0.5, background: 'rgba(255,255,255,0.05)', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_black"
                  size="large"
                  shape="pill"
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Modernized Footer */}
        <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', pt: 8, pb: 6 }}>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', fontSize: '1.2rem' }}>
                  RepoMind
                </Typography>
              </Box>
              <Typography sx={{ color: '#8888aa', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 250 }}>
                The AI-powered codebase intelligence platform for modern engineering teams.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 3, fontSize: '0.95rem' }}>Product</Typography>
              {['Features', 'Integrations', 'Pricing', 'Changelog'].map((link) => (
                <Typography key={link} sx={{ color: '#8888aa', fontSize: '0.9rem', mb: 2, cursor: 'pointer', transition: 'color 0.2s', '&:hover': { color: '#6c63ff' } }}>
                  {link}
                </Typography>
              ))}
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 3, fontSize: '0.95rem' }}>Resources</Typography>
              {['Documentation', 'API Reference', 'Blog', 'Community'].map((link) => (
                <Typography key={link} sx={{ color: '#8888aa', fontSize: '0.9rem', mb: 2, cursor: 'pointer', transition: 'color 0.2s', '&:hover': { color: '#6c63ff' } }}>
                  {link}
                </Typography>
              ))}
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 3, fontSize: '0.95rem' }}>Company</Typography>
              {['About', 'Contact', 'Careers', 'Legal'].map((link) => (
                <Typography key={link} sx={{ color: '#8888aa', fontSize: '0.9rem', mb: 2, cursor: 'pointer', transition: 'color 0.2s', '&:hover': { color: '#6c63ff' } }}>
                  {link}
                </Typography>
              ))}
            </Grid>
          </Grid>
          <Box sx={{ mt: 10, pt: 4, borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{ color: '#555577', fontSize: '0.85rem' }}>
              © 2026 RepoMind Inc. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <GitHubIcon sx={{ color: '#555577', cursor: 'pointer', '&:hover': { color: '#fff' } }} />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
