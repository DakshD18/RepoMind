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
        icon={<CheckCircleOutlinedIcon sx={{ fontSize: '13px !important', color: '#ffd21f !important' }} />}
        label="Analysed"
        size="small"
        sx={{
          background: 'rgba(255, 210, 31, 0.08)',
          color: '#ffd21f',
          border: '1px solid rgba(255, 210, 31, 0.25)',
          fontSize: '0.7rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.8 },
        }}
      />
    );
  }
  if (status === 'PROCESSING' || status === 'PENDING') {
    return (
      <Chip
        icon={<CircularProgress size={11} sx={{ color: '#ffd21f !important' }} />}
        label="Analysing"
        size="small"
        sx={{
          background: 'rgba(255, 210, 31, 0.1)',
          color: '#ffd21f',
          border: '1px solid rgba(255, 210, 31, 0.3)',
          fontSize: '0.7rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.8 },
        }}
      />
    );
  }
  return (
    <Chip
      icon={<ErrorOutlinedIcon sx={{ fontSize: '13px !important', color: '#ef5350 !important' }} />}
      label="Failed"
      size="small"
      sx={{
        background: 'rgba(239, 83, 80, 0.08)',
        color: '#ef5350',
        border: '1px solid rgba(239, 83, 80, 0.25)',
        fontSize: '0.7rem',
        fontWeight: 600,
        '& .MuiChip-label': { px: 0.8 },
      }}
    />
  );
};

// Language color mapping
const LANG_COLORS: Record<string, string> = {
  Python: '#3776ab',
  TypeScript: '#3178c6',
  JavaScript: '#ffd21f',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4f5d95',
  'C++': '#f34b7d',
  C: '#737373',
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
              fontSize: { xs: '1.75rem', sm: '2.1rem' },
            }}
          >
            Welcome back, {user?.first_name || 'Developer'}
          </Typography>
          <Typography sx={{ color: '#a3a3a3', fontSize: '0.925rem' }}>
            Monitor, analyze, and gain deep intelligence on your engineering repositories.
          </Typography>
        </Box>

        {/* Main Banner: Analyse a Repository */}
        <Card
          sx={{
            background: '#111111',
            border: '1px solid #262626',
            borderRadius: '16px',
            p: { xs: 3, md: 3.5 },
            mb: 4.5,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Subtle background glow circle */}
          <Box
            sx={{
              position: 'absolute',
              top: '-30%',
              right: '-10%',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 210, 31, 0.06) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {/* AI Pill Badge */}
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: '#ffd21f !important' }} />}
              label="AI-Powered Analysis"
              size="small"
              sx={{
                background: '#161616',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                fontWeight: 600,
                fontSize: '0.725rem',
                mb: 1.5,
              }}
            />

            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: '#ffffff', mb: 0.8, letterSpacing: '-0.01em' }}
            >
              Analyse a Repository
            </Typography>
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.875rem', maxWidth: 600, mb: 3, lineHeight: 1.6 }}>
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
                  background: '#0a0a0a',
                  border: errors.url ? '1px solid #ef5350' : '1px solid #262626',
                  borderRadius: '10px',
                  px: 2,
                  py: 0.4,
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#ffd21f',
                    boxShadow: '0 0 15px rgba(255, 210, 31, 0.15)',
                  },
                }}
              >
                <GitHubIcon sx={{ color: '#737373', mr: 1.5, fontSize: 18 }} />
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
                        fontSize: '0.875rem',
                        '& input::placeholder': { color: '#737373', opacity: 1 },
                      },
                    },
                  }}
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={isAnalysing}
                endIcon={<ArrowForwardIcon fontSize="small" />}
                sx={{
                  height: 44,
                  px: 3.5,
                  borderRadius: '10px',
                  background: '#ffd21f',
                  color: '#050505',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  boxShadow: '0 2px 14px rgba(255, 210, 31, 0.25)',
                  '&:hover': {
                    background: '#ffe033',
                    boxShadow: '0 4px 20px rgba(255, 210, 31, 0.4)',
                  },
                  '&:disabled': { opacity: 0.5 },
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
              background: '#0d0d0d',
              border: '1px dashed #262626',
              borderRadius: '16px',
              p: { xs: 4, md: 8 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Central Glowing Globe Graphic */}
            <Box
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 3,
                borderRadius: '50%',
                background: '#111111',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(255, 210, 31, 0.12)',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 44, color: '#ffd21f' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
              Your repositories will appear here
            </Typography>
            <Typography sx={{ color: '#a3a3a3', fontSize: '0.9rem', maxWidth: 480, mx: 'auto', mb: 4 }}>
              Paste your first GitHub repository URL above to begin analysing its architecture, history, and intelligence.
            </Typography>

            {/* Popular Repository Tags */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#737373', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', mr: 1 }}>
                OR TRY A POPULAR REPOSITORY
              </Typography>
              {POPULAR_REPOS.map((repo) => (
                <Chip
                  key={repo.name}
                  icon={<GitHubIcon sx={{ fontSize: '13px !important', color: '#a3a3a3 !important' }} />}
                  label={repo.name}
                  onClick={() => handlePopularClick(repo.url)}
                  sx={{
                    background: '#151515',
                    color: '#e5e5e5',
                    border: '1px solid #262626',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    py: 1.2,
                    px: 0.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: '#1a1a1a',
                      borderColor: '#ffd21f',
                      color: '#ffd21f',
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
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffd21f',
                    boxShadow: '0 0 8px #ffd21f',
                  }}
                />
                <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>
                  Recent Repositories
                </Typography>
              </Box>

              {/* Search filter */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#0f0f0f',
                  border: '1px solid #262626',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.3,
                  width: 200,
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#ffd21f',
                  },
                }}
              >
                <SearchIcon sx={{ color: '#737373', fontSize: 16, mr: 0.8 }} />
                <TextField
                  variant="standard"
                  placeholder="Filter repos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      sx: {
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        '& input::placeholder': { color: '#737373', opacity: 1 },
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
                const langColor = LANG_COLORS[primaryLang] || '#ffd21f';

                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={repo.id}>
                    <Card
                      onClick={() => navigate(`/repository/${repo.id}`)}
                      sx={{
                        background: '#111111',
                        border: '1px solid #262626',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        '&:hover': {
                          border: '1px solid rgba(255, 210, 31, 0.4)',
                          background: '#151515',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.7), 0 0 15px rgba(255, 210, 31, 0.08)',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        {/* Repo Icon & Header */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '8px',
                              background: '#161616',
                              border: '1px solid #262626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <GitHubIcon sx={{ color: '#ffffff', fontSize: 18 }} />
                          </Box>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              noWrap
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.925rem',
                                color: '#ffffff',
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {repo.owner}/{repo.name}
                            </Typography>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                              <Box
                                sx={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: langColor,
                                }}
                              />
                              <Typography sx={{ fontSize: '0.725rem', color: '#737373' }}>
                                {primaryLang} • {formatTimeAgo(repo.created_at)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Delete button */}
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteClick(e, repo)}
                            sx={{
                              color: '#737373',
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
                              color: '#a3a3a3',
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
                          py: 1.25,
                          borderTop: '1px solid #1c1c1c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <StatusBadge status={repo.status} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarBorderIcon sx={{ fontSize: 13, color: '#737373' }} />
                            <Typography sx={{ fontSize: '0.725rem', color: '#737373' }}>
                              {repo.file_count || 0}
                            </Typography>
                          </Box>
                          <IconButton size="small" sx={{ color: '#737373', p: 0.4, '&:hover': { color: '#ffd21f' } }}>
                            <ArrowForwardIcon sx={{ fontSize: 15 }} />
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
                    background: '#0a0a0a',
                    border: '1px dashed #262626',
                    borderRadius: '14px',
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
                      borderColor: 'rgba(255, 210, 31, 0.4)',
                      background: '#0f0f0f',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#151515',
                      border: '1px solid #262626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5,
                    }}
                  >
                    <SearchIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#ffffff', mb: 0.5 }}>
                    Discover More
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#737373', maxWidth: 200 }}>
                    Connect organizational repos or explore open source projects
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
              background: '#111111',
              border: '1px solid #262626',
              borderRadius: '14px',
              maxWidth: 400,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.05rem' }}>
          Delete Repository
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#a3a3a3', fontSize: '0.875rem' }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#ffffff' }}>
              {repoToDelete?.owner}/{repoToDelete?.name}
            </strong>
            ? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: '#a3a3a3',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2,
              '&:hover': { background: '#1a1a1a', color: '#ffffff' },
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
              borderRadius: '8px',
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
