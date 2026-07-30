import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import GitHubIcon from '@mui/icons-material/GitHub';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AnalysisLoading } from '../components/AnalysisLoading';
import { useAuth } from '../context/AuthContext';
import { analyseRepository, getRepositories, deleteRepository } from '../services/api';
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

// Demo backup repositories for empty state preview or quick tests
const POPULAR_REPOS = [
  { name: 'facebook/react', url: 'https://github.com/facebook/react' },
  { name: 'vercel/next.js', url: 'https://github.com/vercel/next.js' },
  { name: 'torvalds/linux', url: 'https://github.com/torvalds/linux' },
];

const StatusBadge = ({ status }: { status: Repository['status'] }) => {
  if (status === 'SUCCESS') {
    return (
      <Chip
        icon={<CheckCircleOutlinedIcon sx={{ fontSize: '14px !important', color: '#00c896 !important' }} />}
        label="Analysed"
        size="small"
        sx={{
          background: 'rgba(0, 200, 150, 0.1)',
          color: '#00c896',
          border: '1px solid rgba(0, 200, 150, 0.25)',
          fontSize: '0.725rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 1 },
        }}
      />
    );
  }
  if (status === 'PROCESSING' || status === 'PENDING') {
    return (
      <Chip
        icon={<CircularProgress size={12} sx={{ color: '#6c63ff !important' }} />}
        label="Analysing"
        size="small"
        sx={{
          background: 'rgba(108, 99, 255, 0.1)',
          color: '#8b84ff',
          border: '1px solid rgba(108, 99, 255, 0.25)',
          fontSize: '0.725rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 1 },
        }}
      />
    );
  }
  return (
    <Chip
      icon={<ErrorOutlinedIcon sx={{ fontSize: '14px !important', color: '#ef5350 !important' }} />}
      label="Failed"
      size="small"
      sx={{
        background: 'rgba(239, 83, 80, 0.1)',
        color: '#ef5350',
        border: '1px solid rgba(239, 83, 80, 0.25)',
        fontSize: '0.725rem',
        fontWeight: 600,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
};

// Language color mapping
const LANG_COLORS: Record<string, string> = {
  Python: '#3776ab',
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4f5d95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  Dart: '#00b4ab',
  Vue: '#41b883',
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysingUrl, setAnalysingUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
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
    setAnalysingUrl(data.url);

    try {
      const repo = await analyseRepository(data.url);
      toast.success(`Successfully analysed ${repo.owner}/${repo.name}!`);
      reset();
      await fetchRepositories();
      navigate(`/repository/${repo.id}`);
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to analyse repository.';
      toast.error(msg);
    } finally {
      setIsAnalysing(false);
      setAnalysingUrl('');
    }
  };

  const handlePopularClick = (url: string) => {
    setValue('url', url, { shouldValidate: true });
  };

  const handleDeleteClick = (e: React.MouseEvent, repo: Repository) => {
    e.stopPropagation();
    setRepoToDelete(repo);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!repoToDelete) return;
    try {
      await deleteRepository(repoToDelete.id);
      toast.success(`Deleted ${repoToDelete.owner}/${repoToDelete.name}`);
      setRepositories((prev) => prev.filter((r) => r.id !== repoToDelete.id));
    } catch {
      toast.error('Failed to delete repository.');
    } finally {
      setDeleteDialogOpen(false);
      setRepoToDelete(null);
    }
  };

  // Filter repos based on search
  const filteredRepos = repositories.filter((repo) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(q) ||
      repo.owner.toLowerCase().includes(q) ||
      repo.languages.some((l) => l.toLowerCase().includes(q))
    );
  });

  // Format relative time from ISO date
  const formatTimeAgo = (dateStr: string | null): string => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  };

  return (
    <DashboardLayout>
      {/* Analysis Fullscreen Overlay */}
      {isAnalysing && <AnalysisLoading repoUrl={analysingUrl} />}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Welcome Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              mb: 0.5,
              fontSize: { xs: '1.75rem', sm: '2.2rem' },
            }}
          >
            Welcome back, {user?.first_name || 'Developer'}
          </Typography>
          <Typography sx={{ color: '#8888aa', fontSize: '0.95rem' }}>
            Monitor, analyze, and gain deep intelligence on your repositories.
          </Typography>
        </Box>

        {/* Main Banner: Analyse a Repository */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, rgba(18, 18, 28, 0.9) 0%, rgba(13, 13, 20, 0.9) 100%)',
            border: '1px solid rgba(108, 99, 255, 0.25)',
            borderRadius: '20px',
            p: { xs: 3, md: 4 },
            mb: 5,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(108, 99, 255, 0.1)',
          }}
        >
          {/* Subtle background glow circle */}
          <Box
            sx={{
              position: 'absolute',
              top: '-30%',
              right: '-10%',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(108,99,255,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {/* AI Pill Badge */}
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important', color: '#8b84ff !important' }} />}
              label="AI-Powered Analysis"
              size="small"
              sx={{
                background: 'rgba(108, 99, 255, 0.12)',
                color: '#a0a0ff',
                border: '1px solid rgba(108, 99, 255, 0.25)',
                fontWeight: 600,
                fontSize: '0.75rem',
                mb: 2,
              }}
            />

            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: '#ffffff', mb: 1, letterSpacing: '-0.01em' }}
            >
              Analyse a Repository
            </Typography>
            <Typography sx={{ color: '#8888aa', fontSize: '0.9rem', maxWidth: 580, mb: 3, lineHeight: 1.6 }}>
              Enter a GitHub repository URL to instantly generate comprehensive architecture maps, dependency trees, and security intelligence.
            </Typography>

            {/* URL Input Form */}
            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}
            >
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: errors.url ? '1px solid #ef5350' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  px: 2,
                  py: 0.5,
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#6c63ff',
                    boxShadow: '0 0 15px rgba(108,99,255,0.3)',
                  },
                }}
              >
                <GitHubIcon sx={{ color: '#666688', mr: 1.5, fontSize: 20 }} />
                <TextField
                  {...register('url')}
                  fullWidth
                  variant="standard"
                  placeholder="https://github.com/facebook/react"
                  disabled={isAnalysing}
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      sx: {
                        color: '#ffffff',
                        fontSize: '0.925rem',
                        '& input::placeholder': { color: '#555577', opacity: 1 },
                      },
                    },
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={isAnalysing}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  height: 48,
                  px: 3.5,
                  borderRadius: '12px',
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
                Analyse
              </Button>
            </Box>
            {errors.url && (
              <Typography sx={{ color: '#ef5350', fontSize: '0.8rem', mt: 1, ml: 1 }}>
                {errors.url.message}
              </Typography>
            )}
          </Box>
        </Card>

        {/* Empty State View if no repos exist */}
        {repositories.length === 0 ? (
          <Card
            sx={{
              background: '#0c0c14',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              p: { xs: 4, md: 8 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Central Glowing Globe Graphic */}
            <Box
              sx={{
                width: 140,
                height: 140,
                mx: 'auto',
                mb: 3,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(108, 99, 255, 0.3) 0%, rgba(0, 200, 150, 0.1) 60%, transparent 80%)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 50px rgba(108, 99, 255, 0.25)',
                position: 'relative',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 54, color: '#6c63ff' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
              Your repositories will appear here
            </Typography>
            <Typography sx={{ color: '#8888aa', fontSize: '0.95rem', maxWidth: 500, mx: 'auto', mb: 4 }}>
              Paste your first GitHub repository URL to begin analysing its architecture, history, and intelligence.
            </Typography>

            {/* Popular Repository Tags */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#555577', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', mr: 1 }}>
                OR TRY A POPULAR REPOSITORY
              </Typography>
              {POPULAR_REPOS.map((repo) => (
                <Chip
                  key={repo.name}
                  icon={<GitHubIcon sx={{ fontSize: '14px !important', color: '#8888aa !important' }} />}
                  label={repo.name}
                  onClick={() => handlePopularClick(repo.url)}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: '#c0c0e0',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    py: 1.5,
                    px: 0.5,
                    '&:hover': {
                      background: 'rgba(108, 99, 255, 0.15)',
                      borderColor: 'rgba(108, 99, 255, 0.35)',
                      color: '#ffffff',
                    },
                  }}
                />
              ))}
            </Box>
          </Card>
        ) : (
          /* Recent Repositories Grid */
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SearchIcon sx={{ color: '#6c63ff', fontSize: 20 }} />
                <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#ffffff' }}>
                  Recent Repositories
                </Typography>
              </Box>

              {/* Search filter */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '10px',
                  px: 1.5,
                  py: 0.3,
                  width: 200,
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    border: '1px solid rgba(108, 99, 255, 0.5)',
                    background: 'rgba(108, 99, 255, 0.05)',
                  },
                }}
              >
                <SearchIcon sx={{ color: '#555577', fontSize: 16, mr: 0.8 }} />
                <TextField
                  variant="standard"
                  placeholder="Filter repos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      sx: {
                        color: '#e0e0ff',
                        fontSize: '0.8rem',
                        '& input::placeholder': { color: '#555577', opacity: 1 },
                      },
                    },
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>

            <Grid container spacing={2.5}>
              {filteredRepos.map((repo) => {
                const primaryLang = repo.languages[0] || 'Code';
                const langColor = LANG_COLORS[primaryLang] || '#6c63ff';

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={repo.id}>
                    <Card
                      onClick={() => navigate(`/repository/${repo.id}`)}
                      sx={{
                        background: '#0d0d16',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        '&:hover': {
                          border: '1px solid rgba(108, 99, 255, 0.4)',
                          background: 'rgba(18, 18, 28, 0.9)',
                          transform: 'translateY(-3px)',
                          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(108, 99, 255, 0.15)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        {/* Repo Icon & Header */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <GitHubIcon sx={{ color: '#e0e0ff', fontSize: 20 }} />
                          </Box>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              noWrap
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.975rem',
                                color: '#ffffff',
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {repo.owner}/{repo.name}
                            </Typography>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                              <Box
                                sx={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: langColor,
                                }}
                              />
                              <Typography sx={{ fontSize: '0.75rem', color: '#777799' }}>
                                {primaryLang} • {formatTimeAgo(repo.created_at)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Delete button */}
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteClick(e, repo)}
                            sx={{
                              color: '#555577',
                              p: 0.5,
                              opacity: 0,
                              transition: 'opacity 0.2s ease',
                              '.MuiCard-root:hover &': { opacity: 1 },
                              '&:hover': { color: '#ef5350' },
                            }}
                          >
                            <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>

                        {/* Description preview */}
                        {repo.description && (
                          <Typography
                            sx={{
                              fontSize: '0.8rem',
                              color: '#8888aa',
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {repo.description}
                          </Typography>
                        )}
                      </CardContent>

                      {/* Card Footer */}
                      <Box
                        sx={{
                          px: 2.5,
                          py: 1.5,
                          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <StatusBadge status={repo.status} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarBorderIcon sx={{ fontSize: 14, color: '#666688' }} />
                            <Typography sx={{ fontSize: '0.75rem', color: '#777799' }}>
                              {repo.file_count || 0}
                            </Typography>
                          </Box>
                          <IconButton size="small" sx={{ color: '#555577', p: 0.5 }}>
                            <ArrowForwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}

              {/* Discover More Card */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                    textAlign: 'center',
                    minHeight: 150,
                    height: '100%',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(108, 99, 255, 0.3)',
                      background: 'rgba(108, 99, 255, 0.03)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5,
                    }}
                  >
                    <SearchIcon sx={{ color: '#666688', fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', mb: 0.5 }}>
                    Discover More
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#666688', maxWidth: 200 }}>
                    Connect organizational repos or find open source projects
                  </Typography>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        slotProps={{
          paper: {
            sx: {
              background: '#12121c',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              maxWidth: 400,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem' }}>
          Delete Repository
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#8888aa', fontSize: '0.9rem' }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#e0e0ff' }}>
              {repoToDelete?.owner}/{repoToDelete?.name}
            </strong>
            ? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: '#8888aa',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '10px',
              px: 2,
              '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            sx={{
              background: '#ef5350',
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              px: 2.5,
              '&:hover': { background: '#d32f2f' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default Dashboard;
