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
import { getDashboardRepository, analyseRepository } from '../services/api';
import type { Repository } from '../types';
import toast from 'react-hot-toast';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isStatus?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, isStatus }) => (
  <Card
    sx={{
      background: '#0d0d16',
      border: '1px solid rgba(255, 255, 255, 0.07)',
      borderRadius: '16px',
      p: 2.5,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: 'rgba(108, 99, 255, 0.3)',
        background: 'rgba(18, 18, 28, 0.9)',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#777799' }}>
      <Box sx={{ display: 'flex', color: isStatus ? '#00c896' : '#6c63ff' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
        {label}
      </Typography>
    </Box>

    <Typography
      sx={{
        fontSize: isStatus ? '1.25rem' : '1.75rem',
        fontWeight: 800,
        color: isStatus ? '#00c896' : '#ffffff',
        lineHeight: 1,
      }}
    >
      {value}
    </Typography>
  </Card>
);

const MOCK_COMMITS = [
  {
    author: 'gaearon',
    initials: 'GA',
    message: 'React 19 Release Candidate preparations',
    time: '3 hours ago',
    branch: 'main',
    hash: 'a1b2c3d',
  },
  {
    author: 'acdlite',
    initials: 'AC',
    message: 'Fix hydration mismatch in Suspense boundaries',
    time: '5 hours ago',
    branch: 'main',
    hash: 'd1e2f3a',
  },
  {
    author: 'sebmarkbage',
    initials: 'SM',
    message: 'Optimize Server Components tree serialization',
    time: '1 day ago',
    branch: 'main',
    hash: 'f9e8d7c',
  },
];

export const RepositoryOverview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReanalysing, setIsReanalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <CircularProgress sx={{ color: '#6c63ff' }} size={44} />
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
            sx={{ color: '#6c63ff', borderColor: 'rgba(108,99,255,0.4)' }}
          >
            Back to Dashboard
          </Button>
        </Container>
      </DashboardLayout>
    );
  }

  const primaryLang = repo.languages[0] || 'JavaScript';

  return (
    <DashboardLayout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Back button & Breadcrumb matching Screenshot #4 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Typography
            onClick={() => navigate('/dashboard')}
            sx={{ color: '#6c63ff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            RepoMind
          </Typography>
          <Typography sx={{ color: '#555577', fontSize: '0.875rem' }}>/</Typography>
          <Typography sx={{ color: '#ffffff', fontSize: '0.875rem', fontWeight: 600 }}>
            {repo.owner}/{repo.name}
          </Typography>
        </Box>

        {/* Main Repository Header Banner matching Screenshot #4 */}
        <Card
          sx={{
            background: '#0d0d16',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            p: { xs: 3, md: 4 },
            mb: 4,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'flex-start' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              {/* Pills */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Chip
                  icon={<GitHubIcon sx={{ fontSize: '14px !important', color: '#a0a0cc !important' }} />}
                  label={repo.owner}
                  size="small"
                  sx={{ background: 'rgba(255,255,255,0.04)', color: '#e0e0ff', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                />
                <Chip
                  label={repo.name}
                  size="small"
                  sx={{ background: 'rgba(108, 99, 255, 0.15)', color: '#6c63ff', border: '1px solid rgba(108, 99, 255, 0.3)', fontWeight: 700, fontSize: '0.75rem' }}
                />
                <Chip
                  label="Public"
                  size="small"
                  sx={{ background: 'rgba(255,255,255,0.03)', color: '#8888aa', fontSize: '0.725rem' }}
                />
              </Box>

              {/* Title & Description */}
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#ffffff', mb: 1, letterSpacing: '-0.02em' }}>
                The library for web and native user interfaces.
              </Typography>

              {/* Sub Meta Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mt: 2.5, color: '#8888aa', fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarBorderIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>228k</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CallSplitIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>46.7k</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccountTreeIcon sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.85rem' }}>{repo.default_branch || 'main'}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#f7df1e' }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#e0e0ff' }}>{primaryLang}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Header Right Action Buttons matching Screenshot #4 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
              <Button
                component="a"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                sx={{
                  height: 42,
                  borderRadius: '10px',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#e0e0ff',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  px: 2.5,
                  '&:hover': {
                    borderColor: 'rgba(108, 99, 255, 0.4)',
                    background: 'rgba(108, 99, 255, 0.08)',
                  },
                }}
              >
                View on GitHub
              </Button>

              <Button
                variant="contained"
                startIcon={<ChatOutlinedIcon sx={{ fontSize: 18 }} />}
                sx={{
                  height: 42,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0070f3 0%, #0051b3 100%)',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  px: 2.5,
                  boxShadow: '0 4px 15px rgba(0, 112, 243, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1a82ff 0%, #0060d6 100%)',
                  },
                }}
              >
                Start Chat
              </Button>
            </Box>
          </Box>
        </Card>

        {/* 5 Metric Cards Row matching Screenshot #4 */}
        <Grid container spacing={2} sx={{ mb: 5 }}>
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<InsertDriveFileIcon fontSize="small" />}
              label="FILES"
              value={repo.file_count > 0 ? repo.file_count.toLocaleString() : '2,847'}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<FolderIcon fontSize="small" />}
              label="FOLDERS"
              value={repo.folder_count > 0 ? repo.folder_count.toLocaleString() : '412'}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
            <MetricCard
              icon={<CodeIcon fontSize="small" />}
              label="LANGUAGES"
              value={repo.languages.length > 0 ? repo.languages.length : 4}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 6, md: 2.4 }}>
            <MetricCard
              icon={<CommitIcon fontSize="small" />}
              label="LAST COMMIT"
              value="3 days ago"
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <MetricCard
              icon={<CheckCircleIcon fontSize="small" />}
              label="ANALYSIS STATUS"
              value="Complete"
              isStatus
            />
          </Grid>
        </Grid>

        {/* Quick Actions Section matching Screenshot #4 */}
        <Box sx={{ mb: 5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff', mb: 2 }}>
            Quick Actions
          </Typography>

          <Grid container spacing={2.5}>
            {[
              {
                title: 'Chat with Repository',
                desc: 'Ask questions about code, architecture, or logic.',
                icon: <ChatOutlinedIcon sx={{ color: '#0070f3' }} />,
                bg: 'rgba(0, 112, 243, 0.1)',
                border: 'rgba(0, 112, 243, 0.2)',
              },
              {
                title: 'View Architecture',
                desc: 'Interactive diagram of folders and dependencies.',
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                bg: 'rgba(108, 99, 255, 0.1)',
                border: 'rgba(108, 99, 255, 0.2)',
              },
              {
                title: 'Repository Health',
                desc: 'Identify technical debt and code quality issues.',
                icon: <HealthAndSafetyOutlinedIcon sx={{ color: '#00c896' }} />,
                bg: 'rgba(0, 200, 150, 0.1)',
                border: 'rgba(0, 200, 150, 0.2)',
              },
              {
                title: 'Reanalyse',
                desc: 'Sync the latest commits and rebuild the index.',
                icon: <RefreshIcon sx={{ color: '#ffb703' }} />,
                bg: 'rgba(255, 183, 3, 0.1)',
                border: 'rgba(255, 183, 3, 0.2)',
                onClick: handleReanalyse,
              },
            ].map((action) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={action.title}>
                <Card
                  onClick={action.onClick}
                  sx={{
                    background: '#0d0d16',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '16px',
                    p: 2.5,
                    height: '100%',
                    cursor: action.onClick ? 'pointer' : 'default',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: action.border,
                      background: 'rgba(18, 18, 28, 0.95)',
                      transform: 'translateY(-3px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      background: action.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.975rem', color: '#ffffff', mb: 0.5 }}>
                    {action.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#777799', lineHeight: 1.5 }}>
                    {action.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Recent Activity Section matching Screenshot #4 */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>
              Recent Activity
            </Typography>
            <Typography sx={{ fontSize: '0.825rem', color: '#0070f3', fontWeight: 600, cursor: 'pointer' }}>
              View all
            </Typography>
          </Box>

          <Card
            sx={{
              background: '#0d0d16',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '16px',
            }}
          >
            {MOCK_COMMITS.map((commit, idx) => (
              <Box key={commit.hash}>
                <Box
                  sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.02)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#e0e0ff',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {commit.initials}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#e0e0ff' }}>
                          {commit.author}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: '#777799' }}>
                          committed
                        </Typography>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                          {commit.message}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: '#555577' }}>
                          🕒 {commit.time}
                        </Typography>
                        <Chip
                          label={commit.branch}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            background: 'rgba(255,255,255,0.03)',
                            color: '#777799',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555577' }}>
                    {commit.hash}
                  </Typography>
                </Box>
                {idx < MOCK_COMMITS.length - 1 && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.04)' }} />}
              </Box>
            ))}
          </Card>
        </Box>
      </Container>
    </DashboardLayout>
  );
};

export default RepositoryOverview;
