import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import GitHubIcon from '@mui/icons-material/GitHub';
import LogoutIcon from '@mui/icons-material/Logout';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useAuth } from '../context/AuthContext';
import { analyseRepository, getRepositories } from '../services/api';
import type { Repository } from '../types';


const schema = z.object({
  url: z
    .string()
    .url('Please enter a valid URL.')
    .refine((val) => val.includes('github.com'), {
      message: 'Only GitHub URLs are supported.',
    }),
});

type FormValues = z.infer<typeof schema>;

const StatusChip = ({ status }: { status: Repository['status'] }) => {
  const config = {
    SUCCESS: { label: 'Analysed', color: '#00c896', bg: 'rgba(0,200,150,0.1)' },
    PENDING: { label: 'Pending', color: '#ffa726', bg: 'rgba(255,167,38,0.1)' },
    PROCESSING: { label: 'Processing...', color: '#6c63ff', bg: 'rgba(108,99,255,0.1)' },
    FAILED: { label: 'Failed', color: '#ef5350', bg: 'rgba(239,83,80,0.1)' },
  };
  const c = config[status];
  return (
    <Chip
      label={c.label}
      size="small"
      sx={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33`, fontSize: '0.72rem' }}
    />
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const repos = await getRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setIsAnalysing(true);
    const toastId = toast.loading('Cloning and analysing repository...');
    try {
      const repo = await analyseRepository(data.url);
      toast.success(`Successfully analysed ${repo.owner}/${repo.name}!`, { id: toastId });
      reset();
      await fetchRepositories();
      navigate(`/repository/${repo.id}`);
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to analyse repository.';
      toast.error(msg, { id: toastId });
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #12101f 50%, #0d0d1a 100%)',
      }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a2e', color: '#e0e0ff', border: '1px solid rgba(108,99,255,0.3)' },
        }}
      />

      {/* Navbar */}
      <Box
        sx={{
          borderBottom: '1px solid rgba(108,99,255,0.15)',
          background: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AnalyticsIcon sx={{ color: '#6c63ff', fontSize: 28 }} />
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, #fff 40%, #6c63ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                RepoMind
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar
                  sx={{ width: 34, height: 34, background: 'linear-gradient(135deg, #6c63ff, #00c896)', fontSize: '0.85rem' }}
                >
                  {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                </Avatar>
                <Typography sx={{ color: '#c0c0dd', fontSize: '0.9rem', display: { xs: 'none', sm: 'block' } }}>
                  {user?.first_name} {user?.last_name}
                </Typography>
              </Box>
              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon />}
                size="small"
                sx={{
                  color: '#8888aa',
                  '&:hover': { color: '#ef5350', background: 'rgba(239,83,80,0.08)' },
                }}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 6 }}>

        {/* Welcome section */}
        <Box sx={{ mb: 6 }}>
          <Typography
            sx={{
              fontSize: { xs: '1.8rem', md: '2.5rem' },
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff 50%, #6c63ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            Welcome back, {user?.first_name || 'Developer'} 👋
          </Typography>
          <Typography sx={{ color: '#8888aa', fontSize: '1rem' }}>
            Paste a GitHub repository URL below to analyse it instantly.
          </Typography>
        </Box>

        {/* Analyse Card */}
        <Card
          sx={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(108,99,255,0.2)',
            borderRadius: '20px',
            mb: 5,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <GitHubIcon sx={{ color: '#6c63ff', fontSize: 24 }} />
              <Typography sx={{ color: '#e0e0ff', fontWeight: 600, fontSize: '1.1rem' }}>
                Analyse Repository
              </Typography>
            </Box>

            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}
            >
              <TextField
                {...register('url')}
                fullWidth
                placeholder="https://github.com/owner/repository"
                error={!!errors.url}
                helperText={errors.url?.message}
                disabled={isAnalysing}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#e0e0ff',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(108,99,255,0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(108,99,255,0.6)' },
                    '&.Mui-focused fieldset': { borderColor: '#6c63ff' },
                  },
                  '& .MuiFormHelperText-root': { color: '#ef5350' },
                  input: { '&::placeholder': { color: '#555577' } },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={isAnalysing}
                sx={{
                  minWidth: 160,
                  height: 56,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6c63ff, #5a52e0)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7d75ff, #6c63ff)',
                    boxShadow: '0 6px 30px rgba(108,99,255,0.6)',
                  },
                  '&:disabled': { opacity: 0.6 },
                }}
              >
                {isAnalysing ? (
                  <CircularProgress size={20} sx={{ color: '#fff' }} />
                ) : (
                  'Analyse Repository'
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Repository History */}
        {repositories.length > 0 && (
          <Box>
            <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 2, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Previous Analyses
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {repositories.map((repo) => (
                <Card
                  key={repo.id}
                  onClick={() => repo.status === 'SUCCESS' && navigate(`/repository/${repo.id}`)}
                  sx={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px',
                    cursor: repo.status === 'SUCCESS' ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    '&:hover': repo.status === 'SUCCESS' ? {
                      border: '1px solid rgba(108,99,255,0.3)',
                      background: 'rgba(108,99,255,0.05)',
                      transform: 'translateY(-2px)',
                    } : {},
                  }}
                >
                  <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 40, height: 40, borderRadius: '10px',
                            background: 'rgba(108,99,255,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <FolderOpenIcon sx={{ color: '#6c63ff', fontSize: 20 }} />
                        </Box>
                        <Box>
                          <Typography sx={{ color: '#e0e0ff', fontWeight: 600 }}>
                            {repo.owner}/{repo.name}
                          </Typography>
                          <Typography sx={{ color: '#555577', fontSize: '0.78rem', mt: 0.25 }}>
                            {repo.url}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {repo.status === 'SUCCESS' && repo.languages.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            {repo.languages.slice(0, 3).map((lang) => (
                              <Chip
                                key={lang}
                                label={lang}
                                size="small"
                                sx={{ background: 'rgba(0,200,150,0.08)', color: '#00c896', fontSize: '0.7rem', border: '1px solid rgba(0,200,150,0.2)' }}
                              />
                            ))}
                          </Box>
                        )}
                        <StatusChip status={repo.status} />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
