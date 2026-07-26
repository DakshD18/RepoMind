import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CommitIcon from '@mui/icons-material/Commit';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import PersonIcon from '@mui/icons-material/Person';
import { getDashboardRepository } from '../services/api';
import type { Repository } from '../types';


interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

const StatCard = ({ icon, label, value, color = '#6c63ff' }: StatCardProps) => (
  <Card
    sx={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '16px',
      height: '100%',
      transition: 'all 0.2s ease',
      '&:hover': {
        border: `1px solid ${color}44`,
        background: `${color}08`,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 30px ${color}22`,
      },
    }}
  >
    <CardContent sx={{ p: 3 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ color }}>{icon}</Box>
      </Box>
      <Typography sx={{ color: '#8888aa', fontSize: '0.8rem', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#e0e0ff', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3776ab',
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Java: '#ed8b00',
  'C++': '#00599c',
  Go: '#00acd7',
  Rust: '#dea584',
  Ruby: '#cc342d',
  PHP: '#777bb4',
  Swift: '#fa7343',
  Kotlin: '#7f52ff',
  HTML: '#e44d26',
  CSS: '#1572b6',
  SCSS: '#cf649a',
  Vue: '#42b883',
  Dart: '#0175c2',
  C: '#555555',
  'C#': '#239120',
};

const RepositoryOverview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepo = async () => {
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
    fetchRepo();
  }, [id]);

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: '#6c63ff' }} size={48} />
      </Box>
    );
  }

  if (error || !repo) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: '#ef5350', fontSize: '1.1rem' }}>{error || 'Repository not found.'}</Typography>
        <Button onClick={() => navigate('/dashboard')} startIcon={<ArrowBackIcon />} sx={{ color: '#6c63ff' }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  const lastCommit = repo.last_commit_date
    ? new Date(repo.last_commit_date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Unknown';

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #12101f 50%, #0d0d1a 100%)' }}>

      {/* Background orb */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg" sx={{ py: 5, position: 'relative', zIndex: 1 }}>

        {/* Back button */}
        <Button
          onClick={() => navigate('/dashboard')}
          startIcon={<ArrowBackIcon />}
          sx={{
            color: '#8888aa',
            mb: 4,
            '&:hover': { color: '#6c63ff', background: 'rgba(108,99,255,0.08)' },
            textTransform: 'none',
          }}
        >
          Back to Dashboard
        </Button>

        {/* Header */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(108,99,255,0.3), rgba(0,200,150,0.2))',
                border: '1px solid rgba(108,99,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitHubIcon sx={{ color: '#e0e0ff', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: '1.6rem', md: '2.2rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #ffffff 40%, #6c63ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  lineHeight: 1.2,
                }}
              >
                {repo.owner}/{repo.name}
              </Typography>
              <Typography
                component="a"
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#6c63ff',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {repo.url}
              </Typography>
            </Box>

            <Chip
              label="Analysed"
              sx={{
                ml: 'auto',
                background: 'rgba(0,200,150,0.1)',
                color: '#00c896',
                border: '1px solid rgba(0,200,150,0.3)',
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>

        {/* Stat Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<InsertDriveFileIcon />}
              label="Total Files"
              value={repo.file_count.toLocaleString()}
              color="#6c63ff"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<FolderIcon />}
              label="Folders"
              value={repo.folder_count.toLocaleString()}
              color="#00c896"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<AccountTreeIcon />}
              label="Default Branch"
              value={repo.default_branch || 'N/A'}
              color="#ffa726"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<CommitIcon />}
              label="Last Commit"
              value={lastCommit}
              color="#ef5350"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2.5}>
          {/* Languages */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              sx={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px',
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <CodeIcon sx={{ color: '#6c63ff' }} />
                  <Typography sx={{ color: '#e0e0ff', fontWeight: 600, fontSize: '1rem' }}>
                    Languages Detected
                  </Typography>
                </Box>

                {repo.languages.length === 0 ? (
                  <Typography sx={{ color: '#555577' }}>No languages detected.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {repo.languages.map((lang) => {
                      const color = LANGUAGE_COLORS[lang] || '#6c63ff';
                      return (
                        <Chip
                          key={lang}
                          label={lang}
                          sx={{
                            background: `${color}18`,
                            color,
                            border: `1px solid ${color}44`,
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            py: 0.5,
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Branches & Meta */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              sx={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '20px',
                height: '100%',
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <PersonIcon sx={{ color: '#00c896' }} />
                  <Typography sx={{ color: '#e0e0ff', fontWeight: 600, fontSize: '1rem' }}>
                    Repository Info
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { label: 'Owner', value: repo.owner },
                    { label: 'Default Branch', value: repo.default_branch || 'N/A' },
                    { label: 'Analysis Status', value: repo.status },
                  ].map(({ label, value }) => (
                    <Box key={label}>
                      <Typography sx={{ color: '#555577', fontSize: '0.75rem', mb: 0.4, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ color: '#e0e0ff', fontWeight: 500 }}>{value}</Typography>
                      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mt: 1.5 }} />
                    </Box>
                  ))}

                  {repo.branches.length > 0 && (
                    <Box>
                      <Typography sx={{ color: '#555577', fontSize: '0.75rem', mb: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Branches ({repo.branches.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {repo.branches.slice(0, 8).map((branch) => (
                          <Chip
                            key={branch}
                            label={branch}
                            size="small"
                            sx={{
                              background: 'rgba(108,99,255,0.1)',
                              color: '#a0a0cc',
                              border: '1px solid rgba(108,99,255,0.2)',
                              fontSize: '0.72rem',
                            }}
                          />
                        ))}
                        {repo.branches.length > 8 && (
                          <Chip
                            label={`+${repo.branches.length - 8} more`}
                            size="small"
                            sx={{ background: 'rgba(255,255,255,0.05)', color: '#555577', fontSize: '0.72rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default RepositoryOverview;
