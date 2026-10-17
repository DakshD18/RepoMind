import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SpeedIcon from '@mui/icons-material/Speed';
import LayersIcon from '@mui/icons-material/Layers';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getRepoHealth,
  triggerHealthScan,
  getHealthFindings,
  getHealthFiles,
  getHealthTrends,
  getDashboardRepository,
} from '../services/api';
import type {
  Repository,
  RepositoryHealthSnapshot,
  HealthFinding,
  FileHealthMetric,
  HealthTrendPoint,
  FindingSeverity,
} from '../types';

// Color mapping for letter grades
const GRADE_COLORS: Record<string, string> = {
  'A+': '#10B981',
  'A': '#10B981',
  'B': '#3B82F6',
  'C': '#FFD21F',
  'D': '#F97316',
  'F': '#EF4444',
};

// Color mapping for severities
const SEVERITY_COLORS: Record<FindingSeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.4)' },
  HIGH: { bg: 'rgba(249, 115, 22, 0.15)', text: '#F97316', border: 'rgba(249, 115, 22, 0.4)' },
  MEDIUM: { bg: 'rgba(255, 210, 31, 0.15)', text: '#FFD21F', border: 'rgba(255, 210, 31, 0.4)' },
  LOW: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)' },
  INFO: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9CA3AF', border: 'rgba(156, 163, 175, 0.4)' },
};

export const HealthDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repository, setRepository] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<RepositoryHealthSnapshot | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);

  // Deep-dive tabs
  const [activeTab, setActiveTab] = useState<number>(0);

  // Findings tab state
  const [findings, setFindings] = useState<HealthFinding[]>([]);
  const [findingsCount, setFindingsCount] = useState<number>(0);
  const [findingsPage, setFindingsPage] = useState<number>(1);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingFindings, setLoadingFindings] = useState<boolean>(false);

  // File health tab state
  const [fileMetrics, setFileMetrics] = useState<FileHealthMetric[]>([]);
  const [fileSearch, setFileSearch] = useState<string>('');
  const [hasIssuesOnly, setHasIssuesOnly] = useState<boolean>(false);
  const [fileOrdering, setFileOrdering] = useState<string>('-findings_count');

  // Trends tab state
  const [trends, setTrends] = useState<HealthTrendPoint[]>([]);

  // Load repository and latest health overview
  const fetchOverview = async (repoId: string) => {
    try {
      setLoading(true);
      const [repoData, healthData] = await Promise.all([
        getDashboardRepository(Number(repoId)),
        getRepoHealth(repoId),
      ]);
      setRepository(repoData);
      setHasSnapshot(healthData.has_snapshot);
      if (healthData.has_snapshot && healthData.latest_snapshot) {
        setSnapshot(healthData.latest_snapshot);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load repository health overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOverview(id);
    }
  }, [id]);

  // Load findings when tab or filters change
  const fetchFindings = async (page = 1) => {
    if (!id || !hasSnapshot) return;
    try {
      setLoadingFindings(true);
      const params: any = { page };
      if (severityFilter !== 'ALL') params.severity = severityFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getHealthFindings(id, params);
      setFindings(res.results || []);
      setFindingsCount(res.count || 0);
      setFindingsPage(page);
    } catch (err) {
      console.error('Failed to load findings:', err);
    } finally {
      setLoadingFindings(false);
    }
  };

  // Load files when tab or file filters change
  const fetchFiles = async () => {
    if (!id || !hasSnapshot) return;
    try {
      const res = await getHealthFiles(id, {
        search: fileSearch.trim() || undefined,
        ordering: fileOrdering,
        has_issues_only: hasIssuesOnly,
      });
      setFileMetrics(res.files || []);
    } catch (err) {
      console.error('Failed to load file metrics:', err);
    }
  };

  // Load trends
  const fetchTrends = async () => {
    if (!id || !hasSnapshot) return;
    try {
      const res = await getHealthTrends(id);
      setTrends(res.trends || []);
    } catch (err) {
      console.error('Failed to load trends:', err);
    }
  };

  useEffect(() => {
    if (hasSnapshot && id) {
      if (activeTab === 0) fetchFindings(1);
      else if (activeTab === 1) fetchFiles();
      else if (activeTab === 2) fetchTrends();
    }
  }, [id, hasSnapshot, activeTab, severityFilter, categoryFilter, hasIssuesOnly, fileOrdering]);

  // Handle Trigger Scan
  const handleScan = async (force = false) => {
    if (!id) return;
    try {
      setScanning(true);
      toast.loading(force ? 'Running full health rescan...' : 'Analyzing repository health...', { id: 'scan-toast' });
      const res = await triggerHealthScan(id, force, true);
      setSnapshot(res.snapshot);
      setHasSnapshot(true);
      toast.success(
        res.delta?.cached
          ? 'Loaded cached health snapshot.'
          : `Health scan complete! Score: ${res.snapshot.overall_score}/100 (${res.snapshot.grade})`,
        { id: 'scan-toast' }
      );
      if (activeTab === 0) fetchFindings(1);
      else if (activeTab === 1) fetchFiles();
      else if (activeTab === 2) fetchTrends();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Health scan failed.', { id: 'scan-toast' });
    } finally {
      setScanning(false);
    }
  };

  // Construct GitHub file URL with line anchor
  const getGitHubFileUrl = (filePath: string, startLine?: number | null) => {
    if (!repository?.url) return null;
    const branch = repository.default_branch || 'main';
    const baseUrl = repository.url.replace(/\.git$/, '');
    let url = `${baseUrl}/blob/${branch}/${filePath}`;
    if (startLine) {
      url += `#L${startLine}`;
    }
    return url;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
          <CircularProgress sx={{ color: '#FFD21F' }} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 4 } }}>
        {/* Top Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/repository/${id}`)}
              sx={{ color: '#A3A3A3', '&:hover': { color: '#FFFFFF' } }}
            >
              Overview
            </Button>
            <Typography variant="body2" sx={{ color: '#525252' }}>/</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HealthAndSafetyIcon sx={{ color: '#FFD21F', fontSize: 24 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Repository Health Dashboard
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {repository?.url && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<GitHubIcon />}
                href={repository.url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#E5E5E5',
                  '&:hover': { borderColor: '#FFD21F', color: '#FFD21F' },
                }}
              >
                GitHub
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              disabled={scanning}
              startIcon={scanning ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              onClick={() => handleScan(true)}
              sx={{
                background: '#FFD21F',
                color: '#050505',
                fontWeight: 700,
                boxShadow: '0 2px 14px rgba(255, 210, 31, 0.3)',
                '&:hover': { background: '#FFE033' },
              }}
            >
              {scanning ? 'Scanning...' : hasSnapshot ? 'Re-scan Repository' : 'Run Health Scan'}
            </Button>
          </Box>
        </Box>

        {/* Empty state when no scan exists */}
        {!hasSnapshot ? (
          <Card
            sx={{
              p: 6,
              textAlign: 'center',
              background: 'rgba(18, 18, 24, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              my: 4,
            }}
          >
            <HealthAndSafetyIcon sx={{ fontSize: 64, color: '#FFD21F', mb: 2, opacity: 0.9 }} />
            <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1 }}>
              Ready to Inspect Repository Health
            </Typography>
            <Typography variant="body1" sx={{ color: '#A3A3A3', maxWidth: 600, mx: 'auto', mb: 4 }}>
              RepoMind will evaluate cyclomatic complexity, code duplication, maintainability, testing indicators,
              documentation coverage, and architectural coupling across all source files.
            </Typography>
            <Button
              variant="contained"
              size="large"
              disabled={scanning}
              startIcon={scanning ? <CircularProgress size={20} color="inherit" /> : <SpeedIcon />}
              onClick={() => handleScan(false)}
              sx={{
                background: '#FFD21F',
                color: '#050505',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: '12px',
                fontSize: '1rem',
              }}
            >
              {scanning ? 'Analyzing Codebase...' : 'Run Initial Health Scan'}
            </Button>
          </Card>
        ) : snapshot && (
          <>
            {/* Hero Health Score Card */}
            <Card
              sx={{
                background: 'rgba(18, 18, 24, 0.75)',
                backdropFilter: 'blur(18px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                p: 3.5,
                mb: 3.5,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                {/* Radial Gauge / Grade Display */}
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="transparent"
                        stroke="#1F1F24"
                        strokeWidth="10"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="transparent"
                        stroke={GRADE_COLORS[snapshot.grade] || '#FFD21F'}
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - snapshot.overall_score / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>
                    <Box sx={{ position: 'absolute', textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
                        {Math.round(snapshot.overall_score)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#A3A3A3', fontWeight: 600 }}>
                        / 100
                      </Typography>
                    </Box>
                  </Box>

                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                        Health Grade:
                      </Typography>
                      <Chip
                        label={snapshot.grade}
                        sx={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          background: `${GRADE_COLORS[snapshot.grade]}20`,
                          color: GRADE_COLORS[snapshot.grade],
                          border: `1px solid ${GRADE_COLORS[snapshot.grade]}40`,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: '#A3A3A3', mb: 1 }}>
                      Commit: <code style={{ color: '#FFD21F' }}>{snapshot.commit_sha.slice(0, 7)}</code>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#737373', display: 'block' }}>
                      Last scanned: {new Date(snapshot.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>

                {/* Score Stats / Counts */}
                <Grid size={{ xs: 12, md: 8 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 2, background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography variant="caption" sx={{ color: '#A3A3A3', fontWeight: 500 }}>Files Analyzed</Typography>
                        <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mt: 0.5 }}>
                          {snapshot.metrics_summary?.total_files_analyzed || 0}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 2, background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography variant="caption" sx={{ color: '#A3A3A3', fontWeight: 500 }}>Total Code Lines</Typography>
                        <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mt: 0.5 }}>
                          {(snapshot.metrics_summary?.total_loc || 0).toLocaleString()}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 2, background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography variant="caption" sx={{ color: '#A3A3A3', fontWeight: 500 }}>Avg Complexity</Typography>
                        <Typography variant="h6" sx={{ color: '#FFD21F', fontWeight: 700, mt: 0.5 }}>
                          {snapshot.metrics_summary?.avg_cyclomatic_complexity || 1.0}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Box sx={{ p: 2, background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography variant="caption" sx={{ color: '#A3A3A3', fontWeight: 500 }}>Total Findings</Typography>
                        <Typography variant="h6" sx={{ color: snapshot.findings_summary?.total > 0 ? '#F97316' : '#10B981', fontWeight: 700, mt: 0.5 }}>
                          {snapshot.findings_summary?.total || 0}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Card>

            {/* 6 Component Breakdown Cards */}
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', mb: 2, letterSpacing: '-0.01em' }}>
              Component Breakdown (Weighted 0–100)
            </Typography>

            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              {/* 1. Complexity (25%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon sx={{ color: '#FFD21F', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Complexity (25%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.complexity || 100)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(255, 210, 31, 0.15)', color: '#FFD21F' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#A3A3A3', display: 'block', mb: 1 }}>
                    {snapshot.metrics_summary?.complex_functions_count || 0} functions with CC &gt; 10, {snapshot.metrics_summary?.severe_functions_count || 0} severe (CC &gt; 20).
                  </Typography>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.complexity || 0}%`, height: '100%', background: '#FFD21F' }} />
                  </Box>
                </Card>
              </Grid>

              {/* 2. Maintainability (20%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LayersIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Maintainability (20%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.maintainability || 100)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#A3A3A3', display: 'block', mb: 1 }}>
                    {snapshot.metrics_summary?.large_files_count || 0} files &gt; 400 LOC, {snapshot.metrics_summary?.oversized_files_count || 0} files &gt; 800 LOC.
                  </Typography>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.maintainability || 0}%`, height: '100%', background: '#3B82F6' }} />
                  </Box>
                </Card>
              </Grid>

              {/* 3. Duplication (15%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ContentCopyIcon sx={{ color: '#10B981', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Duplication (15%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.duplication || 100)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#A3A3A3', display: 'block', mb: 1 }}>
                    {snapshot.metrics_summary?.duplication_percentage || 0}% repeated line-block duplication detected.
                  </Typography>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.duplication || 0}%`, height: '100%', background: '#10B981' }} />
                  </Box>
                </Card>
              </Grid>

              {/* 4. Testing (20%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScienceOutlinedIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Testing Health (20%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.testing || 0)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#A3A3A3' }}>
                      {snapshot.metrics_summary?.test_files_count || 0} test files ({((snapshot.metrics_summary?.test_to_code_ratio || 0) * 100).toFixed(0)}% ratio).
                    </Typography>
                    {snapshot.metrics_summary?.test_coverage_status === 'UNAVAILABLE' ? (
                      <Chip label="Coverage: Unavailable" size="small" sx={{ fontSize: '0.65rem', height: 18, background: 'rgba(255, 255, 255, 0.05)', color: '#A3A3A3' }} />
                    ) : (
                      <Chip label={`${snapshot.metrics_summary?.test_coverage_percent}% coverage`} size="small" sx={{ fontSize: '0.65rem', height: 18, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }} />
                    )}
                  </Box>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.testing || 0}%`, height: '100%', background: '#8B5CF6' }} />
                  </Box>
                </Card>
              </Grid>

              {/* 5. Documentation (10%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionOutlinedIcon sx={{ color: '#EC4899', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Documentation (10%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.documentation || 100)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(236, 72, 153, 0.15)', color: '#EC4899' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#A3A3A3', display: 'block', mb: 1 }}>
                    README: {snapshot.metrics_summary?.has_readme ? 'Present' : 'Missing'}, Docstring ratio: {((snapshot.metrics_summary?.documented_symbols_ratio || 0) * 100).toFixed(0)}%.
                  </Typography>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.documentation || 0}%`, height: '100%', background: '#EC4899' }} />
                  </Box>
                </Card>
              </Grid>

              {/* 6. Dependencies (10%) */}
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ p: 2.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', height: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccountTreeOutlinedIcon sx={{ color: '#14B8A6', fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>Dependencies (10%)</Typography>
                    </Box>
                    <Chip label={`${Math.round(snapshot.component_scores?.dependencies || 100)}/100`} size="small" sx={{ fontWeight: 700, background: 'rgba(20, 184, 166, 0.15)', color: '#14B8A6' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#A3A3A3', display: 'block', mb: 1 }}>
                    {snapshot.metrics_summary?.circular_dependencies_count || 0} circular import cycles, {snapshot.metrics_summary?.syntax_errors_count || 0} syntax errors.
                  </Typography>
                  <Box sx={{ width: '100%', height: 6, background: '#1F1F24', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ width: `${snapshot.component_scores?.dependencies || 0}%`, height: '100%', background: '#14B8A6' }} />
                  </Box>
                </Card>
              </Grid>
            </Grid>

            {/* AI Health Summary & Action Plan Card */}
            {snapshot.ai_summary && (
              <Card
                sx={{
                  p: 3.5,
                  mb: 4,
                  background: 'linear-gradient(135deg, rgba(255, 210, 31, 0.06) 0%, rgba(18, 18, 24, 0.75) 100%)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 210, 31, 0.25)',
                  borderRadius: '20px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AutoAwesomeIcon sx={{ color: '#FFD21F', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.01em' }}>
                    AI Maintainability Diagnosis & Action Plan
                  </Typography>
                  <Chip
                    label="Grounded AI"
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(255, 210, 31, 0.15)',
                      color: '#FFD21F',
                    }}
                  />
                </Box>

                <Typography variant="body1" sx={{ color: '#D4D4D8', lineHeight: 1.6, mb: 3 }}>
                  {snapshot.ai_summary}
                </Typography>

                {snapshot.ai_recommended_actions && snapshot.ai_recommended_actions.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2, fontSize: '0.75rem' }}>
                      Recommended Action Roadmap:
                    </Typography>
                    <Grid container spacing={2}>
                      {snapshot.ai_recommended_actions.map((act, idx) => (
                        <Grid size={{ xs: 12, md: 6 }} key={idx}>
                          <Box
                            sx={{
                              p: 2,
                              background: 'rgba(0, 0, 0, 0.4)',
                              borderRadius: '12px',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              height: '100%',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: '#FFD21F',
                                    color: '#050505',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.75rem',
                                  }}
                                >
                                  {act.step}
                                </Box>
                                <Typography variant="subtitle2" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                                  {act.action}
                                </Typography>
                              </Box>
                              <Chip
                                label={act.estimated_effort}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  color: '#A3A3A3',
                                }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ color: '#A3A3A3', fontSize: '0.85rem', mb: 1.5 }}>
                              {act.reason}
                            </Typography>
                            {act.affected_files && act.affected_files.length > 0 && (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                {act.affected_files.map((file, fIdx) => (
                                  <Chip
                                    key={fIdx}
                                    label={file}
                                    size="small"
                                    onClick={() => {
                                      const url = getGitHubFileUrl(file);
                                      if (url) window.open(url, '_blank');
                                    }}
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.7rem',
                                      background: 'rgba(255, 210, 31, 0.08)',
                                      color: '#FFD21F',
                                      cursor: 'pointer',
                                      '&:hover': { background: 'rgba(255, 210, 31, 0.18)' },
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                <Typography variant="caption" sx={{ color: '#737373', display: 'block', mt: 2.5, fontStyle: 'italic' }}>
                  Disclaimer: AI synthesis grounded in statically measured repository metrics. Effort values are estimates.
                </Typography>
              </Card>
            )}

            {/* Deep-Dive Tabs Section */}
            <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={(_, val) => setActiveTab(val)}
                textColor="primary"
                indicatorColor="primary"
                sx={{
                  '& .MuiTab-root': {
                    color: '#A3A3A3',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    minWidth: 140,
                    '&.Mui-selected': { color: '#FFD21F' },
                  },
                  '& .MuiTabs-indicator': { backgroundColor: '#FFD21F', height: 3 },
                }}
              >
                <Tab label={`Findings (${snapshot.findings_summary?.total || 0})`} />
                <Tab label={`File Health Explorer (${snapshot.metrics_summary?.total_files_analyzed || 0})`} />
                <Tab label="Historical Trends" />
              </Tabs>
            </Box>

            {/* TAB 0: Findings Explorer */}
            {activeTab === 0 && (
              <Box>
                {/* Filter Controls Bar */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                      <Chip
                        key={sev}
                        label={sev}
                        onClick={() => setSeverityFilter(sev)}
                        sx={{
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: severityFilter === sev ? '#FFD21F' : 'rgba(255, 255, 255, 0.05)',
                          color: severityFilter === sev ? '#050505' : '#A3A3A3',
                          border: severityFilter === sev ? '1px solid #FFD21F' : '1px solid rgba(255, 255, 255, 0.08)',
                          '&:hover': { background: severityFilter === sev ? '#FFE033' : 'rgba(255, 255, 255, 0.1)' },
                        }}
                      />
                    ))}
                  </Box>

                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel sx={{ color: '#A3A3A3' }}>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      sx={{
                        color: '#FFFFFF',
                        background: 'rgba(18, 18, 24, 0.65)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      }}
                    >
                      <MenuItem value="ALL">All Categories</MenuItem>
                      <MenuItem value="COMPLEXITY">Complexity</MenuItem>
                      <MenuItem value="MAINTAINABILITY">Maintainability</MenuItem>
                      <MenuItem value="DUPLICATION">Duplication</MenuItem>
                      <MenuItem value="TESTING">Testing</MenuItem>
                      <MenuItem value="DOCUMENTATION">Documentation</MenuItem>
                      <MenuItem value="ARCHITECTURE">Architecture</MenuItem>
                    </Select>
                  </FormControl>

                  <TextField
                    size="small"
                    placeholder="Search findings or files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchFindings(1)}
                    sx={{
                      flexGrow: 1,
                      minWidth: 200,
                      '& .MuiOutlinedInput-root': {
                        background: 'rgba(18, 18, 24, 0.65)',
                        color: '#FFFFFF',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                        '&:hover fieldset': { borderColor: '#FFD21F' },
                      },
                    }}
                  />

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => fetchFindings(1)}
                    sx={{ color: '#FFD21F', borderColor: 'rgba(255, 210, 31, 0.4)' }}
                  >
                    Filter
                  </Button>
                </Box>

                {/* Findings List */}
                {loadingFindings ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#FFD21F' }} />
                  </Box>
                ) : findings.length === 0 ? (
                  <Card sx={{ p: 5, textAlign: 'center', background: 'rgba(18, 18, 24, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px' }}>
                    <CheckCircleIcon sx={{ color: '#10B981', fontSize: 48, mb: 1 }} />
                    <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 600 }}>No Findings Match Filter</Typography>
                    <Typography variant="body2" sx={{ color: '#A3A3A3' }}>Great job! No technical debt issues found matching current criteria.</Typography>
                  </Card>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {findings.map((f) => {
                      const sevStyle = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.INFO;
                      const ghUrl = f.file_path ? getGitHubFileUrl(f.file_path, f.start_line) : null;

                      return (
                        <Card
                          key={f.id}
                          sx={{
                            p: 2.8,
                            background: 'rgba(18, 18, 24, 0.65)',
                            backdropFilter: 'blur(12px)',
                            border: `1px solid ${sevStyle.border}`,
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.5)' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                              <Chip
                                label={f.severity}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                  background: sevStyle.bg,
                                  color: sevStyle.text,
                                  border: `1px solid ${sevStyle.border}`,
                                }}
                              />
                              <Chip
                                label={f.category}
                                size="small"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: '#A3A3A3',
                                }}
                              />
                              <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 700 }}>
                                {f.title}
                              </Typography>
                            </Box>

                            <Chip
                              label={`Effort: ${f.estimated_effort}`}
                              size="small"
                              sx={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                color: '#A3A3A3',
                                fontSize: '0.75rem',
                              }}
                            />
                          </Box>

                          <Typography variant="body2" sx={{ color: '#D4D4D8', mb: 2, lineHeight: 1.5 }}>
                            {f.description}
                          </Typography>

                          {/* File Path & Recommendation Box */}
                          <Box sx={{ p: 2, background: 'rgba(0, 0, 0, 0.35)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.04)', mb: 1 }}>
                            {f.file_path && (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" sx={{ color: '#FFD21F', fontFamily: 'monospace', fontWeight: 600 }}>
                                  {f.file_path}{f.start_line ? ` (Lines ${f.start_line}-${f.end_line || f.start_line})` : ''}
                                </Typography>
                                {ghUrl && (
                                  <IconButton
                                    size="small"
                                    href={ghUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    sx={{ color: '#A3A3A3', '&:hover': { color: '#FFD21F' } }}
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            )}

                            <Typography variant="body2" sx={{ color: '#A3A3A3', fontSize: '0.85rem' }}>
                              <strong style={{ color: '#10B981' }}>Suggested Fix:</strong> {f.recommendation}
                            </Typography>
                          </Box>
                        </Card>
                      );
                    })}

                    {/* Pagination */}
                    {findingsCount > 20 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                          count={Math.ceil(findingsCount / 20)}
                          page={findingsPage}
                          onChange={(_, p) => fetchFindings(p)}
                          sx={{
                            '& .MuiPaginationItem-root': { color: '#A3A3A3' },
                            '& .Mui-selected': { background: '#FFD21F !important', color: '#050505', fontWeight: 700 },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* TAB 1: File Health Explorer */}
            {activeTab === 1 && (
              <Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
                  <TextField
                    size="small"
                    placeholder="Search file path..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                    sx={{
                      minWidth: 260,
                      '& .MuiOutlinedInput-root': {
                        background: 'rgba(18, 18, 24, 0.65)',
                        color: '#FFFFFF',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      },
                    }}
                  />

                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel sx={{ color: '#A3A3A3' }}>Sort By</InputLabel>
                    <Select
                      value={fileOrdering}
                      label="Sort By"
                      onChange={(e) => setFileOrdering(e.target.value)}
                      sx={{
                        color: '#FFFFFF',
                        background: 'rgba(18, 18, 24, 0.65)',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                      }}
                    >
                      <MenuItem value="-findings_count">Most Findings</MenuItem>
                      <MenuItem value="-complexity">Highest Complexity</MenuItem>
                      <MenuItem value="-line_count">Largest Files (LOC)</MenuItem>
                      <MenuItem value="file_path">File Path (A-Z)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={hasIssuesOnly}
                        onChange={(e) => setHasIssuesOnly(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#FFD21F' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#FFD21F' },
                        }}
                      />
                    }
                    label={<Typography variant="body2" sx={{ color: '#D4D4D8' }}>Only files with findings</Typography>}
                  />

                  <Button variant="outlined" size="small" onClick={fetchFiles} sx={{ color: '#FFD21F', borderColor: 'rgba(255, 210, 31, 0.4)' }}>
                    Apply
                  </Button>
                </Box>

                <Card sx={{ background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                  <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#D4D4D8', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>File Path</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Language</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>LOC</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Functions</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Max CC</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Issues</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileMetrics.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#737373' }}>
                              No files match the specified criteria.
                            </td>
                          </tr>
                        ) : (
                          fileMetrics.map((fm, idx) => {
                            const ghUrl = getGitHubFileUrl(fm.file_path);
                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                                }}
                              >
                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#FFFFFF' }}>
                                  {fm.file_path}
                                </td>
                                <td style={{ padding: '12px 16px' }}>{fm.language}</td>
                                <td style={{ padding: '12px 16px' }}>{fm.line_count}</td>
                                <td style={{ padding: '12px 16px' }}>{fm.function_count}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  {fm.ast_supported ? (
                                    <span style={{ color: fm.max_complexity > 10 ? '#FFD21F' : '#10B981', fontWeight: 600 }}>
                                      {fm.max_complexity}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#737373' }}>N/A</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {fm.findings_count > 0 ? (
                                    <Chip
                                      label={`${fm.findings_count} issues`}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        background: 'rgba(249, 115, 22, 0.15)',
                                        color: '#F97316',
                                      }}
                                    />
                                  ) : (
                                    <span style={{ color: '#10B981', fontSize: '0.8rem' }}>Clean</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {ghUrl && (
                                    <IconButton
                                      size="small"
                                      href={ghUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      sx={{ color: '#A3A3A3', '&:hover': { color: '#FFD21F' } }}
                                    >
                                      <GitHubIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </Box>
                </Card>
              </Box>
            )}

            {/* TAB 2: Historical Trends */}
            {activeTab === 2 && (
              <Box>
                <Card sx={{ p: 3.5, background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1 }}>
                    Historical Health Score Trajectory
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#A3A3A3', mb: 3 }}>
                    Tracking repository score improvements and finding resolution across commit snapshots.
                  </Typography>

                  {trends.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#737373', py: 4, textAlign: 'center' }}>
                      No historical trends available yet. Run additional scans across new commits to build trajectory data.
                    </Typography>
                  ) : (
                    <Box sx={{ width: '100%', height: 200, display: 'flex', alignItems: 'flex-end', gap: 2, pt: 2, pb: 4 }}>
                      {/* SVG Trend Visualization */}
                      <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                        {/* Background guide lines */}
                        <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                        <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                        <line x1="0" y1="140" x2="600" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />

                        {/* Polyline */}
                        {trends.length > 1 && (
                          <polyline
                            fill="none"
                            stroke="#FFD21F"
                            strokeWidth="3"
                            points={trends
                              .map((t, idx) => {
                                const x = (idx / (trends.length - 1)) * 560 + 20;
                                const y = 140 - (t.overall_score / 100) * 120;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />
                        )}

                        {/* Data Points */}
                        {trends.map((t, idx) => {
                          const x = trends.length > 1 ? (idx / (trends.length - 1)) * 560 + 20 : 300;
                          const y = 140 - (t.overall_score / 100) * 120;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="5" fill="#FFD21F" stroke="#050505" strokeWidth="2" />
                              <text x={x} y={y - 10} fill="#FFFFFF" fontSize="11" fontWeight="700" textAnchor="middle">
                                {Math.round(t.overall_score)}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </Box>
                  )}
                </Card>

                {/* Snapshots Table */}
                <Card sx={{ background: 'rgba(18, 18, 24, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                  <Box sx={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#D4D4D8', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Date</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Commit SHA</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Score</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Grade</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Total Findings</th>
                          <th style={{ padding: '12px 16px', color: '#A3A3A3' }}>Delta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((t, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '12px 16px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#FFD21F' }}>
                              {t.commit_sha.slice(0, 7)}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FFFFFF' }}>
                              {t.overall_score.toFixed(1)}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <Chip
                                label={t.grade}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  background: `${GRADE_COLORS[t.grade] || '#FFD21F'}20`,
                                  color: GRADE_COLORS[t.grade] || '#FFD21F',
                                }}
                              />
                            </td>
                            <td style={{ padding: '12px 16px' }}>{t.findings_summary?.total || 0}</td>
                            <td style={{ padding: '12px 16px' }}>
                              {t.delta ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: t.delta.score_diff >= 0 ? '#10B981' : '#EF4444' }}>
                                  {t.delta.score_diff >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                                  <span>{t.delta.score_diff >= 0 ? `+${t.delta.score_diff}` : t.delta.score_diff} pts</span>
                                </Box>
                              ) : (
                                <span style={{ color: '#737373' }}>Initial</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </Card>
              </Box>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default HealthDashboard;
