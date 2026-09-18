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
  Tooltip,
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
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';

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
          background: 'rgba(255, 210, 31, 0.1)',
          color: '#ffd21f',
          border: '1px solid rgba(255, 210, 31, 0.3)',
          fontSize: '0.7rem',
          fontWeight: 700,
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
          background: 'rgba(255, 210, 31, 0.12)',
          color: '#ffd21f',
          border: '1px solid rgba(255, 210, 31, 0.35)',
          fontSize: '0.7rem',
          fontWeight: 700,
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
        background: 'rgba(239, 83, 80, 0.1)',
        color: '#ef5350',
        border: '1px solid rgba(239, 83, 80, 0.3)',
        fontSize: '0.7rem',
        fontWeight: 700,
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

  const totalFiles = repositories.reduce((sum, r) => sum + (r.file_count || 0), 0);
  const activeIndexedCount = repositories.filter((r) => r.status === 'SUCCESS').length;

  return (
    <DashboardLayout>
      {/* Analysis Fullscreen Overlay */}
      {isAnalysing && <AnalysisLoading repoUrl={analysingUrl} />}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Welcome Header */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 2 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.025em',
                mb: 0.6,
                fontSize: { xs: '1.8rem', sm: '2.2rem' },
              }}
            >
              Welcome back, {user?.first_name || 'Developer'}
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.925rem' }}>
              Monitor, analyze, and gain deep intelligence on your engineering repositories.
            </Typography>
          </Box>

          {/* Mini Quick Status Strip */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<SpeedIcon sx={{ fontSize: '13px !important', color: '#ffd21f !important' }} />}
              label="Hybrid RAG Engine Online"
              size="small"
              sx={{
                background: 'rgba(255, 210, 31, 0.08)',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                fontWeight: 600,
                fontSize: '0.725rem',
              }}
            />
          </Box>
        </Box>

        {/* Top Repository Stats Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {[
            { label: 'Indexed Repositories', val: `${activeIndexedCount} / ${repositories.length}`, icon: <StorageIcon sx={{ color: '#ffd21f' }} />, sub: 'Ready for AI Grounded Chat' },
            { label: 'Total Files Parsed', val: totalFiles.toLocaleString(), icon: <AccountTreeOutlinedIcon sx={{ color: '#ffd21f' }} />, sub: 'AST & dependency mapped' },
            { label: 'Grounding Verification', val: '100%', icon: <CheckCircleOutlinedIcon sx={{ color: '#ffd21f' }} />, sub: 'Strict citation enforcement' },
          ].map((stat) => (
            <Grid size={{ xs: 12, sm: 4 }} key={stat.label}>
              <Card
                sx={{
                  background: 'rgba(18, 18, 24, 0.6)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  p: 2.5,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'rgba(255, 210, 31, 0.3)',
                    background: 'rgba(22, 22, 30, 0.8)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {stat.label}
                  </Typography>
                  <Box sx={{ display: 'flex', p: 0.6, borderRadius: '8px', background: 'rgba(255, 210, 31, 0.08)' }}>
                    {stat.icon}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', mb: 0.4 }}>
                  {stat.val}
                </Typography>
                <Typography sx={{ fontSize: '0.725rem', color: '#64748b' }}>
                  {stat.sub}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Main Banner: Analyse a Repository */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.85) 0%, rgba(14, 14, 18, 0.95) 100%)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '18px',
            p: { xs: 3, md: 4 },
            mb: 5,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 16px 45px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 210, 31, 0.06)',
          }}
        >
          {/* Subtle background glow circle */}
          <Box
            sx={{
              position: 'absolute',
              top: '-35%',
              right: '-10%',
              width: 380,
              height: 380,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 210, 31, 0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            {/* AI Pill Badge */}
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: '#ffd21f !important' }} />}
              label="AI-Powered Intelligence Pipeline"
              size="small"
              sx={{
                background: 'rgba(255, 210, 31, 0.1)',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                fontWeight: 700,
                fontSize: '0.725rem',
                mb: 2,
              }}
            />

            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: '#ffffff', mb: 0.8, letterSpacing: '-0.02em', fontSize: { xs: '1.3rem', sm: '1.5rem' } }}
            >
              Analyse a Repository
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: 640, mb: 3.2, lineHeight: 1.6 }}>
              Enter any public GitHub repository URL to generate instant AST architecture maps, commit memory graphs, and an AI that knows every line of the codebase.
            </Typography>

            {/* URL Input Form */}
            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, mb: 2.5 }}
            >
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(10, 10, 14, 0.85)',
                  border: errors.url ? '1px solid #ef5350' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  px: 2.2,
                  py: 0.6,
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#ffd21f',
                    boxShadow: '0 0 20px rgba(255, 210, 31, 0.2)',
                  },
                }}
              >
                <GitHubIcon sx={{ color: '#94a3b8', mr: 1.5, fontSize: 20 }} />
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
                        fontSize: '0.9rem',
                        '& input::placeholder': { color: '#64748b', opacity: 1 },
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
                  height: 48,
                  px: 3.8,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                  color: '#050507',
                  fontWeight: 800,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 18px rgba(255, 210, 31, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                    boxShadow: '0 6px 24px rgba(255, 210, 31, 0.45)',
                  },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                Analyse
              </Button>
            </Box>
            {errors.url && (
              <Typography sx={{ color: '#ef5350', fontSize: '0.8rem', mt: -1.5, mb: 2, ml: 1 }}>
                {errors.url.message}
              </Typography>
            )}

            {/* Popular Repos Quick Suggestions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TRY QUICK DEMO:
              </Typography>
              {POPULAR_REPOS.map((repo) => (
                <Chip
                  key={repo.name}
                  icon={<GitHubIcon sx={{ fontSize: '13px !important', color: '#94a3b8 !important' }} />}
                  label={repo.name}
                  onClick={() => handlePopularClick(repo.url)}
                  sx={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: 'rgba(255, 210, 31, 0.12)',
                      borderColor: '#ffd21f',
                      color: '#ffd21f',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        </Card>

        {/* Empty State View if no repos exist */}
        {repositories.length === 0 ? (
          <Card
            sx={{
              background: 'rgba(14, 14, 18, 0.5)',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              borderRadius: '18px',
              p: { xs: 5, md: 9 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Central Glowing Globe Graphic */}
            <Box
              sx={{
                width: 110,
                height: 110,
                mx: 'auto',
                mb: 3,
                borderRadius: '50%',
                background: 'rgba(20, 20, 28, 0.9)',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 45px rgba(255, 210, 31, 0.15)',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 42, color: '#ffd21f' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
              Your repositories will appear here
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: 480, mx: 'auto', mb: 4 }}>
              Paste your first GitHub repository URL above to begin analysing its architecture, history, and intelligence.
            </Typography>

            {/* Popular Repository Tags */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', mr: 1 }}>
                OR TRY A POPULAR REPOSITORY
              </Typography>
              {POPULAR_REPOS.map((repo) => (
                <Chip
                  key={repo.name}
                  icon={<GitHubIcon sx={{ fontSize: '13px !important', color: '#94a3b8 !important' }} />}
                  label={repo.name}
                  onClick={() => handlePopularClick(repo.url)}
                  sx={{
                    background: '#161622',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    py: 1.2,
                    px: 0.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(255, 210, 31, 0.12)',
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#ffd21f',
                    boxShadow: '0 0 10px #ffd21f',
                  }}
                />
                <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
                  Connected Repositories ({filteredRepos.length})
                </Typography>
              </Box>

              {/* Search filter */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(16, 16, 22, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  px: 1.8,
                  py: 0.4,
                  width: { xs: 180, sm: 240 },
                  transition: 'all 0.2s ease',
                  '&:focus-within': {
                    borderColor: '#ffd21f',
                    boxShadow: '0 0 14px rgba(255, 210, 31, 0.15)',
                  },
                }}
              >
                <SearchIcon sx={{ color: '#64748b', fontSize: 18, mr: 1 }} />
                <TextField
                  variant="standard"
                  placeholder="Filter repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      sx: {
                        color: '#ffffff',
                        fontSize: '0.825rem',
                        '& input::placeholder': { color: '#64748b', opacity: 1 },
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
                      sx={{
                        background: 'rgba(18, 18, 24, 0.65)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        position: 'relative',
                        '&:hover': {
                          border: '1px solid rgba(255, 210, 31, 0.4)',
                          background: 'rgba(22, 22, 30, 0.85)',
                          transform: 'translateY(-3px)',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(255, 210, 31, 0.08)',
                        },
                      }}
                      onClick={() => navigate(`/repository/${repo.id}`)}
                    >
                      <CardContent sx={{ p: 2.8 }}>
                        {/* Repo Icon & Header */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.8 }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '10px',
                              background: '#12121a',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <GitHubIcon sx={{ color: '#ffffff', fontSize: 20 }} />
                          </Box>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              noWrap
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.95rem',
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
                              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {primaryLang} • {formatTimeAgo(repo.created_at)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Delete button */}
                          <Tooltip title="Delete Repository">
                            <IconButton
                              size="small"
                              onClick={(e) => handleDeleteClick(e, repo)}
                              sx={{
                                color: '#64748b',
                                p: 0.6,
                                transition: 'color 0.2s',
                                '&:hover': { color: '#ef5350' },
                              }}
                            >
                              <DeleteOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        {/* Description preview */}
                        {repo.description ? (
                          <Typography
                            sx={{
                              fontSize: '0.82rem',
                              color: '#94a3b8',
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              minHeight: 38,
                            }}
                          >
                            {repo.description}
                          </Typography>
                        ) : (
                          <Typography sx={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', minHeight: 38 }}>
                            No repository description provided.
                          </Typography>
                        )}
                      </CardContent>

                      {/* Card Footer Actions */}
                      <Box
                        sx={{
                          px: 2.8,
                          py: 1.6,
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          background: 'rgba(12, 12, 16, 0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <StatusBadge status={repo.status} />

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {/* Direct AI Chat Launcher button */}
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/repository/${repo.id}/chat`);
                            }}
                            startIcon={<ChatOutlinedIcon sx={{ fontSize: '14px !important', color: '#ffd21f' }} />}
                            sx={{
                              fontSize: '0.725rem',
                              textTransform: 'none',
                              fontWeight: 700,
                              color: '#ffffff',
                              borderRadius: '8px',
                              px: 1.4,
                              py: 0.4,
                              background: 'rgba(255, 210, 31, 0.08)',
                              border: '1px solid rgba(255, 210, 31, 0.3)',
                              '&:hover': {
                                background: 'rgba(255, 210, 31, 0.18)',
                                borderColor: '#ffd21f',
                              },
                            }}
                          >
                            AI Chat
                          </Button>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarBorderIcon sx={{ fontSize: 14, color: '#64748b' }} />
                            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {repo.file_count || 0}
                            </Typography>
                          </Box>
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
                    background: 'rgba(10, 10, 14, 0.5)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3.5,
                    textAlign: 'center',
                    minHeight: 180,
                    height: '100%',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(255, 210, 31, 0.4)',
                      background: 'rgba(16, 16, 22, 0.7)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#161622',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1.5,
                    }}
                  >
                    <SearchIcon sx={{ color: '#ffd21f', fontSize: 20 }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', mb: 0.5 }}>
                    Discover More
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 220 }}>
                    Connect organizational repos or explore open source codebases
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
              background: '#121218',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
            },
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem' }}>
          Delete Repository
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#ffd21f' }}>
              {repoToDelete?.owner}/{repoToDelete?.name}
            </strong>
            ? All indexed AST symbols, pgvector embeddings, and commit memory for this repository will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{
              color: '#94a3b8',
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              px: 2,
              '&:hover': { background: '#1a1a24', color: '#ffffff' },
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
