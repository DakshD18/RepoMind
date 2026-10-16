import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Divider,
  Avatar,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CommitIcon from '@mui/icons-material/Commit';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import { getDashboardRepository, analyseRepository, indexRepository } from '../services/api';
import type { Repository } from '../types';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isStatus?: boolean;
}

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

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, isStatus }) => (
  <Card
    sx={{
      background: 'rgba(18, 18, 24, 0.65)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      p: 2.8,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: 'rgba(255, 210, 31, 0.4)',
        background: 'rgba(22, 22, 30, 0.85)',
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2, color: '#94a3b8' }}>
      <Box sx={{ display: 'flex', p: 0.5, borderRadius: '6px', background: 'rgba(255, 210, 31, 0.08)', color: '#ffd21f' }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>
        {label}
      </Typography>
    </Box>

    <Typography
      sx={{
        fontSize: isStatus ? '1.15rem' : '1.75rem',
        fontWeight: 800,
        color: isStatus ? '#ffd21f' : '#ffffff',
        lineHeight: 1.1,
      }}
    >
      {value}
    </Typography>
  </Card>
);

// Format relative time from ISO date
const formatLastCommit = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
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

export const RepositoryOverview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReanalysing, setIsReanalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isIndexing, setIsIndexing] = useState(false);

  useEffect(() => {
    fetchRepoData();
  }, [id]);

  const fetchRepoData = async () => {
    if (!id) return;
    try {
      const data = await getDashboardRepository(Number(id));
      setRepo(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load repository data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndex = async () => {
    if (!repo || isIndexing) return;
    setIsIndexing(true);
    const toastId = toast.loading('Indexing repository for AI chat...');
    try {
      await indexRepository(repo.id);
      // Poll until indexed
      const poll = setInterval(async () => {
        const updated = await getDashboardRepository(repo.id);
        setRepo(updated);
        if (updated.is_indexed) {
          clearInterval(poll);
          setIsIndexing(false);
          toast.success('Repository indexed! AI chat is now available.', { id: toastId });
        } else if (updated.index_status === 'failed') {
          clearInterval(poll);
          setIsIndexing(false);
          toast.error('Indexing failed. Please try again.', { id: toastId });
        }
      }, 3000);
    } catch {
      setIsIndexing(false);
      toast.error('Failed to start indexing.', { id: toastId });
    }
  };

  const handleReanalyse = async () => {
    if (!repo?.url || isReanalysing) return;
    setIsReanalysing(true);
    const toastId = toast.loading('Re-analysing repository...');
    try {
      await analyseRepository(repo.url);
      await fetchRepoData();
      toast.success('Repository re-analysis complete!', { id: toastId });
    } catch {
      toast.error('Re-analysis failed.', { id: toastId });
    } finally {
      setIsReanalysing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <CircularProgress sx={{ color: '#ffd21f' }} size={40} />
        </Box>
      </DashboardLayout>
    );
  }

  if (error || !repo) {
    return (
      <DashboardLayout>
        <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: '#ef5350', fontSize: '1.1rem', mb: 3 }}>
            {error || 'Repository not found.'}
          </Typography>
          <Button
            onClick={() => navigate('/dashboard')}
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            sx={{ color: '#ffd21f', borderColor: 'rgba(255,210,31,0.4)', borderRadius: '10px' }}
          >
            Back to Dashboard
          </Button>
        </Container>
      </DashboardLayout>
    );
  }

  const primaryLang = repo.languages[0] || 'JavaScript';
  const primaryLangColor = LANG_COLORS[primaryLang] || '#ffd21f';
  const commits = repo.recent_commits || [];

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Back button & Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Typography
            onClick={() => navigate('/dashboard')}
            sx={{ color: '#ffd21f', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            Dashboard
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '0.85rem' }}>/</Typography>
          <Typography sx={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
            {repo.owner}/{repo.name}
          </Typography>
        </Box>

        {/* Main Repository Header Banner */}
        <Card
          sx={{
            background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.85) 0%, rgba(14, 14, 18, 0.95) 100%)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '18px',
            p: { xs: 3, md: 4 },
            mb: 4,
            boxShadow: '0 16px 45px rgba(0,0,0,0.7)',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              {/* Pills */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.8 }}>
                <Chip
                  icon={<GitHubIcon sx={{ fontSize: '13px !important', color: '#94a3b8 !important' }} />}
                  label={repo.owner}
                  size="small"
                  sx={{ background: 'rgba(255, 255, 255, 0.05)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.725rem' }}
                />
                <Chip
                  label={repo.name}
                  size="small"
                  sx={{ background: 'rgba(255, 210, 31, 0.12)', color: '#ffd21f', border: '1px solid rgba(255, 210, 31, 0.35)', fontWeight: 700, fontSize: '0.725rem' }}
                />
                <Chip
                  label="Public"
                  size="small"
                  sx={{ background: 'rgba(255, 255, 255, 0.04)', color: '#64748b', border: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.7rem' }}
                />
              </Box>

              {/* Title & Description */}
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1, letterSpacing: '-0.025em', fontSize: { xs: '1.6rem', sm: '1.9rem' } }}>
                {repo.description || `${repo.owner}/${repo.name}`}
              </Typography>

              {/* Sub Meta Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', mt: 2.2, color: '#94a3b8', fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <StarBorderIcon sx={{ fontSize: 16, color: '#64748b' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.file_count.toLocaleString()} files</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <CallSplitIcon sx={{ fontSize: 16, color: '#64748b' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.branches.length} branches</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <AccountTreeIcon sx={{ fontSize: 16, color: '#64748b' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.default_branch || 'main'}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: primaryLangColor }} />
                  <Typography sx={{ fontSize: '0.825rem', color: '#ffffff', fontWeight: 600 }}>{primaryLang}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Header Right Action Buttons */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
              <Button
                component="a"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
                sx={{
                  height: 44,
                  borderRadius: '10px',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  background: 'rgba(20, 20, 28, 0.6)',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  px: 2.2,
                  '&:hover': {
                    borderColor: 'rgba(255, 210, 31, 0.4)',
                    background: 'rgba(24, 24, 34, 0.9)',
                    color: '#ffffff',
                  },
                }}
              >
                View on GitHub
              </Button>

              <Button
                variant="contained"
                startIcon={
                  isIndexing
                    ? <CircularProgress size={16} sx={{ color: '#050507' }} />
                    : <ChatOutlinedIcon sx={{ fontSize: 18 }} />
                }
                onClick={() => {
                  if (repo.is_indexed) {
                    navigate(`/repository/${id}/chat`);
                  } else if (!isIndexing) {
                    handleIndex();
                  }
                }}
                disabled={isIndexing}
                sx={{
                  height: 44,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                  color: '#050507',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  px: 2.8,
                  boxShadow: '0 4px 18px rgba(255, 210, 31, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                    boxShadow: '0 6px 24px rgba(255, 210, 31, 0.45)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 210, 31, 0.3)',
                    color: '#050507',
                  },
                }}
              >
                {repo.is_indexed
                  ? 'Ask AI Intelligence'
                  : isIndexing
                    ? 'Indexing...'
                    : 'Index & Chat'}
              </Button>
            </Box>
          </Box>
        </Card>

        {/* 5 Metric Cards Row */}
        <Grid container spacing={2} sx={{ mb: 4.5 }}>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<InsertDriveFileIcon fontSize="small" />}
              label="FILES"
              value={repo.file_count > 0 ? repo.file_count.toLocaleString() : '0'}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<FolderIcon fontSize="small" />}
              label="FOLDERS"
              value={repo.folder_count > 0 ? repo.folder_count.toLocaleString() : '0'}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<CodeIcon fontSize="small" />}
              label="LANGUAGES"
              value={repo.languages.length > 0 ? repo.languages.length : 0}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
            <MetricCard
              icon={<CommitIcon fontSize="small" />}
              label="LAST COMMIT"
              value={formatLastCommit(repo.last_commit_date)}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <MetricCard
              icon={<CheckCircleIcon fontSize="small" />}
              label="ANALYSIS STATUS"
              value={repo.status === 'SUCCESS' ? 'Complete' : repo.status === 'PROCESSING' ? 'Processing' : repo.status === 'PENDING' ? 'Pending' : 'Failed'}
              isStatus={repo.status === 'SUCCESS'}
            />
          </Grid>
        </Grid>

        {/* Quick Actions Section */}
        <Box sx={{ mb: 4.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff', mb: 2 }}>
            Intelligence Actions
          </Typography>

          <Grid container spacing={2.5}>
            {[
              {
                title: 'Chat with Repository',
                desc: 'Ask questions about code, architecture, or logic with 100% grounded citations.',
                icon: <ChatOutlinedIcon sx={{ color: '#ffd21f' }} />,
                onClick: () => navigate(`/repository/${id}/chat`),
              },
              {
                title: 'Impact Analysis',
                desc: 'Trace direct and transitive dependents, risk levels, and cascading consequences.',
                icon: <FlashOnIcon sx={{ color: '#ffd21f' }} />,
                onClick: () => navigate(`/repository/${id}/impact`),
              },
              {
                title: 'Repository Health',
                desc: 'Identify technical debt, security issues, and maintainability metrics.',
                icon: <HealthAndSafetyOutlinedIcon sx={{ color: '#ffd21f' }} />,
              },
              {
                title: 'Reanalyse',
                desc: 'Sync latest GitHub commits and regenerate pgvector embeddings.',
                icon: <RefreshIcon sx={{ color: '#ffd21f' }} />,
                onClick: handleReanalyse,
              },
            ].map((action) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.title}>
                <Card
                  onClick={action.onClick}
                  sx={{
                    background: 'rgba(18, 18, 24, 0.65)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    p: 3,
                    height: '100%',
                    cursor: action.onClick ? 'pointer' : 'default',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: 'rgba(255, 210, 31, 0.45)',
                      background: 'rgba(22, 22, 30, 0.85)',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(255, 210, 31, 0.08)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      background: '#12121a',
                      border: '1px solid rgba(255, 210, 31, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', mb: 0.6 }}>
                    {action.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.55 }}>
                    {action.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Recent Activity Section — real commit data from backend */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>
              Indexed Repository Memory ({commits.length})
            </Typography>
          </Box>

          <Card
            sx={{
              background: 'rgba(18, 18, 24, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {commits.length === 0 ? (
              <Box sx={{ p: 5, textAlign: 'center' }}>
                <CommitIcon sx={{ fontSize: 36, color: '#64748b', mb: 1.5 }} />
                <Typography sx={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>
                  No commit history available yet.
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.5 }}>
                  Re-analyse the repository to fetch and index commit memory.
                </Typography>
              </Box>
            ) : (
              commits.map((commit, idx) => (
                <Box key={`${commit.hash}-${idx}`}>
                  <Box
                    sx={{
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                      transition: 'background 0.15s ease',
                      '&:hover': { background: 'rgba(255, 255, 255, 0.03)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#161622',
                          color: '#ffd21f',
                          border: '1px solid rgba(255, 210, 31, 0.35)',
                          flexShrink: 0,
                        }}
                      >
                        {commit.initials}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                            {commit.author}
                          </Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                            committed
                          </Typography>
                          <Typography
                            noWrap
                            sx={{ fontSize: '0.88rem', fontWeight: 500, color: '#e2e8f0', maxWidth: { xs: 200, sm: 400, md: 550 } }}
                          >
                            {commit.message}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                            🕒 {commit.time}
                          </Typography>
                          <Chip
                            label={`⎇ ${commit.branch}`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: '#94a3b8',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              borderRadius: '4px',
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#ffd21f', background: 'rgba(255, 210, 31, 0.08)', px: 1, py: 0.3, borderRadius: '4px', border: '1px solid rgba(255, 210, 31, 0.25)', flexShrink: 0 }}>
                      {commit.hash}
                    </Typography>
                  </Box>
                  {idx < commits.length - 1 && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />}
                </Box>
              ))
            )}
          </Card>
        </Box>
      </Container>
    </DashboardLayout>
  );
};

export default RepositoryOverview;
