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
        <Box sx={{ mt: 10, mb: 20 }}>
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
            Unpack complexity instantly
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
            Everything you need to understand unfamiliar codebases without spending days reading source files.
          </Typography>

          <Grid container spacing={3}>
            {[
              {
                icon: <AutoAwesomeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Intelligence',
                desc: 'Let our AI scan the entire codebase to understand dependencies, patterns, and architecture.',
              },
              {
                icon: <CodeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Dependency Discovery',
                desc: 'See exactly how different files and modules rely on one another before making a change.',
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Architecture Intelligence',
                desc: 'Visual representations of your codebase to quickly grasp the overarching structure.',
              },
              {
                icon: <InsightsIcon sx={{ color: '#6c63ff' }} />,
                title: 'Impact Analysis',
                desc: 'Understand what will break if you modify a certain file or update a specific module.',
              },
              {
                icon: <SecurityIcon sx={{ color: '#6c63ff' }} />,
                title: 'Semantic Code Search',
                desc: 'Search for what code does, not just exact keyword matches. Find logic naturally.',
              },
              {
                icon: <GitHubIcon sx={{ color: '#6c63ff' }} />,
                title: 'Technical Debt',
                desc: 'Automatically identify complex files, large files, and tightly coupled modules.',
              },
            ].map((f) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f.title}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
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
                        background: 'rgba(108, 99, 255, 0.1)',
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

        {/* Workflow Section */}
        <Box sx={{ mb: 20 }}>
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
            From URL to understanding in seconds
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
            No complex setup, no configs. Just paste a URL and let RepoMind do the heavy lifting.
          </Typography>

          <Box sx={{ maxWidth: 800, mx: 'auto', pl: { xs: 2, md: 10 } }}>
            {[
              {
                icon: '🔗',
                title: 'Paste URL',
                desc: 'Paste any GitHub repository URL. We support public and private repositories securely.',
              },
              {
                icon: '✨',
                title: 'Analyze & Build Graph',
                desc: 'Our engine parses files, ASTs, and dependencies to build a comprehensive knowledge graph.',
              },
              {
                icon: '👁',
                title: 'Understand Visually',
                desc: 'Explore the architecture, jump between modules, and see how everything is connected.',
              },
              {
                icon: '💬',
                title: 'Chat with the Codebase',
                desc: 'Ask questions like "Where is the auth logic?" and get accurate, context-aware answers.',
              },
            ].map((step, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 4, mb: 6, position: 'relative' }}>
                {index !== 3 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 48,
                      left: 23,
                      bottom: -32,
                      width: 2,
                      background: 'rgba(255, 255, 255, 0.1)',
                    }}
                  />
                )}
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  {step.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', mb: 1, mt: 1 }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ color: '#8888aa' }}>{step.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Testimonials */}
        <Box sx={{ mb: 20 }}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: '#ffffff',
              mb: 8,
              fontSize: { xs: '2rem', sm: '2.5rem' },
            }}
          >
            Loved by engineering leaders
          </Typography>

          <Grid container spacing={4}>
            {[
              {
                name: 'Jane Doe',
                title: 'VP of Engineering, Acme Corp',
                text: '"RepoMind has cut our onboarding time in half. Being able to visualize the whole app before reading a single file is a game-changer."',
              },
              {
                name: 'Michael Johnson',
                title: 'Engineering Manager, TechFlow',
                text: '"It is like having a senior engineer explain the architecture to you. I use it for every PR review now."',
              },
              {
                name: 'Sarah Williams',
                title: 'Lead Developer, StartUp Inc',
                text: '"The visual dependency graph is incredible. It helped us identify circular dependencies we didn't even know we had."',
              },
            ].map((t, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '16px',
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                      {[...Array(5)].map((_, i) => (
                        <AutoAwesomeIcon key={i} sx={{ color: '#00c896', fontSize: 16 }} />
                      ))}
                    </Box>
                    <Typography sx={{ color: '#e0e0ff', fontSize: '1rem', fontStyle: 'italic', mb: 4, lineHeight: 1.6 }}>
                      {t.text}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 40, height: 40, background: '#6c63ff' }}>{t.name.charAt(0)}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{t.name}</Typography>
                        <Typography sx={{ color: '#8888aa', fontSize: '0.8rem' }}>{t.title}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA Banner */}
        <Box
          sx={{
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(0, 200, 150, 0.05) 100%)',
            border: '1px solid rgba(108, 99, 255, 0.2)',
            p: { xs: 6, md: 10 },
            textAlign: 'center',
            mb: 10,
          }}
        >
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              mb: 3,
              fontSize: { xs: '2rem', md: '3rem' },
            }}
          >
            Start Understanding
            <br />
            Your Repos
          </Typography>
          <Typography sx={{ color: '#8888aa', mb: 5, fontSize: '1.1rem' }}>
            Join 10,000+ developers who already use RepoMind to build better software.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              size="large"
              shape="pill"
            />
          </Box>
        </Box>

        {/* Simple Footer */}
        <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', pt: 6, pb: 4 }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 16 }} />
                </Box>
                <Typography sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  RepoMind
                </Typography>
              </Box>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem' }}>
                Understand any codebase instantly.
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>Product</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Features</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Integrations</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Pricing</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>Resources</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Documentation</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Blog</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Community</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography sx={{ color: '#fff', fontWeight: 600, mb: 2, fontSize: '0.9rem' }}>Company</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>About</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Contact</Typography>
              <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Careers</Typography>
            </Grid>
          </Grid>
          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Typography sx={{ color: '#555577', fontSize: '0.8rem' }}>
              © 2026 RepoMind Inc. All rights reserved.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
