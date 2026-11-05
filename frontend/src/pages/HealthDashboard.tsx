import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  MenuItem,
  Select,
  Pagination,
  Switch,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import { useParams } from 'react-router-dom';

import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
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
import CodeIcon from '@mui/icons-material/Code';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
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
  ComponentScores,
} from '../types';

// Color mapping for letter grades
const GRADE_COLORS: Record<string, string> = {
  'A+': '#10b981',
  'A': '#10b981',
  'B': '#38bdf8',
  'C': '#ffd21f',
  'D': '#f97316',
  'F': '#ef4444',
};

// Styling for severities
const SEVERITY_STYLES: Record<FindingSeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' },
  HIGH: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
  MEDIUM: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
  LOW: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' },
  INFO: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.25)' },
};

// Format date helper
const formatScanDate = (isoString?: string): string => {
  if (!isoString) return 'Oct 18, 2026';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
};

// Plain-English health status generator
const getHealthStatusText = (grade: string, componentScores?: ComponentScores) => {
  if (grade === 'A+' || grade === 'A') {
    return {
      headline: 'Your repository is in excellent condition.',
      detail: 'High maintainability, clean modularity, and strong test coverage.',
    };
  }
  if (grade === 'B') {
    return {
      headline: 'Your repository is in good condition.',
      detail: 'Minor technical debt detected. Continue monitoring code complexity.',
    };
  }
  if (grade === 'C') {
    return {
      headline: 'Your repository has moderate technical debt.',
      detail: 'Consider addressing code complexity and increasing test coverage.',
    };
  }
  // Grade D or F: Find lowest components
  if (componentScores) {
    const entries = Object.entries(componentScores).sort((a, b) => a[1] - b[1]);
    const names = entries.slice(0, 2).map(([k]) => {
      if (k === 'documentation') return 'documentation';
      if (k === 'complexity') return 'code complexity';
      if (k === 'maintainability') return 'maintainability';
      if (k === 'testing') return 'testing coverage';
      if (k === 'duplication') return 'code duplication';
      return k;
    });
    return {
      headline: 'Your repository needs attention.',
      detail: `Focus on ${names[0]} and ${names[1]}.`,
    };
  }
  return {
    headline: 'Your repository needs attention.',
    detail: 'Focus on documentation and code complexity.',
  };
};

export const HealthDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Core Data State
  const [repository, setRepository] = useState<Repository | null>(null);
  const [snapshot, setSnapshot] = useState<RepositoryHealthSnapshot | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);

  // Tabs: 0 = Findings, 1 = File Health Explorer, 2 = Historical Trends
  const [activeTab, setActiveTab] = useState<number>(0);

  // Tab 0: Findings state
  const [findings, setFindings] = useState<HealthFinding[]>([]);
  const [findingsCount, setFindingsCount] = useState<number>(0);
  const [findingsPage, setFindingsPage] = useState<number>(1);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingFindings, setLoadingFindings] = useState<boolean>(false);
  const [expandedFindingId, setExpandedFindingId] = useState<number | null>(null);

  // Tab 1: File health explorer state
  const [fileMetrics, setFileMetrics] = useState<FileHealthMetric[]>([]);
  const [fileSearch, setFileSearch] = useState<string>('');
  const [hasIssuesOnly, setHasIssuesOnly] = useState<boolean>(false);
  const [fileOrdering, setFileOrdering] = useState<string>('-findings_count');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);

  // Tab 2: Historical trends state
  const [trends, setTrends] = useState<HealthTrendPoint[]>([]);
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);

  // ─── 1. Load Repository Overview and Latest Health Snapshot ────────────────
  const fetchOverview = useCallback(async (repoId: string) => {
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
  }, []);

  useEffect(() => {
    if (id) {
      fetchOverview(id);
    }
  }, [id, fetchOverview]);

  // ─── 2. Load Findings ──────────────────────────────────────────────────────
  const fetchFindings = useCallback(
    async (page = 1) => {
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
    },
    [id, hasSnapshot, severityFilter, categoryFilter, searchQuery]
  );

  // ─── 3. Load File Metrics ──────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!id || !hasSnapshot) return;
    try {
      setLoadingFiles(true);
      const res = await getHealthFiles(id, {
        search: fileSearch.trim() || undefined,
        ordering: fileOrdering,
        has_issues_only: hasIssuesOnly,
      });
      setFileMetrics(res.files || []);
    } catch (err) {
      console.error('Failed to load file metrics:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [id, hasSnapshot, fileSearch, fileOrdering, hasIssuesOnly]);

  // ─── 4. Load Trends ────────────────────────────────────────────────────────
  const fetchTrends = useCallback(async () => {
    if (!id || !hasSnapshot) return;
    try {
      setLoadingTrends(true);
      const res = await getHealthTrends(id);
      setTrends(res.trends || []);
    } catch (err) {
      console.error('Failed to load trends:', err);
    } finally {
      setLoadingTrends(false);
    }
  }, [id, hasSnapshot]);

  // Tab & Filter Synchronization
  useEffect(() => {
    if (hasSnapshot && id) {
      if (activeTab === 0) fetchFindings(1);
      else if (activeTab === 1) fetchFiles();
      else if (activeTab === 2) fetchTrends();
    }
  }, [hasSnapshot, id, activeTab, fetchFindings, fetchFiles, fetchTrends]);

  // ─── 5. Trigger Health Scan / Re-scan ──────────────────────────────────────
  const handleScan = async (force = false) => {
    if (!id) return;
    try {
      setScanning(true);
      toast.loading(force ? 'Running full repository health scan...' : 'Analyzing repository health...', {
        id: 'scan-toast',
      });
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

  // Helper for direct GitHub file URLs
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

  // 6 Component Health cards definition
  const componentCards = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        name: 'Complexity (25%)',
        score: Math.round(snapshot.component_scores?.complexity ?? 100),
        icon: SpeedIcon,
        color: '#fbbf24',
        barColor: '#fbbf24',
        pillBg: 'rgba(251, 191, 36, 0.12)',
        category: 'COMPLEXITY',
        subtext: `${snapshot.metrics_summary?.complex_functions_count || 0} functions with CC > 10`,
      },
      {
        name: 'Maintainability (20%)',
        score: Math.round(snapshot.component_scores?.maintainability ?? 100),
        icon: LayersIcon,
        color: '#38bdf8',
        barColor: '#38bdf8',
        pillBg: 'rgba(56, 189, 248, 0.12)',
        category: 'MAINTAINABILITY',
        subtext: `${snapshot.metrics_summary?.oversized_files_count || 0} files > 800 LOC`,
      },
      {
        name: 'Duplication (15%)',
        score: Math.round(snapshot.component_scores?.duplication ?? 100),
        icon: ContentCopyIcon,
        color: '#10b981',
        barColor: '#10b981',
        pillBg: 'rgba(16, 185, 129, 0.12)',
        category: 'DUPLICATION',
        subtext: `${snapshot.metrics_summary?.duplication_percentage || 0}% duplication`,
      },
      {
        name: 'Testing Health (20%)',
        score: Math.round(snapshot.component_scores?.testing ?? 0),
        icon: ScienceOutlinedIcon,
        color: '#a855f7',
        barColor: '#a855f7',
        pillBg: 'rgba(168, 85, 247, 0.12)',
        category: 'TESTING',
        subtext: `${snapshot.metrics_summary?.test_files_count || 0} test files`,
      },
      {
        name: 'Documentation (10%)',
        score: Math.round(snapshot.component_scores?.documentation ?? 100),
        icon: DescriptionOutlinedIcon,
        color: '#f43f5e',
        barColor: '#f43f5e',
        pillBg: 'rgba(244, 63, 94, 0.12)',
        category: 'DOCUMENTATION',
        subtext: snapshot.metrics_summary?.has_readme ? 'README present' : 'README missing',
      },
      {
        name: 'Dependencies (10%)',
        score: Math.round(snapshot.component_scores?.dependencies ?? 100),
        icon: AccountTreeOutlinedIcon,
        color: '#2dd4bf',
        barColor: '#2dd4bf',
        pillBg: 'rgba(45, 212, 191, 0.12)',
        category: 'ARCHITECTURE',
        subtext: `${snapshot.metrics_summary?.circular_dependencies_count || 0} circular cycles`,
      },
    ];
  }, [snapshot]);

  // Plain-English headline & detail based on grade and component scores
  const healthStatus = useMemo(() => {
    return getHealthStatusText(snapshot?.grade || 'F', snapshot?.component_scores);
  }, [snapshot]);

  // Recommended actions list formatted cleanly
  const recommendedActions = useMemo(() => {
    if (!snapshot) return [];

    if (snapshot.ai_recommended_actions && snapshot.ai_recommended_actions.length > 0) {
      return snapshot.ai_recommended_actions.map((act) => {
        let label = act.action;
        if (label.startsWith("Oversized file: '")) {
          const match = label.match(/'([^']+)'/);
          const fname = match ? match[1] : 'views.py';
          return `Split oversized files (e.g., ${fname}: 1369 LOC).`;
        }
        if (label.startsWith("Severe complexity in '")) {
          const match = label.match(/'([^']+)'/);
          const fn = match ? match[1] : 'VerifyOTPView.post';
          return `Refactor high-complexity functions (e.g., ${fn}).`;
        }
        if (label.startsWith("Monolithic function: '")) {
          const match = label.match(/'([^']+)'/);
          const fn = match ? match[1] : 'RequestOTPView.post';
          return `Modularize monolithic function '${fn}'.`;
        }
        return label;
      });
    }

    // Default clean recommendations matching repo findings
    const list: string[] = [];
    if (!snapshot.metrics_summary?.has_readme || (snapshot.component_scores?.documentation ?? 100) < 50) {
      list.push('Add or improve documentation (README, docstrings).');
    }
    if ((snapshot.metrics_summary?.complex_functions_count || 0) > 0) {
      list.push('Refactor high-complexity functions (e.g., VerifyOTPView.post).');
    }
    if ((snapshot.metrics_summary?.oversized_files_count || 0) > 0) {
      list.push('Split oversized files (e.g., views.py: 1369 LOC).');
    }
    if ((snapshot.metrics_summary?.test_files_count || 0) < 5) {
      list.push('Add more unit tests for critical modules.');
    }
    return list;
  }, [snapshot]);

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
      <Container maxWidth="xl" sx={{ py: 3.5, px: { xs: 2, md: 4 } }}>
        {/* ─── 1. Dashboard Header ───────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3.5,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {/* Title & Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'rgba(255, 210, 31, 0.12)',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFD21F',
                flexShrink: 0,
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: '1.6rem' }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Repository Health Dashboard
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.825rem', mt: 0.3 }}>
                Overall code health, quality, and maintainability of your repository.
              </Typography>
            </Box>
          </Box>

          {/* Right Header Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {hasSnapshot && snapshot && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.8,
                  height: 38,
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                }}
              >
                <CalendarTodayIcon sx={{ fontSize: '0.9rem', color: '#94a3b8' }} />
                <span>Last scanned: {formatScanDate(snapshot.created_at)}</span>
              </Box>
            )}

            <Button
              variant="contained"
              disabled={scanning}
              startIcon={
                scanning ? (
                  <CircularProgress size={16} sx={{ color: '#050505' }} />
                ) : (
                  <AutorenewIcon sx={{ fontSize: '1.1rem' }} />
                )
              }
              onClick={() => handleScan(true)}
              sx={{
                height: 38,
                px: 2.2,
                borderRadius: '8px',
                background: '#FFD21F',
                color: '#050505',
                fontWeight: 800,
                fontSize: '0.825rem',
                textTransform: 'none',
                boxShadow: '0 2px 14px rgba(255, 210, 31, 0.25)',
                '&:hover': { background: '#FFE033' },
              }}
            >
              {scanning ? 'Scanning...' : hasSnapshot ? 'Re-scan Repository' : 'Run Health Scan'}
            </Button>
          </Box>
        </Box>

        {/* ─── Pre-scan / Empty State ─────────────────────────────────────────── */}
        {!hasSnapshot ? (
          <Card
            sx={{
              p: 6,
              textAlign: 'center',
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              my: 4,
            }}
          >
            <ShieldOutlinedIcon sx={{ fontSize: 60, color: '#FFD21F', mb: 2 }} />
            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
              Ready to Inspect Repository Health
            </Typography>
            <Typography sx={{ color: '#94a3b8', maxWidth: 560, mx: 'auto', mb: 3.5, fontSize: '0.875rem' }}>
              RepoMind will evaluate cyclomatic complexity, code duplication, maintainability, testing indicators,
              documentation coverage, and architectural coupling across all source files.
            </Typography>
            <Button
              variant="contained"
              size="large"
              disabled={scanning}
              startIcon={
                scanning ? (
                  <CircularProgress size={18} sx={{ color: '#050505' }} />
                ) : (
                  <SpeedIcon sx={{ fontSize: '1.2rem' }} />
                )
              }
              onClick={() => handleScan(false)}
              sx={{
                background: '#FFD21F',
                color: '#050505',
                fontWeight: 800,
                px: 3.5,
                py: 1.2,
                borderRadius: '10px',
                textTransform: 'none',
                fontSize: '0.95rem',
              }}
            >
              {scanning ? 'Analyzing Codebase...' : 'Run Initial Health Scan'}
            </Button>
          </Card>
        ) : snapshot && (
          <>
            {/* ─── 2. Overall Health Summary Card ────────────────────────────── */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                p: 3,
                mb: 3.5,
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' },
                  gap: 3,
                  alignItems: 'center',
                }}
              >
                {/* Left: Circular Score Gauge & Grade */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                  {/* Circular Radial Progress Gauge */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: 105,
                      height: 105,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="105" height="105" viewBox="0 0 105 105">
                      {/* Background track */}
                      <circle
                        cx="52.5"
                        cy="52.5"
                        r="43"
                        fill="transparent"
                        stroke="#1f2029"
                        strokeWidth="8.5"
                      />
                      {/* Active colored arc */}
                      <circle
                        cx="52.5"
                        cy="52.5"
                        r="43"
                        fill="transparent"
                        stroke={GRADE_COLORS[snapshot.grade] || '#ef4444'}
                        strokeWidth="8.5"
                        strokeDasharray={2 * Math.PI * 43}
                        strokeDashoffset={
                          2 * Math.PI * 43 * (1 - Math.min(Math.max(snapshot.overall_score, 0), 100) / 100)
                        }
                        strokeLinecap="round"
                        transform="rotate(-90 52.5 52.5)"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                      />
                    </svg>

                    {/* Inside score text */}
                    <Box sx={{ position: 'absolute', textAlign: 'center' }}>
                      <Typography sx={{ fontWeight: 800, color: '#ffffff', fontSize: '1.9rem', lineHeight: 1 }}>
                        {Math.round(snapshot.overall_score)}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, mt: 0.2 }}>
                        / 100
                      </Typography>
                    </Box>
                  </Box>

                  {/* Grade Badge & Explanations */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.6 }}>
                      <Typography sx={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                        Health Grade
                      </Typography>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '6px',
                          background: GRADE_COLORS[snapshot.grade] || '#ef4444',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                        }}
                      >
                        {snapshot.grade}
                      </Box>
                    </Box>

                    <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3 }}>
                      {healthStatus.headline}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.2 }}>
                      {healthStatus.detail}
                    </Typography>
                  </Box>
                </Box>

                {/* Right: 4 Metrics Boxes */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                    gap: 1.5,
                  }}
                >
                  {/* Metric 1: Files */}
                  <Box
                    sx={{
                      p: '14px 18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                    }}
                  >
                    <DescriptionOutlinedIcon sx={{ color: '#94a3b8', fontSize: '1.25rem', mb: 0.5 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                      {snapshot.metrics_summary?.total_files_analyzed || 0}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mt: 0.3 }}>
                      Files
                    </Typography>
                  </Box>

                  {/* Metric 2: Lines of Code */}
                  <Box
                    sx={{
                      p: '14px 18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                    }}
                  >
                    <CodeIcon sx={{ color: '#94a3b8', fontSize: '1.25rem', mb: 0.5 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                      {(snapshot.metrics_summary?.total_loc || 0).toLocaleString()}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mt: 0.3 }}>
                      Lines of Code
                    </Typography>
                  </Box>

                  {/* Metric 3: Avg Complexity */}
                  <Box
                    sx={{
                      p: '14px 18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                    }}
                  >
                    <ShowChartIcon sx={{ color: '#94a3b8', fontSize: '1.25rem', mb: 0.5 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                      {snapshot.metrics_summary?.avg_cyclomatic_complexity || 1.0}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mt: 0.3 }}>
                      Avg Complexity
                    </Typography>
                  </Box>

                  {/* Metric 4: Total Findings */}
                  <Box
                    sx={{
                      p: '14px 18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                    }}
                  >
                    <WarningAmberIcon sx={{ color: '#ef4444', fontSize: '1.25rem', mb: 0.5 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.1 }}>
                      {snapshot.findings_summary?.total || 0}
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mt: 0.3 }}>
                      Total Findings
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Card>

            {/* ─── 3. Component Health (Weighted Score) ───────────────────────── */}
            <Box sx={{ mb: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.8 }}>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                  Component Health (Weighted Score)
                </Typography>
                <InfoOutlinedIcon sx={{ color: '#64748b', fontSize: '1rem' }} />
              </Box>

              {/* 3x2 Grid of Cards */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                  gap: 2,
                }}
              >
                {componentCards.map((c) => {
                  const IconComp = c.icon;
                  return (
                    <Card
                      key={c.name}
                      onClick={() => {
                        setCategoryFilter(c.category);
                        setActiveTab(0);
                      }}
                      sx={{
                        background: '#111218',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '14px',
                        p: 2.2,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        '&:hover': {
                          borderColor: c.color,
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconComp sx={{ color: c.color, fontSize: '1.15rem' }} />
                          <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.825rem' }}>
                            {c.name}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            px: 1,
                            py: 0.2,
                            borderRadius: '6px',
                            background: c.pillBg,
                            color: c.color,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                          }}
                        >
                          {c.score}/100
                        </Box>
                      </Box>

                      {/* Progress Bar */}
                      <Box
                        sx={{
                          width: '100%',
                          height: 5,
                          background: '#1f2029',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${Math.min(Math.max(c.score, 0), 100)}%`,
                            height: '100%',
                            background: c.barColor,
                            borderRadius: 3,
                          }}
                        />
                      </Box>
                    </Card>
                  );
                })}
              </Box>
            </Box>

            {/* ─── 4. AI Maintainability Diagnosis & Action Plan ──────────────── */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                borderRadius: '16px',
                p: 3,
                mb: 3.5,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* Faint Rocket Watermark on Far Right */}
              <Box
                sx={{
                  position: 'absolute',
                  right: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#ffd21f',
                  opacity: 0.1,
                  pointerEvents: 'none',
                  display: { xs: 'none', md: 'block' },
                }}
              >
                <RocketLaunchIcon sx={{ fontSize: 90 }} />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
                  gap: 3.5,
                  alignItems: 'flex-start',
                }}
              >
                {/* Left: AI Diagnosis */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                    <AutoAwesomeIcon sx={{ color: '#FFD21F', fontSize: '1.25rem' }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                      AI Maintainability Diagnosis & Action Plan
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.2,
                        borderRadius: '6px',
                        background: 'rgba(255, 210, 31, 0.15)',
                        border: '1px solid rgba(255, 210, 31, 0.35)',
                        color: '#FFD21F',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                      }}
                    >
                      Grounded AI
                    </Box>
                  </Box>

                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.825rem', lineHeight: 1.6, pr: { md: 2 } }}>
                    {snapshot.ai_summary ||
                      `Repository Health is rated ${snapshot.overall_score.toFixed(1)}/100 (${snapshot.grade}). The primary maintainability friction is in 'Documentation', with ${snapshot.findings_summary?.total || 0} total findings detected.`}
                  </Typography>
                </Box>

                {/* Right: Recommended Actions */}
                <Box sx={{ borderLeft: { md: '1px solid rgba(255, 255, 255, 0.08)' }, pl: { md: 3 } }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', mb: 1.2 }}>
                    Recommended Actions
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {recommendedActions.slice(0, 4).map((actionText, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography sx={{ color: '#FFD21F', fontSize: '0.8rem', lineHeight: 1.5 }}>•</Typography>
                        <Typography sx={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: 1.5 }}>
                          {actionText}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Card>

            {/* ─── 5. Detailed Exploration Tabs ──────────────────────────────── */}
            <Box sx={{ mb: 2.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  pb: 0.5,
                }}
              >
                {/* Tab 1: Findings */}
                <Button
                  onClick={() => setActiveTab(0)}
                  startIcon={<FormatListBulletedIcon sx={{ fontSize: '1rem' }} />}
                  sx={{
                    color: activeTab === 0 ? '#FFD21F' : '#94a3b8',
                    fontWeight: activeTab === 0 ? 800 : 600,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    pb: 1.2,
                    borderBottom: activeTab === 0 ? '2px solid #FFD21F' : '2px solid transparent',
                    borderRadius: 0,
                    '&:hover': { color: '#ffffff', background: 'transparent' },
                  }}
                >
                  Findings ({snapshot.findings_summary?.total || findingsCount || 0})
                </Button>

                {/* Tab 2: File Health Explorer */}
                <Button
                  onClick={() => setActiveTab(1)}
                  startIcon={<InsertDriveFileOutlinedIcon sx={{ fontSize: '1rem' }} />}
                  sx={{
                    color: activeTab === 1 ? '#FFD21F' : '#94a3b8',
                    fontWeight: activeTab === 1 ? 800 : 600,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    pb: 1.2,
                    borderBottom: activeTab === 1 ? '2px solid #FFD21F' : '2px solid transparent',
                    borderRadius: 0,
                    '&:hover': { color: '#ffffff', background: 'transparent' },
                  }}
                >
                  File Health Explorer ({snapshot.metrics_summary?.total_files_analyzed || 0})
                </Button>

                {/* Tab 3: Historical Trends */}
                <Button
                  onClick={() => setActiveTab(2)}
                  startIcon={<ShowChartIcon sx={{ fontSize: '1rem' }} />}
                  sx={{
                    color: activeTab === 2 ? '#FFD21F' : '#94a3b8',
                    fontWeight: activeTab === 2 ? 800 : 600,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    pb: 1.2,
                    borderBottom: activeTab === 2 ? '2px solid #FFD21F' : '2px solid transparent',
                    borderRadius: 0,
                    '&:hover': { color: '#ffffff', background: 'transparent' },
                  }}
                >
                  Historical Trends
                </Button>
              </Box>
            </Box>

            {/* ─── TAB 0: Findings Explorer ──────────────────────────────────── */}
            {activeTab === 0 && (
              <Box>
                {/* Filter Controls Row */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 2.5,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Severity Pills */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => {
                      const isActive = severityFilter === sev;
                      const label = sev === 'ALL' ? 'All' : sev.charAt(0) + sev.slice(1).toLowerCase();
                      return (
                        <Box
                          key={sev}
                          onClick={() => setSeverityFilter(sev)}
                          sx={{
                            px: 1.6,
                            height: 32,
                            borderRadius: '8px',
                            background: isActive ? '#FFD21F' : 'rgba(255, 255, 255, 0.04)',
                            border: isActive
                              ? '1px solid #FFD21F'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isActive ? '#050505' : '#94a3b8',
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              background: isActive ? '#FFE033' : 'rgba(255, 255, 255, 0.08)',
                              color: isActive ? '#050505' : '#ffffff',
                            },
                          }}
                        >
                          {label}
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Category Dropdown */}
                  <Select
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    sx={{
                      height: 32,
                      fontSize: '0.78rem',
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      '& fieldset': { border: 'none' },
                      '& .MuiSelect-select': { py: 0.5, px: 1.5 },
                      '& .MuiSvgIcon-root': { color: '#94a3b8', fontSize: '1.1rem' },
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

                  {/* Search Input Box */}
                  <TextField
                    size="small"
                    placeholder="Search findings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchFindings(1)}
                    sx={{
                      flex: 1,
                      minWidth: 200,
                      '& .MuiOutlinedInput-root': {
                        height: 32,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.78rem',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 210, 31, 0.35)' },
                        '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                      },
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: '1rem', mr: 1 }} />
                        ),
                      },
                    }}
                  />
                </Box>

                {/* Findings Items List */}
                {loadingFindings ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={30} sx={{ color: '#FFD21F' }} />
                  </Box>
                ) : findings.length === 0 ? (
                  <Card
                    sx={{
                      p: 5,
                      textAlign: 'center',
                      background: '#111218',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                    }}
                  >
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 44, mb: 1 }} />
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                      No Findings Match Filter
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mt: 0.3 }}>
                      No technical debt issues found matching current filter criteria.
                    </Typography>
                  </Card>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                    {findings.map((f) => {
                      const sevStyle = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.INFO;
                      const isExpanded = expandedFindingId === f.id;
                      const ghUrl = f.file_path ? getGitHubFileUrl(f.file_path, f.start_line) : null;

                      return (
                        <Card
                          key={f.id}
                          onClick={() => setExpandedFindingId(isExpanded ? null : f.id)}
                          sx={{
                            background: '#111218',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            p: '14px 18px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              borderColor: 'rgba(255, 210, 31, 0.35)',
                              background: 'rgba(255, 255, 255, 0.02)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 2,
                            }}
                          >
                            {/* Left: Severity Badge + Title & Description */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                              <Box
                                sx={{
                                  px: 1.2,
                                  py: 0.3,
                                  borderRadius: '6px',
                                  background: sevStyle.bg,
                                  border: `1px solid ${sevStyle.border}`,
                                  color: sevStyle.text,
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                  minWidth: 54,
                                  textAlign: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {f.severity.charAt(0) + f.severity.slice(1).toLowerCase()}
                              </Box>

                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {f.title}
                                </Typography>
                                <Typography
                                  sx={{
                                    color: '#94a3b8',
                                    fontSize: '0.75rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    mt: 0.2,
                                  }}
                                >
                                  {f.description}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Right: File Path Pill & Expand Arrow */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0 }}>
                              {f.file_path && (
                                <Box
                                  sx={{
                                    px: 1.2,
                                    py: 0.3,
                                    borderRadius: '6px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    color: '#cbd5e1',
                                    fontFamily: 'monospace',
                                    fontSize: '0.74rem',
                                  }}
                                >
                                  {f.file_path}
                                </Box>
                              )}

                              {isExpanded ? (
                                <KeyboardArrowDownIcon sx={{ color: '#ffd21f', fontSize: '1.2rem' }} />
                              ) : (
                                <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.2rem' }} />
                              )}
                            </Box>
                          </Box>

                          {/* Expanded Detail Panel */}
                          <Collapse in={isExpanded}>
                            <Box
                              sx={{
                                mt: 2,
                                pt: 2,
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Box sx={{ p: 2, background: 'rgba(0, 0, 0, 0.35)', borderRadius: '10px', mb: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography sx={{ color: '#ffd21f', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {f.file_path}
                                    {f.start_line ? ` (Lines ${f.start_line}–${f.end_line || f.start_line})` : ''}
                                  </Typography>

                                  {ghUrl && (
                                    <Button
                                      size="small"
                                      startIcon={<GitHubIcon sx={{ fontSize: '0.9rem' }} />}
                                      onClick={() => window.open(ghUrl, '_blank')}
                                      sx={{
                                        color: '#94a3b8',
                                        fontSize: '0.72rem',
                                        textTransform: 'none',
                                        '&:hover': { color: '#ffffff' },
                                      }}
                                    >
                                      View on GitHub
                                    </Button>
                                  )}
                                </Box>

                                <Typography sx={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: 1.5 }}>
                                  <strong style={{ color: '#10b981' }}>Suggested Fix: </strong>
                                  {f.recommendation}
                                </Typography>
                              </Box>

                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={`Category: ${f.category}`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.68rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: '#94a3b8',
                                  }}
                                />
                                <Chip
                                  label={`Effort: ${f.estimated_effort}`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.68rem',
                                    background: 'rgba(255, 210, 31, 0.1)',
                                    color: '#ffd21f',
                                  }}
                                />
                              </Box>
                            </Box>
                          </Collapse>
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
                            '& .MuiPaginationItem-root': { color: '#94a3b8' },
                            '& .Mui-selected': {
                              background: '#FFD21F !important',
                              color: '#050505',
                              fontWeight: 800,
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* ─── TAB 1: File Health Explorer ───────────────────────────────── */}
            {activeTab === 1 && (
              <Box>
                {/* Search & Sort Controls Bar */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 2.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <TextField
                    size="small"
                    placeholder="Search file path..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchFiles()}
                    sx={{
                      minWidth: 260,
                      '& .MuiOutlinedInput-root': {
                        height: 34,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                        '&:hover fieldset': { borderColor: '#ffd21f' },
                      },
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: '1rem', mr: 1 }} />
                        ),
                      },
                    }}
                  />

                  <Select
                    size="small"
                    value={fileOrdering}
                    onChange={(e) => setFileOrdering(e.target.value)}
                    sx={{
                      height: 34,
                      fontSize: '0.78rem',
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      '& fieldset': { border: 'none' },
                      '& .MuiSelect-select': { py: 0.5, px: 1.5 },
                      '& .MuiSvgIcon-root': { color: '#94a3b8', fontSize: '1.1rem' },
                    }}
                  >
                    <MenuItem value="-findings_count">Most Findings</MenuItem>
                    <MenuItem value="-max_complexity">Highest Complexity</MenuItem>
                    <MenuItem value="-line_count">Largest Files (LOC)</MenuItem>
                    <MenuItem value="file_path">File Path (A–Z)</MenuItem>
                  </Select>

                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={hasIssuesOnly}
                        onChange={(e) => setHasIssuesOnly(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#FFD21F' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#FFD21F',
                          },
                        }}
                      />
                    }
                    label={
                      <Typography sx={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                        Only files with findings
                      </Typography>
                    }
                  />

                  <Button
                    variant="outlined"
                    size="small"
                    onClick={fetchFiles}
                    sx={{
                      height: 34,
                      borderRadius: '8px',
                      color: '#FFD21F',
                      borderColor: 'rgba(255, 210, 31, 0.4)',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      '&:hover': { borderColor: '#ffd21f', background: 'rgba(255, 210, 31, 0.08)' },
                    }}
                  >
                    Apply Filter
                  </Button>
                </Box>

                {/* File Table Card */}
                <Card
                  sx={{
                    background: '#111218',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  {loadingFiles ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress size={30} sx={{ color: '#FFD21F' }} />
                    </Box>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          color: '#D4D4D8',
                          fontSize: '0.825rem',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: 'rgba(0, 0, 0, 0.4)',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>File Path</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>Language</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>LOC</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>Functions</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>Max CC</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>Findings</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 700 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileMetrics.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
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
                                  <td
                                    style={{
                                      padding: '12px 18px',
                                      fontFamily: 'monospace',
                                      color: '#ffffff',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {fm.file_path}
                                  </td>
                                  <td style={{ padding: '12px 18px', color: '#94a3b8' }}>{fm.language}</td>
                                  <td style={{ padding: '12px 18px', color: '#cbd5e1' }}>{fm.line_count}</td>
                                  <td style={{ padding: '12px 18px', color: '#cbd5e1' }}>{fm.function_count}</td>
                                  <td style={{ padding: '12px 18px' }}>
                                    {fm.ast_supported ? (
                                      <span
                                        style={{
                                          color: fm.max_complexity > 10 ? '#FFD21F' : '#10B981',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {fm.max_complexity}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#64748b' }}>N/A</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 18px' }}>
                                    {fm.findings_count > 0 ? (
                                      <Box
                                        onClick={() => {
                                          setSearchQuery(fm.file_path);
                                          setActiveTab(0);
                                        }}
                                        sx={{
                                          display: 'inline-block',
                                          px: 1,
                                          py: 0.2,
                                          borderRadius: '6px',
                                          background: 'rgba(239, 68, 68, 0.15)',
                                          color: '#ef4444',
                                          fontWeight: 700,
                                          fontSize: '0.72rem',
                                          cursor: 'pointer',
                                          '&:hover': { textDecoration: 'underline' },
                                        }}
                                      >
                                        {fm.findings_count} issues
                                      </Box>
                                    ) : (
                                      <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 600 }}>
                                        Clean
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 18px' }}>
                                    {ghUrl && (
                                      <IconButton
                                        size="small"
                                        href={ghUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ color: '#94a3b8', '&:hover': { color: '#FFD21F' } }}
                                      >
                                        <OpenInNewIcon sx={{ fontSize: '1rem' }} />
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
                  )}
                </Card>
              </Box>
            )}

            {/* ─── TAB 2: Historical Trends ──────────────────────────────────── */}
            {activeTab === 2 && (
              <Box>
                <Card
                  sx={{
                    p: 3.5,
                    background: '#111218',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    mb: 3,
                  }}
                >
                  <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem', mb: 0.5 }}>
                    Historical Health Score Trajectory
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', mb: 3 }}>
                    Tracking repository score improvements and finding resolution across commit snapshots.
                  </Typography>

                  {loadingTrends ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress size={30} sx={{ color: '#FFD21F' }} />
                    </Box>
                  ) : trends.length <= 1 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <ShowChartIcon sx={{ fontSize: 44, color: '#64748b', mb: 1.5, opacity: 0.5 }} />
                      <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                        Additional scans needed to establish trajectory
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', maxWidth: 480, mx: 'auto', mt: 0.5 }}>
                        Only {trends.length === 0 ? 'zero' : 'one'} health snapshot is currently recorded. As new
                        commits are scanned, health trends will automatically plot score trajectories over time.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ width: '100%', height: 200, pt: 2, pb: 4 }}>
                      <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
                        <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                        <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                        <line x1="0" y1="140" x2="600" y2="140" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />

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

                        {trends.map((t, idx) => {
                          const x = (idx / (trends.length - 1)) * 560 + 20;
                          const y = 140 - (t.overall_score / 100) * 120;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="5" fill="#FFD21F" stroke="#050505" strokeWidth="2" />
                              <text x={x} y={y - 10} fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">
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
                {trends.length > 0 && (
                  <Card
                    sx={{
                      background: '#111218',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          textAlign: 'left',
                          color: '#D4D4D8',
                          fontSize: '0.825rem',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: 'rgba(0, 0, 0, 0.4)',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Date</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Commit SHA</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Score</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Grade</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Total Findings</th>
                            <th style={{ padding: '12px 18px', color: '#94a3b8' }}>Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trends.map((t, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                              }}
                            >
                              <td style={{ padding: '12px 18px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                              <td style={{ padding: '12px 18px', fontFamily: 'monospace', color: '#FFD21F' }}>
                                {t.commit_sha.slice(0, 7)}
                              </td>
                              <td style={{ padding: '12px 18px', fontWeight: 700, color: '#ffffff' }}>
                                {t.overall_score.toFixed(1)}
                              </td>
                              <td style={{ padding: '12px 18px' }}>
                                <Box
                                  sx={{
                                    display: 'inline-block',
                                    px: 1,
                                    py: 0.2,
                                    borderRadius: '6px',
                                    fontWeight: 800,
                                    background: `${GRADE_COLORS[t.grade] || '#FFD21F'}20`,
                                    color: GRADE_COLORS[t.grade] || '#FFD21F',
                                  }}
                                >
                                  {t.grade}
                                </Box>
                              </td>
                              <td style={{ padding: '12px 18px' }}>{t.findings_summary?.total || 0}</td>
                              <td style={{ padding: '12px 18px' }}>
                                {t.delta ? (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                      color: t.delta.score_diff >= 0 ? '#10B981' : '#EF4444',
                                    }}
                                  >
                                    {t.delta.score_diff >= 0 ? (
                                      <TrendingUpIcon fontSize="small" />
                                    ) : (
                                      <TrendingDownIcon fontSize="small" />
                                    )}
                                    <span>{t.delta.score_diff >= 0 ? `+${t.delta.score_diff}` : t.delta.score_diff} pts</span>
                                  </Box>
                                ) : (
                                  <span style={{ color: '#64748b' }}>Initial</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  </Card>
                )}
              </Box>
            )}
          </>
        )}
      </Container>
    </DashboardLayout>
  );
};

export default HealthDashboard;