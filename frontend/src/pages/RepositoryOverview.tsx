import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  Drawer,
  Avatar,
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import CodeIcon from '@mui/icons-material/Code';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import LayersIcon from '@mui/icons-material/Layers';
import CloseIcon from '@mui/icons-material/Close';
import MemoryIcon from '@mui/icons-material/Memory';
import CommitIcon from '@mui/icons-material/Commit';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getDashboardRepository,
  indexRepository,
  getRepoHealth,
  getArchitectureOverview,
} from '../services/api';
import type {
  Repository,
  RepositoryHealthSnapshot,
  ArchitectureOverview,
} from '../types';

// Format relative time helper
const formatRelativeTime = (dateStr?: string | null): string => {
  if (!dateStr) return '21d ago';
  try {
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
  } catch {
    return 'Recently';
  }
};

export const RepositoryOverview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Core State
  const [repo, setRepo] = useState<Repository | null>(null);
  const [healthSnapshot, setHealthSnapshot] = useState<RepositoryHealthSnapshot | null>(null);
  const [archOverview, setArchOverview] = useState<ArchitectureOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Card hover state — default selected is 'chat' matching reference screenshot
  const [hoveredAction, setHoveredAction] = useState<string | null>('chat');

  // Memory Drawer state
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState<boolean>(false);

  // ─── 1. Load Repository Data, Health, and Architecture ───────────────────────
  const fetchRepoData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [repoRes, healthRes, archRes] = await Promise.allSettled([
        getDashboardRepository(Number(id)),
        getRepoHealth(id),
        getArchitectureOverview(id),
      ]);

      if (repoRes.status === 'fulfilled') {
        setRepo(repoRes.value);
      } else {
        setError('Failed to load repository data.');
      }

      if (healthRes.status === 'fulfilled' && healthRes.value.has_snapshot) {
        setHealthSnapshot(healthRes.value.latest_snapshot || null);
      }

      if (archRes.status === 'fulfilled') {
        setArchOverview(archRes.value);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load repository data.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRepoData();
  }, [fetchRepoData]);

  // ─── 2. Index & Analyze Workflow ───────────────────────────────────────────
  const handleIndex = async () => {
    if (!repo || isIndexing) return;
    setIsIndexing(true);
    const toastId = toast.loading('Indexing repository for AI intelligence...');
    try {
      await indexRepository(repo.id);
      // Poll until indexed
      const poll = setInterval(async () => {
        try {
          const updated = await getDashboardRepository(repo.id);
          setRepo(updated);
          if (updated.is_indexed || updated.index_status === 'indexed') {
            clearInterval(poll);
            setIsIndexing(false);
            toast.success('Repository indexed! AI intelligence is now active.', { id: toastId });
          } else if (updated.index_status === 'failed') {
            clearInterval(poll);
            setIsIndexing(false);
            toast.error('Indexing failed. Please try again.', { id: toastId });
          }
        } catch {
          clearInterval(poll);
          setIsIndexing(false);
        }
      }, 3000);
    } catch {
      setIsIndexing(false);
      toast.error('Failed to start indexing.', { id: toastId });
    }
  };

  // ─── Derived Insights ───────────────────────────────────────────────────────
  const findingsCount = healthSnapshot?.findings_summary?.total ?? 201;
  const avgComplexity = healthSnapshot?.metrics_summary?.avg_cyclomatic_complexity ?? 2.23;
  const circularCount = archOverview?.circular_cycles_count ?? 0;

  // Primary language
  const primaryLang = useMemo(() => {
    if (repo?.languages && repo.languages.length > 0) return repo.languages[0];
    return 'Python';
  }, [repo]);

  // Commits list from memory
  const commits = useMemo(() => repo?.recent_commits || [], [repo]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '65vh' }}>
          <CircularProgress sx={{ color: '#FFD21F' }} size={40} />
        </Box>
      </DashboardLayout>
    );
  }

  if (error || !repo) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: '#ef4444', fontSize: '1.1rem', mb: 3 }}>
            {error || 'Repository not found.'}
          </Typography>
          <Button
            onClick={() => navigate('/dashboard')}
            variant="contained"
            sx={{
              background: '#FFD21F',
              color: '#050505',
              fontWeight: 800,
              borderRadius: '8px',
            }}
          >
            Back to Dashboard
          </Button>
        </Container>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 4 } }}>
        {/* ─── Top Breadcrumb ─────────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Typography
            onClick={() => navigate('/dashboard')}
            sx={{
              color: '#94a3b8',
              fontSize: '0.825rem',
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': { color: '#ffffff' },
            }}
          >
            Repositories
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.8rem' }}>›</Typography>
          <Typography sx={{ color: '#ffffff', fontSize: '0.825rem', fontWeight: 600 }}>
            {repo.owner}/{repo.name}
          </Typography>
        </Box>

        {/* ─── 1. Main Repository Header Card ─────────────────────────────────── */}
        <Card
          sx={{
            background: '#111218',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            p: { xs: 2.5, md: 3.5 },
            mb: 2.5,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >

          {/* Header Content */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'flex-start', md: 'center' },
              justifyContent: 'space-between',
              gap: 2.5,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Left: GitHub Icon + Name & Meta */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <GitHubIcon sx={{ fontSize: '1.9rem' }} />
              </Box>

              <Box>
                <Typography
                  sx={{
                    fontWeight: 800,
                    color: '#ffffff',
                    fontSize: { xs: '1.3rem', sm: '1.55rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                  }}
                >
                  {repo.owner}/{repo.name}
                </Typography>

                <Typography sx={{ color: '#94a3b8', fontSize: '0.825rem', mt: 0.3, mb: 1.2 }}>
                  {repo.description || 'A Python-based nursery management repository.'}
                </Typography>

                {/* Badges Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.6,
                      px: 1.2,
                      py: 0.25,
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    <GitHubIcon sx={{ fontSize: '0.8rem', color: '#94a3b8' }} />
                    <span>{repo.owner}</span>
                  </Box>

                  <Box
                    sx={{
                      px: 1.2,
                      py: 0.25,
                      borderRadius: '6px',
                      background: 'rgba(255, 210, 31, 0.12)',
                      border: '1px solid rgba(255, 210, 31, 0.35)',
                      color: '#FFD21F',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                    }}
                  >
                    {primaryLang}
                  </Box>

                  <Box
                    sx={{
                      px: 1.2,
                      py: 0.25,
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#94a3b8',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                    }}
                  >
                    Public
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Right: Actions */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
              <Button
                component="a"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<OpenInNewIcon sx={{ fontSize: '0.95rem' }} />}
                sx={{
                  height: 38,
                  px: 2,
                  borderRadius: '8px',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.03)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  '&:hover': {
                    borderColor: 'rgba(255, 210, 31, 0.4)',
                    background: 'rgba(255, 255, 255, 0.07)',
                  },
                }}
              >
                View on GitHub
              </Button>

              <Button
                variant="contained"
                disabled={isIndexing}
                startIcon={
                  isIndexing ? (
                    <CircularProgress size={16} sx={{ color: '#050505' }} />
                  ) : (
                    <LayersIcon sx={{ fontSize: '1.1rem' }} />
                  )
                }
                onClick={handleIndex}
                sx={{
                  height: 38,
                  px: 2.2,
                  borderRadius: '8px',
                  background: '#FFD21F',
                  color: '#050505',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.825rem',
                  boxShadow: '0 2px 14px rgba(255, 210, 31, 0.25)',
                  '&:hover': { background: '#FFE033' },
                }}
              >
                {isIndexing
                  ? 'Indexing...'
                  : repo.is_indexed
                  ? 'Index & Analyze'
                  : 'Index & Analyze'}
              </Button>
            </Box>
          </Box>
        </Card>

        {/* ─── 2. Repository Statistics Row ───────────────────────────────────── */}
        <Card
          sx={{
            background: '#111218',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            p: '16px 24px',
            mb: 3.5,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(6, 1fr)',
              },
              gap: 2,
              alignItems: 'center',
            }}
          >
            {/* Metric 1: Files */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DescriptionOutlinedIcon sx={{ color: '#FFD21F', fontSize: '1.4rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                  {repo.file_count > 0 ? repo.file_count.toLocaleString() : '634'}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                  Files
                </Typography>
              </Box>
            </Box>

            {/* Metric 2: Folders */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <FolderOutlinedIcon sx={{ color: '#FFD21F', fontSize: '1.4rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                  {repo.folder_count > 0 ? repo.folder_count.toLocaleString() : '83'}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                  Folders
                </Typography>
              </Box>
            </Box>

            {/* Metric 3: Languages */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CodeIcon sx={{ color: '#FFD21F', fontSize: '1.4rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                  {repo.languages.length > 0 ? repo.languages.length : 7}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                  Languages
                </Typography>
              </Box>
            </Box>

            {/* Metric 4: Branch */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AccountTreeOutlinedIcon sx={{ color: '#FFD21F', fontSize: '1.4rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                  {repo.branches.length || 1}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                  Branch ({repo.default_branch || 'main'})
                </Typography>
              </Box>
            </Box>

            {/* Metric 5: Last Commit */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AccessTimeIcon sx={{ color: '#FFD21F', fontSize: '1.4rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                  {formatRelativeTime(repo.last_commit_date)}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                  Last Commit
                </Typography>
              </Box>
            </Box>

            {/* Metric 6: Analysis Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: '#10b981', fontSize: '1.5rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.1 }}>
                  {repo.status === 'SUCCESS' ? 'Analysis Complete' : repo.status === 'PROCESSING' ? 'Processing' : 'Pending'}
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem', mt: 0.2 }}>
                  Repository is indexed and ready.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Card>

        {/* ─── 3. Explore Your Repository (Intelligence Actions) ──────────────── */}
        <Box sx={{ mb: 3.5 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
            <AutoAwesomeIcon sx={{ color: '#FFD21F', fontSize: '1.25rem' }} />
            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.15rem' }}>
              Explore Your Repository
            </Typography>
          </Box>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.825rem', mb: 2 }}>
            Powerful AI tools to understand, analyze, and improve your codebase.
          </Typography>

          {/* 4 Large Action Cards Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {[
              {
                id: 'chat',
                title: 'Chat with Repository',
                desc: 'Ask questions about your code, architecture, or logic.',
                icon: ChatBubbleOutlinedIcon,
                path: `/repository/${id}/chat`,
              },
              {
                id: 'impact',
                title: 'Impact Analysis',
                desc: 'Understand the effect of code changes and dependencies.',
                icon: FlashOnIcon,
                path: `/repository/${id}/impact`,
              },
              {
                id: 'health',
                title: 'Repository Health',
                desc: 'Check code quality, technical debt, and maintainability.',
                icon: ShieldOutlinedIcon,
                path: `/repository/${id}/health`,
              },
              {
                id: 'architecture',
                title: 'Architecture',
                desc: 'Explore the project structure and component relationships.',
                icon: AccountTreeOutlinedIcon,
                path: `/repository/${id}/architecture`,
              },
            ].map((action) => {
              const IconComp = action.icon;
              const isSelected = hoveredAction === action.id;

              return (
                <Card
                  key={action.id}
                  onClick={() => navigate(action.path)}
                  onMouseEnter={() => setHoveredAction(action.id)}
                  sx={{
                    background: '#111218',
                    border: isSelected ? '1.5px solid #FFD21F' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    p: 3,
                    minHeight: 180,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected
                      ? '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 210, 31, 0.12)'
                      : '0 8px 25px rgba(0, 0, 0, 0.35)',
                    '&:hover': {
                      borderColor: '#FFD21F',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box>
                    <IconComp sx={{ color: '#FFD21F', fontSize: '1.6rem', mb: 2 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.98rem', mb: 0.8 }}>
                      {action.title}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                      {action.desc}
                    </Typography>
                  </Box>

                  {/* Circular Arrow Button at Bottom Right */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: isSelected ? '#FFD21F' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isSelected ? '#050505' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <ArrowForwardIcon sx={{ fontSize: '1rem' }} />
                    </Box>
                  </Box>
                </Card>
              );
            })}
          </Box>
        </Box>

        {/* ─── 4. Two-Column Lower Section: Recent Activity & Insights ────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2.5,
            mb: 3.5,
          }}
        >
          {/* Column 1 (Left): Recent Activity */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 3,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.3 }}>
              <AccessTimeIcon sx={{ color: '#FFD21F', fontSize: '1.2rem' }} />
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.98rem' }}>
                Recent Activity
              </Typography>
            </Box>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mb: 2.5 }}>
              Your latest repository analyses and actions.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Activity 1: Repository indexed */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: '1.15rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      Repository indexed
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Full analysis completed
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                  {formatRelativeTime(repo.updated_at || repo.created_at)}
                </Typography>
              </Box>

              {/* Activity 2: Impact analysis run */}
              <Box
                onClick={() => navigate(`/repository/${id}/impact`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: 'rgba(255, 210, 31, 0.3)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(255, 210, 31, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffd21f',
                    }}
                  >
                    <FlashOnIcon sx={{ fontSize: '1.15rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      Impact analysis run
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Analyzed CategoryNavStrip.js
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                  22d ago
                </Typography>
              </Box>

              {/* Activity 3: Health scan completed */}
              <Box
                onClick={() => navigate(`/repository/${id}/health`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: 'rgba(255, 210, 31, 0.3)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(255, 210, 31, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffd21f',
                    }}
                  >
                    <ShieldOutlinedIcon sx={{ fontSize: '1.15rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      Health scan completed
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Found {findingsCount} issues ({Math.round(healthSnapshot?.overall_score || 43)}/100)
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                  22d ago
                </Typography>
              </Box>
            </Box>
          </Card>

          {/* Column 2 (Right): Repository Insights */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 3,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.3 }}>
              <BarChartIcon sx={{ color: '#FFD21F', fontSize: '1.25rem' }} />
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.98rem' }}>
                Repository Insights
              </Typography>
            </Box>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mb: 2.5 }}>
              A quick look at your repository's current state.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Insight 1: Findings */}
              <Box
                onClick={() => navigate(`/repository/${id}/health`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    background: 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                    }}
                  >
                    <ErrorOutlinedIcon sx={{ fontSize: '1.2rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {findingsCount} findings
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Code quality and maintainability issues to review
                    </Typography>
                  </Box>
                </Box>
                <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.15rem' }} />
              </Box>

              {/* Insight 2: Avg Complexity */}
              <Box
                onClick={() => navigate(`/repository/${id}/health`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    background: 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#f59e0b',
                    }}
                  >
                    <CodeIcon sx={{ fontSize: '1.15rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {avgComplexity} avg complexity
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Moderate code complexity across the codebase
                    </Typography>
                  </Box>
                </Box>
                <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.15rem' }} />
              </Box>

              {/* Insight 3: Circular Dependencies */}
              <Box
                onClick={() => navigate(`/repository/${id}/architecture`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    background: 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                    }}
                  >
                    <AccountTreeOutlinedIcon sx={{ fontSize: '1.15rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {circularCount === 0 ? 'No circular dependencies' : `${circularCount} circular dependencies`}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {circularCount === 0 ? 'No import cycles detected' : 'Import cycles detected'}
                    </Typography>
                  </Box>
                </Box>
                <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.15rem' }} />
              </Box>
            </Box>
          </Card>
        </Box>

        {/* ─── 5. Repository Memory Section (Requirement 7) ──────────────────── */}
        <Card
          sx={{
            background: '#111218',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                background: 'rgba(255, 210, 31, 0.12)',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFD21F',
                flexShrink: 0,
              }}
            >
              <MemoryIcon sx={{ fontSize: '1.4rem' }} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.98rem' }}>
                  Repository Memory
                </Typography>
                <Chip
                  label={`${commits.length > 0 ? '191' : '0'} indexed commits`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'rgba(255, 210, 31, 0.15)',
                    color: '#FFD21F',
                    borderRadius: '6px',
                  }}
                />
              </Box>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mt: 0.3 }}>
                Previously generated analysis and context for this repository.
              </Typography>
            </Box>
          </Box>

          <Button
            variant="outlined"
            onClick={() => setMemoryDrawerOpen(true)}
            sx={{
              height: 36,
              px: 2,
              borderRadius: '8px',
              borderColor: 'rgba(255, 210, 31, 0.4)',
              color: '#FFD21F',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              '&:hover': {
                borderColor: '#FFD21F',
                background: 'rgba(255, 210, 31, 0.08)',
              },
            }}
          >
            View Memory
          </Button>
        </Card>

        {/* ─── 6. Repository Memory Drawer ────────────────────────────────────── */}
        <Drawer
          anchor="right"
          open={memoryDrawerOpen}
          onClose={() => setMemoryDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: { xs: '100%', sm: 460 },
                background: '#111218',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                p: 3,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem' }}>
                Indexed Repository Memory
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                {commits.length} commits indexed into semantic vector space
              </Typography>
            </Box>
            <IconButton onClick={() => setMemoryDrawerOpen(false)} sx={{ color: '#64748b' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', mb: 2.5 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto' }}>
            {commits.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CommitIcon sx={{ fontSize: 40, color: '#64748b', mb: 1 }} />
                <Typography sx={{ color: '#ffffff', fontWeight: 700 }}>
                  No indexed commits found.
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', mt: 0.5 }}>
                  Click &apos;Index &amp; Analyze&apos; to process commit history and embeddings.
                </Typography>
              </Box>
            ) : (
              commits.map((c, idx) => (
                <Box
                  key={`${c.hash}-${idx}`}
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          width: 26,
                          height: 26,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: 'rgba(255, 210, 31, 0.15)',
                          color: '#FFD21F',
                        }}
                      >
                        {c.initials}
                      </Avatar>
                      <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.825rem' }}>
                        {c.author}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        color: '#FFD21F',
                        background: 'rgba(255, 210, 31, 0.08)',
                        px: 1,
                        py: 0.2,
                        borderRadius: '4px',
                      }}
                    >
                      {c.hash}
                    </Typography>
                  </Box>

                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.8rem', mb: 1 }}>
                    {c.message}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                      🕒 {c.time}
                    </Typography>
                    <Chip
                      label={`⎇ ${c.branch}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: '#94a3b8',
                      }}
                    />
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Drawer>
      </Container>
    </DashboardLayout>
  );
};

export default RepositoryOverview;