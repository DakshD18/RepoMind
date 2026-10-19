import React, { useEffect, useState, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getProductivityOverview,
  getProductivityActivity,
  getProductivityContributors,
  getProductivityHotspots,
  getFileHotspotDetail,
  getProductivityModules,
  getProductivityInsights,
  refreshProductivityAnalytics,
  getDashboardRepository,
} from '../services/api';
import type {
  Repository,
  ProductivityOverviewResponse,
  ActivityTimelinePoint,
  ContributorInsight,
  FileHotspot,
  ModuleMetric,
  ProductivityAIInsights,
  FileDetailResponse,
} from '../types';

// Color definitions matching RepoMind theme
const YELLOW_ACCENT = '#FFD21F';
const GREEN_ACCENT = '#10B981';
const RED_ACCENT = '#EF4444';
const BLUE_ACCENT = '#3B82F6';
const CARD_BG = 'rgba(18, 18, 24, 0.65)';
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';

export const ProductivityDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Repository state
  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter state
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [aggregation, setAggregation] = useState<string>('daily');

  // Overview and data state
  const [overviewData, setOverviewData] = useState<ProductivityOverviewResponse | null>(null);
  const [timeline, setTimeline] = useState<ActivityTimelinePoint[]>([]);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  // Deep-dive tabs (0: Hotspots, 1: Modules, 2: Contributors, 3: AI Insights)
  const [activeTab, setActiveTab] = useState<number>(0);

  // Hotspots tab state
  const [hotspots, setHotspots] = useState<FileHotspot[]>([]);
  const [hotspotsCount, setHotspotsCount] = useState<number>(0);
  const [hotspotsPage, setHotspotsPage] = useState<number>(1);
  const [hotspotsSearch, setHotspotsSearch] = useState<string>('');
  const [hotspotsOrdering, setHotspotsOrdering] = useState<string>('-commits');
  const [loadingHotspots, setLoadingHotspots] = useState<boolean>(false);

  // File detail modal state
  const [selectedFileDetail, setSelectedFileDetail] = useState<FileDetailResponse | null>(null);

  // Modules tab state
  const [modules, setModules] = useState<ModuleMetric[]>([]);
  const [loadingModules, setLoadingModules] = useState<boolean>(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Contributors tab state
  const [contributors, setContributors] = useState<ContributorInsight[]>([]);
  const [contributorsCount, setContributorsCount] = useState<number>(0);
  const [contributorsPage, setContributorsPage] = useState<number>(1);
  const [contributorsSearch, setContributorsSearch] = useState<string>('');
  const [loadingContributors, setLoadingContributors] = useState<boolean>(false);

  // AI Insights tab state
  const [aiInsights, setAiInsights] = useState<ProductivityAIInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);

  // Timeline active hover index
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(null);
  const [activeChartMetric, setActiveChartMetric] = useState<'commits' | 'churn' | 'contributors'>('commits');

  // Load repository context
  useEffect(() => {
    if (!id) return;
    getDashboardRepository(Number(id))
      .then((repo) => setRepository(repo))
      .catch((err) => {
        console.error('Failed fetching repository:', err);
        toast.error('Failed to load repository context.');
      });
  }, [id]);

  // Load Primary Overview & Timeline
  const fetchPrimaryAnalytics = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setPrimaryError(null);
      const params = {
        range: timeRange,
        start_date: timeRange === 'custom' ? customStart : undefined,
        end_date: timeRange === 'custom' ? customEnd : undefined,
        aggregation,
      };

      const [ovData, actData] = await Promise.all([
        getProductivityOverview(id, params),
        getProductivityActivity(id, params),
      ]);

      setOverviewData(ovData);
      setTimeline(actData.timeline || []);
    } catch (err: any) {
      console.error('Failed loading productivity analytics:', err);
      const errorMsg =
        err?.response?.data?.error ||
        (err?.response?.status === 404
          ? 'Repository not found or access denied for this user.'
          : 'Unable to reach backend server. Please ensure the backend is running.');
      setPrimaryError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on filter change
  useEffect(() => {
    fetchPrimaryAnalytics();
  }, [id, timeRange, customStart, customEnd, aggregation]);

  // Load Hotspots tab data
  const fetchHotspots = async () => {
    if (!id) return;
    try {
      setLoadingHotspots(true);
      const data = await getProductivityHotspots(id, {
        range: timeRange,
        start_date: timeRange === 'custom' ? customStart : undefined,
        end_date: timeRange === 'custom' ? customEnd : undefined,
        search: hotspotsSearch,
        ordering: hotspotsOrdering,
        page: hotspotsPage,
        page_size: 15,
      });
      setHotspots(data.results || []);
      setHotspotsCount(data.count || 0);
    } catch (err) {
      console.error('Failed loading hotspots:', err);
    } finally {
      setLoadingHotspots(false);
    }
  };

  useEffect(() => {
    if (activeTab === 0) {
      fetchHotspots();
    }
  }, [id, activeTab, timeRange, customStart, customEnd, hotspotsSearch, hotspotsOrdering, hotspotsPage]);

  // Load Modules tab data
  const fetchModules = async () => {
    if (!id) return;
    try {
      setLoadingModules(true);
      const data = await getProductivityModules(id, {
        range: timeRange,
        start_date: timeRange === 'custom' ? customStart : undefined,
        end_date: timeRange === 'custom' ? customEnd : undefined,
      });
      setModules(data.modules || []);
    } catch (err) {
      console.error('Failed loading modules:', err);
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    if (activeTab === 1) {
      fetchModules();
    }
  }, [id, activeTab, timeRange, customStart, customEnd]);

  // Load Contributors tab data
  const fetchContributors = async () => {
    if (!id) return;
    try {
      setLoadingContributors(true);
      const data = await getProductivityContributors(id, {
        range: timeRange,
        start_date: timeRange === 'custom' ? customStart : undefined,
        end_date: timeRange === 'custom' ? customEnd : undefined,
        search: contributorsSearch,
        page: contributorsPage,
        page_size: 10,
      });
      setContributors(data.results || []);
      setContributorsCount(data.count || 0);
    } catch (err) {
      console.error('Failed loading contributors:', err);
    } finally {
      setLoadingContributors(false);
    }
  };

  useEffect(() => {
    if (activeTab === 2) {
      fetchContributors();
    }
  }, [id, activeTab, timeRange, customStart, customEnd, contributorsSearch, contributorsPage]);

  // Load AI Insights tab data
  const fetchInsights = async (force: boolean = false) => {
    if (!id) return;
    try {
      setLoadingInsights(true);
      const data = await getProductivityInsights(
        id,
        {
          range: timeRange,
          start_date: timeRange === 'custom' ? customStart : undefined,
          end_date: timeRange === 'custom' ? customEnd : undefined,
        },
        force
      );
      setAiInsights(data);
    } catch (err) {
      console.error('Failed loading insights:', err);
      toast.error('Unable to generate AI productivity insights.');
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    if (activeTab === 3 && !aiInsights) {
      fetchInsights(false);
    }
  }, [id, activeTab, timeRange]);

  // Refresh & commit sync handler
  const handleRefresh = async () => {
    if (!id) return;
    try {
      setRefreshing(true);
      const toastId = toast.loading('Refreshing analytics cache & checking git history...');
      const res = await refreshProductivityAnalytics(id);
      toast.dismiss(toastId);
      toast.success(
        res.new_commits_ingested > 0
          ? `Ingested ${res.new_commits_ingested} new commits! Updated analytics.`
          : 'Productivity analytics cache refreshed.'
      );
      await fetchPrimaryAnalytics();
      if (activeTab === 0) fetchHotspots();
      if (activeTab === 1) fetchModules();
      if (activeTab === 2) fetchContributors();
      if (activeTab === 3) fetchInsights(true);
    } catch (err) {
      console.error('Failed refreshing productivity analytics:', err);
      toast.error('Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  // Inspect specific file detail modal
  const handleInspectFile = async (filePath: string) => {
    if (!id) return;
    try {
      const detail = await getFileHotspotDetail(id, filePath);
      setSelectedFileDetail(detail);
    } catch (err) {
      console.error('Failed inspecting file:', err);
      toast.error('Could not load file commit history.');
    }
  };

  // Safe percentage formatter
  const renderDelta = (delta: number | null | undefined, label: string = 'vs prev') => {
    if (delta === null || delta === undefined) {
      return (
        <Typography variant="caption" sx={{ color: '#737373', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          No prev data
        </Typography>
      );
    }
    const isPos = delta > 0;
    const isZero = delta === 0;
    const color = isZero ? '#A3A3A3' : isPos ? GREEN_ACCENT : RED_ACCENT;
    const Icon = isPos ? TrendingUpIcon : TrendingDownIcon;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {!isZero && <Icon sx={{ fontSize: 14, color }} />}
        <Typography variant="caption" sx={{ color, fontWeight: 700 }}>
          {isPos ? `+${delta}%` : `${delta}%`}
        </Typography>
        <Typography variant="caption" sx={{ color: '#737373' }}>
          {label}
        </Typography>
      </Box>
    );
  };

  // Activity Tag Badge Colors
  const getActivityTagColor = (label: string) => {
    switch (label) {
      case 'Frequently modified':
        return { bg: 'rgba(255, 210, 31, 0.15)', text: YELLOW_ACCENT, border: 'rgba(255, 210, 31, 0.4)' };
      case 'High code churn':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#F97316', border: 'rgba(249, 115, 22, 0.4)' };
      case 'Multiple contributors':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: BLUE_ACCENT, border: 'rgba(59, 130, 246, 0.4)' };
      case 'Repeatedly changed':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.4)' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: GREEN_ACCENT, border: 'rgba(16, 185, 129, 0.4)' };
    }
  };

  // Timeline maximum calculations for SVG scale
  const maxTimelineCommit = useMemo(() => {
    return Math.max(...timeline.map((p) => p.commits), 1);
  }, [timeline]);

  const maxTimelineChurn = useMemo(() => {
    return Math.max(...timeline.map((p) => p.total_churn), 1);
  }, [timeline]);

  const maxTimelineContributors = useMemo(() => {
    return Math.max(...timeline.map((p) => p.active_contributors), 1);
  }, [timeline]);

  return (
    <DashboardLayout>
      <Box sx={{ minHeight: '100vh', background: '#07070a', color: '#e4e4e7', py: 4 }}>
        <Container maxWidth="xl">
          {/* SECTION A: Header & Navigation */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <IconButton
                  onClick={() => navigate(`/repository/${id}`)}
                  sx={{
                    color: '#A1A1AA',
                    background: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': { background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' },
                  }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                    Productivity Intelligence
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                    {repository ? `${repository.owner} / ${repository.name}` : 'Repository Activity & History'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                  sx={{
                    borderColor: CARD_BORDER,
                    color: '#D4D4D8',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '10px',
                    '&:hover': { borderColor: YELLOW_ACCENT, color: YELLOW_ACCENT },
                  }}
                >
                  {refreshing ? 'Syncing...' : 'Refresh Analytics'}
                </Button>
              </Box>
            </Box>

            {/* Filter Bar */}
            <Card
              sx={{
                p: 2.5,
                background: CARD_BG,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              {/* Time Range Selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: '#A1A1AA', fontWeight: 600, mr: 1 }}>
                  Range:
                </Typography>
                {['7d', '30d', '90d', '6m', '12m', 'all', 'custom'].map((rng) => (
                  <Chip
                    key={rng}
                    label={rng.toUpperCase()}
                    clickable
                    onClick={() => setTimeRange(rng)}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      background: timeRange === rng ? YELLOW_ACCENT : 'rgba(255, 255, 255, 0.05)',
                      color: timeRange === rng ? '#000000' : '#D4D4D8',
                      border: timeRange === rng ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                      '&:hover': {
                        background: timeRange === rng ? YELLOW_ACCENT : 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  />
                ))}
              </Box>

              {/* Aggregation interval and data limitations badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {timeRange === 'custom' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      type="date"
                      size="small"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      sx={{
                        input: { color: '#FFFFFF', fontSize: '0.85rem' },
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#737373' }}>
                      to
                    </Typography>
                    <TextField
                      type="date"
                      size="small"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      sx={{
                        input: { color: '#FFFFFF', fontSize: '0.85rem' },
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                      }}
                    />
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 600 }}>
                    Bucket:
                  </Typography>
                  {['daily', 'weekly', 'monthly'].map((agg) => (
                    <Chip
                      key={agg}
                      label={agg.charAt(0).toUpperCase() + agg.slice(1)}
                      size="small"
                      clickable
                      onClick={() => setAggregation(agg)}
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: aggregation === agg ? 700 : 500,
                        background: aggregation === agg ? 'rgba(255, 210, 31, 0.2)' : 'transparent',
                        color: aggregation === agg ? YELLOW_ACCENT : '#A1A1AA',
                        border: aggregation === agg ? `1px solid ${YELLOW_ACCENT}` : '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Card>

            {/* Neutrality & Scope Notice */}
            {overviewData?.data_availability && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, px: 1 }}>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: '#737373' }} />
                <Typography variant="caption" sx={{ color: '#737373' }}>
                  {overviewData.data_availability.limitations_note} Activity data reflects repository commit history, not developer evaluation.
                </Typography>
              </Box>
            )}

            {/* Zero commits empty-state notice */}
            {overviewData?.data_availability?.total_stored_commits === 0 && (
              <Card
                sx={{
                  p: 3,
                  mt: 3,
                  background: 'rgba(255, 210, 31, 0.05)',
                  border: '1px solid rgba(255, 210, 31, 0.3)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <InfoOutlinedIcon sx={{ color: YELLOW_ACCENT, fontSize: 28 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                      No Git commits have been ingested for this repository yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                      Repository commit history is required to render productivity timelines, hotspots, and contributor insights.
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  startIcon={refreshing ? <CircularProgress size={16} sx={{ color: '#000000' }} /> : <RefreshIcon />}
                  sx={{
                    background: YELLOW_ACCENT,
                    color: '#000000',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '10px',
                    '&:hover': { background: '#E6BD1C' },
                  }}
                >
                  {refreshing ? 'Ingesting Commits...' : 'Sync Git Commits'}
                </Button>
              </Card>
            )}
            {/* Error notice */}
            {primaryError && (
              <Card
                sx={{
                  p: 3,
                  mt: 3,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <InfoOutlinedIcon sx={{ color: '#EF4444', fontSize: 28 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                      Unable to Load Productivity Metrics
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                      {primaryError}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  onClick={fetchPrimaryAnalytics}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{
                    borderColor: '#EF4444',
                    color: '#EF4444',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: '10px',
                    '&:hover': { background: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' },
                  }}
                >
                  Retry
                </Button>
              </Card>
            )}
          </Box>

          {/* SECTION B: Overview Metric Cards */}
          {loading && !overviewData ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: YELLOW_ACCENT }} />
            </Box>
          ) : (
            <>
              <Grid container spacing={2.5} sx={{ mb: 4 }}>
                {/* Total Commits */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ p: 2.5, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                    <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Commits
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#FFFFFF', my: 0.5 }}>
                      {overviewData?.overview.total_commits.toLocaleString() || 0}
                    </Typography>
                    {renderDelta(overviewData?.overview.previous_period.commits_delta_pct)}
                  </Card>
                </Grid>

                {/* Active Contributors */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ p: 2.5, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                    <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>
                      Active Contributors
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#FFFFFF', my: 0.5 }}>
                      {overviewData?.overview.active_contributors.toLocaleString() || 0}
                    </Typography>
                    {renderDelta(overviewData?.overview.previous_period.contributors_delta_pct)}
                  </Card>
                </Grid>

                {/* Files Modified */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ p: 2.5, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                    <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>
                      Files Modified
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: '#FFFFFF', my: 0.5 }}>
                      {overviewData?.overview.files_modified.toLocaleString() || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#737373' }}>
                      Avg {overviewData?.overview.avg_commits_per_active_day || 0} commits / active day
                    </Typography>
                  </Card>
                </Grid>

                {/* Code Churn vs Net Growth */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ p: 2.5, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                    <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Code Churn
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: YELLOW_ACCENT, my: 0.5 }}>
                      {overviewData?.overview.total_churn_volume.toLocaleString() || 0}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: GREEN_ACCENT, fontWeight: 600 }}>
                        +{overviewData?.overview.lines_added.toLocaleString() || 0}
                      </Typography>
                      <Typography variant="caption" sx={{ color: RED_ACCENT, fontWeight: 600 }}>
                        -{overviewData?.overview.lines_deleted.toLocaleString() || 0}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                        (Net: {overviewData && overviewData.overview.net_line_change > 0 ? '+' : ''}
                        {overviewData?.overview.net_line_change.toLocaleString() || 0})
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              </Grid>

              {/* SECTION C & D: Interactive Activity & Code Churn Visualization */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Activity Timeline Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                  <Card sx={{ p: 3, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                          Activity Timeline
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                          Continuous {aggregation} commit velocity and participation over the selected period.
                        </Typography>
                      </Box>

                      {/* Chart Metric Toggle */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant={activeChartMetric === 'commits' ? 'contained' : 'outlined'}
                          onClick={() => setActiveChartMetric('commits')}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: activeChartMetric === 'commits' ? YELLOW_ACCENT : 'transparent',
                            color: activeChartMetric === 'commits' ? '#000000' : '#A1A1AA',
                            borderColor: CARD_BORDER,
                          }}
                        >
                          Commits
                        </Button>
                        <Button
                          size="small"
                          variant={activeChartMetric === 'churn' ? 'contained' : 'outlined'}
                          onClick={() => setActiveChartMetric('churn')}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: activeChartMetric === 'churn' ? YELLOW_ACCENT : 'transparent',
                            color: activeChartMetric === 'churn' ? '#000000' : '#A1A1AA',
                            borderColor: CARD_BORDER,
                          }}
                        >
                          Churn
                        </Button>
                        <Button
                          size="small"
                          variant={activeChartMetric === 'contributors' ? 'contained' : 'outlined'}
                          onClick={() => setActiveChartMetric('contributors')}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: activeChartMetric === 'contributors' ? YELLOW_ACCENT : 'transparent',
                            color: activeChartMetric === 'contributors' ? '#000000' : '#A1A1AA',
                            borderColor: CARD_BORDER,
                          }}
                        >
                          Contributors
                        </Button>
                      </Box>
                    </Box>

                    {/* Custom Interactive SVG Chart */}
                    {timeline.length === 0 ? (
                      <Box sx={{ py: 8, textAlign: 'center', color: '#737373' }}>
                        No activity recorded in this time range.
                      </Box>
                    ) : (
                      <Box sx={{ width: '100%', pt: 2, pb: 1, position: 'relative' }}>
                        <svg width="100%" height="220" viewBox="0 0 700 220" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={YELLOW_ACCENT} stopOpacity="0.4" />
                              <stop offset="100%" stopColor={YELLOW_ACCENT} stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid lines */}
                          <line x1="0" y1="20" x2="700" y2="20" stroke="rgba(255,255,255,0.04)" strokeDasharray="4" />
                          <line x1="0" y1="100" x2="700" y2="100" stroke="rgba(255,255,255,0.04)" strokeDasharray="4" />
                          <line x1="0" y1="180" x2="700" y2="180" stroke="rgba(255,255,255,0.08)" />

                          {/* Polyline & Area */}
                          {timeline.length > 1 && (
                            <>
                              {/* Filled Area */}
                              <polygon
                                fill="url(#areaGradient)"
                                points={`20,180 ${timeline
                                  .map((p, idx) => {
                                    const x = (idx / (timeline.length - 1)) * 660 + 20;
                                    const val =
                                      activeChartMetric === 'commits'
                                        ? p.commits
                                        : activeChartMetric === 'churn'
                                        ? p.total_churn
                                        : p.active_contributors;
                                    const maxVal =
                                      activeChartMetric === 'commits'
                                        ? maxTimelineCommit
                                        : activeChartMetric === 'churn'
                                        ? maxTimelineChurn
                                        : maxTimelineContributors;
                                    const y = 180 - (val / maxVal) * 150;
                                    return `${x},${y}`;
                                  })
                                  .join(' ')} 680,180`}
                              />

                              {/* Stroke line */}
                              <polyline
                                fill="none"
                                stroke={YELLOW_ACCENT}
                                strokeWidth="2.5"
                                points={timeline
                                  .map((p, idx) => {
                                    const x = (idx / (timeline.length - 1)) * 660 + 20;
                                    const val =
                                      activeChartMetric === 'commits'
                                        ? p.commits
                                        : activeChartMetric === 'churn'
                                        ? p.total_churn
                                        : p.active_contributors;
                                    const maxVal =
                                      activeChartMetric === 'commits'
                                        ? maxTimelineCommit
                                        : activeChartMetric === 'churn'
                                        ? maxTimelineChurn
                                        : maxTimelineContributors;
                                    const y = 180 - (val / maxVal) * 150;
                                    return `${x},${y}`;
                                  })
                                  .join(' ')}
                              />
                            </>
                          )}

                          {/* Data points */}
                          {timeline.map((p, idx) => {
                            const x = timeline.length > 1 ? (idx / (timeline.length - 1)) * 660 + 20 : 350;
                            const val =
                              activeChartMetric === 'commits'
                                ? p.commits
                                : activeChartMetric === 'churn'
                                ? p.total_churn
                                : p.active_contributors;
                            const maxVal =
                              activeChartMetric === 'commits'
                                ? maxTimelineCommit
                                : activeChartMetric === 'churn'
                                ? maxTimelineChurn
                                : maxTimelineContributors;
                            const y = 180 - (val / maxVal) * 150;
                            const isHovered = hoveredTimelineIdx === idx;

                            return (
                              <g
                                key={idx}
                                onMouseEnter={() => setHoveredTimelineIdx(idx)}
                                onMouseLeave={() => setHoveredTimelineIdx(null)}
                                style={{ cursor: 'pointer' }}
                              >
                                {isHovered && (
                                  <line x1={x} y1="20" x2={x} y2="180" stroke="rgba(255, 210, 31, 0.4)" strokeDasharray="3" />
                                )}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isHovered ? 6 : val > 0 ? 3.5 : 2}
                                  fill={val > 0 ? YELLOW_ACCENT : '#737373'}
                                  stroke="#07070a"
                                  strokeWidth="2"
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Tooltip on hover */}
                        {hoveredTimelineIdx !== null && timeline[hoveredTimelineIdx] && (
                          <Box
                            sx={{
                              mt: 1,
                              p: 1.5,
                              background: 'rgba(26, 26, 36, 0.95)',
                              border: `1px solid ${CARD_BORDER}`,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                                {timeline[hoveredTimelineIdx].bucket}
                              </Typography>
                              <Chip
                                label={`${timeline[hoveredTimelineIdx].commits} Commits`}
                                size="small"
                                sx={{ height: 22, fontSize: '0.75rem', background: 'rgba(255, 210, 31, 0.2)', color: YELLOW_ACCENT, fontWeight: 700 }}
                              />
                              <Chip
                                label={`${timeline[hoveredTimelineIdx].active_contributors} Contributors`}
                                size="small"
                                sx={{ height: 22, fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: BLUE_ACCENT }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography variant="caption" sx={{ color: GREEN_ACCENT, fontWeight: 700 }}>
                                +{timeline[hoveredTimelineIdx].additions}
                              </Typography>
                              <Typography variant="caption" sx={{ color: RED_ACCENT, fontWeight: 700 }}>
                                -{timeline[hoveredTimelineIdx].deletions}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                                (Churn: {timeline[hoveredTimelineIdx].total_churn})
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Card>
                </Grid>

                {/* Code Churn Breakdown Card */}
                <Grid size={{ xs: 12, lg: 4 }}>
                  <Card sx={{ p: 3, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', mb: 1 }}>
                      Code Churn Dynamics
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#A1A1AA', mb: 3 }}>
                      Distinguishing net line growth from total modification churn volume.
                    </Typography>

                    {/* Progress representation */}
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ color: GREEN_ACCENT, fontWeight: 700 }}>
                          Additions (+{overviewData?.overview.lines_added.toLocaleString() || 0})
                        </Typography>
                        <Typography variant="body2" sx={{ color: RED_ACCENT, fontWeight: 700 }}>
                          Deletions (-{overviewData?.overview.lines_deleted.toLocaleString() || 0})
                        </Typography>
                      </Box>

                      {/* Stacked bar */}
                      {overviewData && overviewData.overview.total_churn_volume > 0 ? (
                        <Box sx={{ width: '100%', height: 10, borderRadius: '5px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
                          <Box
                            sx={{
                              width: `${(overviewData.overview.lines_added / overviewData.overview.total_churn_volume) * 100}%`,
                              background: GREEN_ACCENT,
                            }}
                          />
                          <Box
                            sx={{
                              width: `${(overviewData.overview.lines_deleted / overviewData.overview.total_churn_volume) * 100}%`,
                              background: RED_ACCENT,
                            }}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ width: '100%', height: 10, borderRadius: '5px', background: 'rgba(255,255,255,0.05)' }} />
                      )}
                    </Box>

                    {/* Key facts */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, background: 'rgba(0,0,0,0.3)', borderRadius: '12px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                          Net Line Change:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: (overviewData?.overview.net_line_change || 0) >= 0 ? GREEN_ACCENT : RED_ACCENT }}>
                          {overviewData && overviewData.overview.net_line_change > 0 ? '+' : ''}
                          {overviewData?.overview.net_line_change.toLocaleString() || 0} lines
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                          Total Change Volume:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                          {overviewData?.overview.total_churn_volume.toLocaleString() || 0} lines
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                          Diff Stats Available:
                        </Typography>
                        <Typography variant="caption" sx={{ color: overviewData?.overview.stats_available ? GREEN_ACCENT : '#737373' }}>
                          {overviewData?.overview.stats_available ? 'Verified from Git' : 'Partial / Unavailable'}
                        </Typography>
                      </Box>
                    </Box>

                    <Typography variant="caption" sx={{ color: '#737373', display: 'block', mt: 2 }}>
                      A file with 500 lines added and 450 deleted has +50 net lines, but 950 lines of churn. Churn measures revision intensity.
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* TABS: Deep Dive Analytics */}
              <Box sx={{ mb: 3 }}>
                <Tabs
                  value={activeTab}
                  onChange={(_, val) => setActiveTab(val)}
                  sx={{
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    '& .MuiTabs-indicator': { backgroundColor: YELLOW_ACCENT, height: 3 },
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 700,
                      color: '#A1A1AA',
                      '&.Mui-selected': { color: YELLOW_ACCENT },
                    },
                  }}
                >
                  <Tab icon={<WhatshotIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="File Hotspots" />
                  <Tab icon={<FolderOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Module Explorer" />
                  <Tab icon={<PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Contributor Insights" />
                  <Tab icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="AI Productivity Insights" />
                </Tabs>
              </Box>

              {/* TAB 0: File Hotspots */}
              {activeTab === 0 && (
                <Card sx={{ p: 3, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                        Frequently Modified Files
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                        Files receiving significant development activity, revisions, and code churn.
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <TextField
                        size="small"
                        placeholder="Search file path..."
                        value={hotspotsSearch}
                        onChange={(e) => {
                          setHotspotsSearch(e.target.value);
                          setHotspotsPage(1);
                        }}
                        sx={{
                          input: { color: '#FFFFFF', fontSize: '0.85rem' },
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '8px',
                          width: 220,
                        }}
                      />

                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel sx={{ color: '#A1A1AA', fontSize: '0.85rem' }}>Sort By</InputLabel>
                        <Select
                          value={hotspotsOrdering}
                          label="Sort By"
                          onChange={(e) => setHotspotsOrdering(e.target.value)}
                          sx={{
                            color: '#FFFFFF',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                          }}
                        >
                          <MenuItem value="-commits">Most Commits</MenuItem>
                          <MenuItem value="-churn">Highest Churn</MenuItem>
                          <MenuItem value="-recent">Recently Active</MenuItem>
                          <MenuItem value="-contributors">Most Contributors</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>

                  {loadingHotspots ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <CircularProgress sx={{ color: YELLOW_ACCENT }} />
                    </Box>
                  ) : hotspots.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#737373', py: 6, textAlign: 'center' }}>
                      No file modifications match the selected criteria.
                    </Typography>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: `1px solid ${CARD_BORDER}` }}>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>File Path</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Module</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Commits</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Contributors</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Total Churn</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Activity Tag</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotspots.map((h, idx) => {
                            const tagStyle = getActivityTagColor(h.activity_label);
                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                                }}
                              >
                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#FFFFFF', fontWeight: 600 }}>
                                  {h.file_path}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#A1A1AA' }}>{h.module}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: YELLOW_ACCENT }}>
                                  {h.commit_count}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#D4D4D8' }}>
                                  {h.contributor_count}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: GREEN_ACCENT }}>+{h.lines_added}</span> /{' '}
                                  <span style={{ color: RED_ACCENT }}>-{h.lines_deleted}</span>{' '}
                                  <span style={{ color: '#737373', fontSize: '0.75rem' }}>({h.total_churn})</span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <Chip
                                    label={h.activity_label}
                                    size="small"
                                    sx={{
                                      fontSize: '0.7rem',
                                      height: 22,
                                      fontWeight: 600,
                                      background: tagStyle.bg,
                                      color: tagStyle.text,
                                      border: `1px solid ${tagStyle.border}`,
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => handleInspectFile(h.file_path)}
                                      sx={{
                                        fontSize: '0.75rem',
                                        textTransform: 'none',
                                        borderColor: CARD_BORDER,
                                        color: '#D4D4D8',
                                        '&:hover': { borderColor: YELLOW_ACCENT, color: YELLOW_ACCENT },
                                      }}
                                    >
                                      History
                                    </Button>
                                    <Tooltip title="View Dependency Impact">
                                      <IconButton
                                        size="small"
                                        onClick={() => navigate(`/repository/${id}/impact`)}
                                        sx={{ color: '#A1A1AA', '&:hover': { color: YELLOW_ACCENT } }}
                                      >
                                        <OpenInNewIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {hotspotsCount > 15 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                          <Pagination
                            count={Math.ceil(hotspotsCount / 15)}
                            page={hotspotsPage}
                            onChange={(_, p) => setHotspotsPage(p)}
                            sx={{
                              '& .MuiPaginationItem-root': { color: '#A1A1AA' },
                              '& .Mui-selected': { background: `${YELLOW_ACCENT} !important`, color: '#000000', fontWeight: 700 },
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                </Card>
              )}

              {/* TAB 1: Module Explorer */}
              {activeTab === 1 && (
                <Card sx={{ p: 3, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF', mb: 1 }}>
                    Module-Level Activity
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#A1A1AA', mb: 3 }}>
                    Activity aggregation grouped by directory and module hierarchy.
                  </Typography>

                  {loadingModules ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <CircularProgress sx={{ color: YELLOW_ACCENT }} />
                    </Box>
                  ) : modules.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#737373', py: 6, textAlign: 'center' }}>
                      No modules recorded for this timeframe.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {modules.map((m, idx) => (
                        <Card
                          key={idx}
                          sx={{
                            p: 2.5,
                            background: 'rgba(0,0,0,0.3)',
                            border: `1px solid ${expandedModule === m.module_path ? YELLOW_ACCENT : CARD_BORDER}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'border 0.2s',
                          }}
                          onClick={() =>
                            setExpandedModule(expandedModule === m.module_path ? null : m.module_path)
                          }
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <FolderOutlinedIcon sx={{ color: YELLOW_ACCENT, fontSize: 24 }} />
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                                  {m.module_path}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                                  {m.file_count} files modified • {m.contributor_count} contributor(s)
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: YELLOW_ACCENT }}>
                                  {m.commit_count} Commits
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#737373' }}>
                                  {m.total_churn} churn (+{m.lines_added} / -{m.lines_deleted})
                                </Typography>
                              </Box>

                              {m.single_contributor_period && (
                                <Tooltip title={m.cautious_note || 'Single observed contributor in the selected window'}>
                                  <Chip
                                    label="Single Contributor"
                                    size="small"
                                    sx={{
                                      height: 24,
                                      fontSize: '0.7rem',
                                      background: 'rgba(249, 115, 22, 0.15)',
                                      color: '#F97316',
                                      border: '1px solid rgba(249, 115, 22, 0.4)',
                                    }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </Box>

                          {/* Expanded Top Files in this Module */}
                          {expandedModule === m.module_path && (
                            <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                              <Typography variant="caption" sx={{ color: '#A1A1AA', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                                Active Files in this Module:
                              </Typography>
                              {m.top_files && m.top_files.length > 0 ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {m.top_files.map((tf, fIdx) => (
                                    <Box
                                      key={fIdx}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        p: 1,
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#FFFFFF' }}>
                                        {tf.file_path}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                                        {tf.commits} commits • {tf.churn} churn
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="caption" sx={{ color: '#737373' }}>
                                  No constituent files details available.
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Card>
                      ))}
                    </Box>
                  )}
                </Card>
              )}

              {/* TAB 2: Contributor Insights */}
              {activeTab === 2 && (
                <Card sx={{ p: 3, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                        Contributor Collaboration Insights
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                        Git author participation patterns across the codebase. Descriptive activity, not employee evaluation.
                      </Typography>
                    </Box>

                    <TextField
                      size="small"
                      placeholder="Filter contributor..."
                      value={contributorsSearch}
                      onChange={(e) => {
                        setContributorsSearch(e.target.value);
                        setContributorsPage(1);
                      }}
                      sx={{
                        input: { color: '#FFFFFF', fontSize: '0.85rem' },
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '8px',
                        width: 220,
                      }}
                    />
                  </Box>

                  {loadingContributors ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <CircularProgress sx={{ color: YELLOW_ACCENT }} />
                    </Box>
                  ) : contributors.length === 0 ? (
                    <Typography variant="body2" sx={{ color: '#737373', py: 6, textAlign: 'center' }}>
                      No contributor records found in this window.
                    </Typography>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.4)', borderBottom: `1px solid ${CARD_BORDER}` }}>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Contributor</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Commits</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Files Modified</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Lines +/-</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Active Window</th>
                            <th style={{ padding: '12px 16px', color: '#A1A1AA' }}>Top Focused Modules</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contributors.map((c, idx) => {
                            const initials = c.display_name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase();

                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                                }}
                              >
                                <td style={{ padding: '12px 16px' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box
                                      sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: 'rgba(255, 210, 31, 0.15)',
                                        color: YELLOW_ACCENT,
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {initials || '??'}
                                    </Box>
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                                        {c.display_name}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: '#737373' }}>
                                        {c.email || 'Author'}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: YELLOW_ACCENT }}>
                                  {c.commit_count}
                                </td>
                                <td style={{ padding: '12px 16px', color: '#D4D4D8' }}>
                                  {c.files_modified_count}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: GREEN_ACCENT }}>+{c.lines_added}</span> /{' '}
                                  <span style={{ color: RED_ACCENT }}>-{c.lines_deleted}</span>
                                </td>
                                <td style={{ padding: '12px 16px', color: '#A1A1AA', fontSize: '0.8rem' }}>
                                  {c.first_commit ? new Date(c.first_commit).toLocaleDateString() : 'N/A'} –{' '}
                                  {c.last_commit ? new Date(c.last_commit).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {c.top_modules && c.top_modules.length > 0 ? (
                                      c.top_modules.map((tm, mIdx) => (
                                        <Chip
                                          key={mIdx}
                                          label={`${tm.module_path} (${tm.touches})`}
                                          size="small"
                                          sx={{ height: 20, fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: '#D4D4D8' }}
                                        />
                                      ))
                                    ) : (
                                      <span style={{ color: '#737373', fontSize: '0.75rem' }}>None</span>
                                    )}
                                  </Box>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {contributorsCount > 10 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                          <Pagination
                            count={Math.ceil(contributorsCount / 10)}
                            page={contributorsPage}
                            onChange={(_, p) => setContributorsPage(p)}
                            sx={{
                              '& .MuiPaginationItem-root': { color: '#A1A1AA' },
                              '& .Mui-selected': { background: `${YELLOW_ACCENT} !important`, color: '#000000', fontWeight: 700 },
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                </Card>
              )}

              {/* TAB 3: Grounded AI Productivity Insights */}
              {activeTab === 3 && (
                <Card sx={{ p: 3.5, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: '16px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <AutoAwesomeIcon sx={{ color: YELLOW_ACCENT, fontSize: 24 }} />
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                          Grounded AI Activity Synthesis
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#A1A1AA' }}>
                          Objective insights generated exclusively from statically measured repository metrics.
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip
                        label={aiInsights?.ai_generated ? `Grounded with ${aiInsights.model}` : 'Deterministic Synthesis'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          background: aiInsights?.ai_generated ? 'rgba(255, 210, 31, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: aiInsights?.ai_generated ? YELLOW_ACCENT : '#D4D4D8',
                          border: `1px solid ${aiInsights?.ai_generated ? YELLOW_ACCENT : 'rgba(255, 255, 255, 0.1)'}`,
                        }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => fetchInsights(true)}
                        disabled={loadingInsights}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem',
                          borderColor: CARD_BORDER,
                          color: '#D4D4D8',
                          '&:hover': { borderColor: YELLOW_ACCENT, color: YELLOW_ACCENT },
                        }}
                      >
                        {loadingInsights ? 'Analyzing...' : 'Regenerate'}
                      </Button>
                    </Box>
                  </Box>

                  {loadingInsights ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <CircularProgress sx={{ color: YELLOW_ACCENT }} />
                    </Box>
                  ) : !aiInsights ? (
                    <Typography variant="body2" sx={{ color: '#737373', py: 6, textAlign: 'center' }}>
                      Click Regenerate to produce grounded productivity insights.
                    </Typography>
                  ) : (
                    <Grid container spacing={3}>
                      {/* Overall Pattern */}
                      <Grid size={{ xs: 12 }}>
                        <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px' }}>
                          <Typography variant="subtitle2" sx={{ color: YELLOW_ACCENT, fontWeight: 700, mb: 1 }}>
                            OVERALL ACTIVITY PATTERN
                          </Typography>
                          <Typography variant="body1" sx={{ color: '#FFFFFF', lineHeight: 1.6 }}>
                            {aiInsights.overall_pattern}
                          </Typography>
                        </Card>
                      </Grid>

                      {/* Timeline Trends */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: '#38BDF8', fontWeight: 700, mb: 1 }}>
                            TIMELINE & VELOCITY TRENDS
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#E4E4E7', lineHeight: 1.6 }}>
                            {aiInsights.timeline_trends}
                          </Typography>
                        </Card>
                      </Grid>

                      {/* Hotspots & Modules */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: '#F97316', fontWeight: 700, mb: 1 }}>
                            HOTSPOTS & CONCENTRATED MODULES
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#E4E4E7', lineHeight: 1.6 }}>
                            {aiInsights.hotspots_and_modules}
                          </Typography>
                        </Card>
                      </Grid>

                      {/* Code Churn Dynamics */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: GREEN_ACCENT, fontWeight: 700, mb: 1 }}>
                            CODE CHURN DYNAMICS
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#E4E4E7', lineHeight: 1.6 }}>
                            {aiInsights.code_churn_dynamics}
                          </Typography>
                        </Card>
                      </Grid>

                      {/* Collaboration & Distribution */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: '#A855F7', fontWeight: 700, mb: 1 }}>
                            COLLABORATION & DISTRIBUTION
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#E4E4E7', lineHeight: 1.6 }}>
                            {aiInsights.collaboration_and_distribution}
                          </Typography>
                        </Card>
                      </Grid>

                      {/* Actionable Areas For Review */}
                      {aiInsights.areas_for_review && aiInsights.areas_for_review.length > 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Card sx={{ p: 2.5, background: 'rgba(0,0,0,0.3)', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px' }}>
                            <Typography variant="subtitle2" sx={{ color: YELLOW_ACCENT, fontWeight: 700, mb: 2 }}>
                              AREAS WORTH REVIEWING
                            </Typography>
                            <Grid container spacing={2}>
                              {aiInsights.areas_for_review.map((area, idx) => (
                                <Grid size={{ xs: 12, md: 6 }} key={idx}>
                                  <Box sx={{ p: 2, background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFFFFF', mb: 0.5 }}>
                                      {area.title}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#A1A1AA', display: 'block', mb: 1 }}>
                                      {area.reason}
                                    </Typography>
                                    {area.affected_path && (
                                      <Chip
                                        label={area.affected_path}
                                        size="small"
                                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 20 }}
                                      />
                                    )}
                                  </Box>
                                </Grid>
                              ))}
                            </Grid>
                          </Card>
                        </Grid>
                      )}

                      {/* Explicit Data Limitations */}
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" sx={{ color: '#737373', display: 'block', fontStyle: 'italic' }}>
                          Data Limitations: {aiInsights.data_limitations}
                        </Typography>
                      </Grid>
                    </Grid>
                  )}
                </Card>
              )}
            </>
          )}

          {/* FILE DETAIL COMMIT HISTORY MODAL */}
          <Dialog
            open={Boolean(selectedFileDetail)}
            onClose={() => setSelectedFileDetail(null)}
            maxWidth="md"
            fullWidth
            slotProps={{
              paper: {
                sx: {
                  background: '#121218',
                  color: '#FFFFFF',
                  borderRadius: '16px',
                  border: `1px solid ${CARD_BORDER}`,
                },
              },
            }}
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {selectedFileDetail?.file_path}
                </Typography>
                <Typography variant="caption" sx={{ color: '#A1A1AA' }}>
                  {selectedFileDetail?.commit_touches_count} commits • {selectedFileDetail?.contributors_count} contributors • Churn: {selectedFileDetail?.total_churn} (+{selectedFileDetail?.total_additions} / -{selectedFileDetail?.total_deletions})
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedFileDetail(null)} sx={{ color: '#A1A1AA' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
              {selectedFileDetail?.commits.map((c, idx) => (
                <Box
                  key={idx}
                  sx={{
                    py: 1.5,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: YELLOW_ACCENT }}>
                        {c.commit_sha.slice(0, 7)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#FFFFFF' }}>
                        {c.message}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: '#737373' }}>
                      by {c.author_name} on {new Date(c.committed_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" sx={{ color: GREEN_ACCENT, mr: 1 }}>
                      +{c.additions}
                    </Typography>
                    <Typography variant="caption" sx={{ color: RED_ACCENT }}>
                      -{c.deletions}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  if (selectedFileDetail) {
                    navigate(`/repository/${id}/impact`);
                  }
                }}
                endIcon={<OpenInNewIcon />}
                sx={{
                  textTransform: 'none',
                  borderColor: CARD_BORDER,
                  color: YELLOW_ACCENT,
                  '&:hover': { borderColor: YELLOW_ACCENT },
                }}
              >
                Analyze Dependency Impact
              </Button>
            </DialogActions>
          </Dialog>
        </Container>
      </Box>
    </DashboardLayout>
  );
};

export default ProductivityDashboard;
