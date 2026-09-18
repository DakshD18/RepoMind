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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getDashboardRepository, analyseRepository, indexRepository } from '../services/api';
import type { Repository } from '../types';
import toast from 'react-hot-toast';

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
      background: '#111111',
      border: '1px solid #262626',
      borderRadius: '14px',
      p: 2.5,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: 'rgba(255, 210, 31, 0.35)',
        background: '#151515',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#737373' }}>
      <Box sx={{ display: 'flex', color: isStatus ? '#ffd21f' : '#ffd21f' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#737373' }}>
        {label}
      </Typography>
    </Box>

    <Typography
      sx={{
        fontSize: isStatus ? '1.15rem' : '1.75rem',
        fontWeight: 800,
        color: isStatus ? '#ffd21f' : '#ffffff',
        lineHeight: 1,
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
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
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
            sx={{ color: '#ffd21f', borderColor: 'rgba(255,210,31,0.4)' }}
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
            sx={{ color: '#ffd21f', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            RepoMind
          </Typography>
          <Typography sx={{ color: '#737373', fontSize: '0.85rem' }}>/</Typography>
          <Typography sx={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 600 }}>
            {repo.owner}/{repo.name}
          </Typography>
        </Box>

        {/* Main Repository Header Banner */}
        <Card
          sx={{
            background: '#111111',
            border: '1px solid #262626',
            borderRadius: '16px',
            p: { xs: 3, md: 3.5 },
            mb: 3.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              {/* Pills */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Chip
                  icon={<GitHubIcon sx={{ fontSize: '13px !important', color: '#a3a3a3 !important' }} />}
                  label={repo.owner}
                  size="small"
                  sx={{ background: '#161616', color: '#e5e5e5', border: '1px solid #262626', fontSize: '0.725rem' }}
                />
                <Chip
                  label={repo.name}
                  size="small"
                  sx={{ background: 'rgba(255, 210, 31, 0.1)', color: '#ffd21f', border: '1px solid rgba(255, 210, 31, 0.3)', fontWeight: 700, fontSize: '0.725rem' }}
                />
                <Chip
                  label="Public"
                  size="small"
                  sx={{ background: '#161616', color: '#737373', border: '1px solid #262626', fontSize: '0.7rem' }}
                />
              </Box>

              {/* Title & Description */}
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1, letterSpacing: '-0.02em', fontSize: { xs: '1.5rem', sm: '1.8rem' } }}>
                {repo.description || `${repo.owner}/${repo.name}`}
              </Typography>

              {/* Sub Meta Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mt: 2, color: '#a3a3a3', fontSize: '0.825rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarBorderIcon sx={{ fontSize: 15, color: '#737373' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.file_count.toLocaleString()}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CallSplitIcon sx={{ fontSize: 15, color: '#737373' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.branches.length}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccountTreeIcon sx={{ fontSize: 15, color: '#737373' }} />
                  <Typography sx={{ fontSize: '0.825rem' }}>{repo.default_branch || 'main'}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: primaryLangColor }} />
                  <Typography sx={{ fontSize: '0.825rem', color: '#ffffff' }}>{primaryLang}</Typography>
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
                  height: 40,
                  borderRadius: '8px',
                  borderColor: '#262626',
                  color: '#e5e5e5',
                  background: '#151515',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  px: 2,
                  '&:hover': {
                    borderColor: '#333333',
                    background: '#1a1a1a',
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
                    ? <CircularProgress size={16} sx={{ color: '#050505' }} />
                    : <ChatOutlinedIcon sx={{ fontSize: 17 }} />
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
                  height: 40,
                  borderRadius: '8px',
                  background: '#ffd21f',
                  color: '#050505',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  px: 2.5,
                  boxShadow: '0 2px 14px rgba(255, 210, 31, 0.3)',
                  '&:hover': {
                    background: '#ffe033',
                    boxShadow: '0 4px 20px rgba(255, 210, 31, 0.45)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 210, 31, 0.3)',
                    color: '#050505',
                  },
                }}
              >
                {repo.is_indexed
                  ? 'Ask AI'
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
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', mb: 2 }}>
            Quick Actions
          </Typography>

          <Grid container spacing={2.5}>
            {[
              {
                title: 'Chat with Repository',
                desc: 'Ask questions about code, architecture, or logic.',
                icon: <ChatOutlinedIcon sx={{ color: '#ffd21f' }} />,
                onClick: () => navigate(`/repository/${id}/chat`),
              },
              {
                title: 'View Architecture',
                desc: 'Interactive diagram of folders and dependencies.',
                icon: <AccountTreeIcon sx={{ color: '#ffd21f' }} />,
              },
              {
                title: 'Repository Health',
                desc: 'Identify technical debt and code quality issues.',
                icon: <HealthAndSafetyOutlinedIcon sx={{ color: '#ffd21f' }} />,
              },
              {
                title: 'Reanalyse',
                desc: 'Sync the latest commits and rebuild the index.',
                icon: <RefreshIcon sx={{ color: '#ffd21f' }} />,
                onClick: handleReanalyse,
              },
            ].map((action) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.title}>
                <Card
                  onClick={action.onClick}
                  sx={{
                    background: '#111111',
                    border: '1px solid #262626',
                    borderRadius: '14px',
                    p: 2.5,
                    height: '100%',
                    cursor: action.onClick ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(255, 210, 31, 0.4)',
                      background: '#151515',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.6), 0 0 15px rgba(255, 210, 31, 0.08)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: '8px',
                      background: '#161616',
                      border: '1px solid #262626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.925rem', color: '#ffffff', mb: 0.5 }}>
                    {action.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#737373', lineHeight: 1.5 }}>
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
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
              Recent Activity
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#ffd21f', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
              View all
            </Typography>
          </Box>

          <Card
            sx={{
              background: '#111111',
              border: '1px solid #262626',
              borderRadius: '14px',
            }}
          >
            {commits.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CommitIcon sx={{ fontSize: 32, color: '#333333', mb: 1 }} />
                <Typography sx={{ color: '#737373', fontSize: '0.875rem' }}>
                  No commit history available yet.
                </Typography>
                <Typography sx={{ color: '#555555', fontSize: '0.775rem', mt: 0.5 }}>
                  Re-analyse the repository with a deeper clone to fetch commits.
                </Typography>
              </Box>
            ) : (
              commits.map((commit, idx) => (
                <Box key={`${commit.hash}-${idx}`}>
                  <Box
                    sx={{
                      p: 2.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                      transition: 'background 0.15s ease',
                      '&:hover': { background: '#151515' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: '#1a1a1a',
                          color: '#ffd21f',
                          border: '1px solid rgba(255, 210, 31, 0.3)',
                          flexShrink: 0,
                        }}
                      >
                        {commit.initials}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                            {commit.author}
                          </Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: '#737373' }}>
                            committed
                          </Typography>
                          <Typography
                            noWrap
                            sx={{ fontSize: '0.85rem', fontWeight: 500, color: '#e5e5e5', maxWidth: { xs: 200, sm: 400, md: 500 } }}
                          >
                            {commit.message}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.4 }}>
                          <Typography sx={{ fontSize: '0.725rem', color: '#737373' }}>
                            🕒 {commit.time}
                          </Typography>
                          <Chip
                            label={`⎇ ${commit.branch}`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.625rem',
                              background: '#161616',
                              color: '#737373',
                              border: '1px solid #262626',
                              borderRadius: '4px',
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.725rem', color: '#737373', flexShrink: 0 }}>
                      {commit.hash}
                    </Typography>
                  </Box>
                  {idx < commits.length - 1 && <Divider sx={{ borderColor: '#1c1c1c' }} />}
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
