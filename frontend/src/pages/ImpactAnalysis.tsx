import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Autocomplete,
  TextField,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LayersIcon from '@mui/icons-material/Layers';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CodeIcon from '@mui/icons-material/Code';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import HubIcon from '@mui/icons-material/Hub';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LoopIcon from '@mui/icons-material/Loop';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import { getDashboardRepository, getImpactFiles, analyzeImpact } from '../services/api';
import type {
  Repository,
  ImpactFilesResponse,
  ImpactAnalysisResponse,
} from '../types';

// Helper to generate direct GitHub URL
const getGitHubFileUrl = (
  repoUrl?: string,
  defaultBranch?: string,
  filePath?: string,
  lineNumber?: number
): string | null => {
  if (!repoUrl || !filePath) return null;
  const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/+$/, '');
  const branch = defaultBranch || 'main';
  const lineSuffix = lineNumber ? `#L${lineNumber}` : '';
  return `${cleanUrl}/blob/${branch}/${filePath}${lineSuffix}`;
};

// Helper for contextual file role description
const getAffectedFileDescription = (
  filePath: string,
  depData?: { imported_symbols?: string[]; line_number?: number; depth?: number; via?: string }
): string => {
  const lower = filePath.toLowerCase();
  if (lower.includes('admin_views')) {
    return 'Uses model definitions for admin operations.';
  }
  if (lower.includes('admin')) {
    return 'Imports models, used for admin configuration.';
  }
  if (lower.includes('migrate') || lower.includes('s3')) {
    return 'Reads from shop models for migration.';
  }
  if (lower.includes('seed')) {
    return 'Depends on product model for seeding data.';
  }
  if (lower.includes('page') || lower.includes('component')) {
    return 'Displays product data from the backend models.';
  }
  if (lower.includes('views') || lower.includes('view')) {
    return 'Uses model queries and business logic for API endpoints.';
  }
  if (lower.includes('urls') || lower.includes('routes')) {
    return 'Defines URL routing patterns and request dispatchers.';
  }
  if (lower.includes('signal') || lower.includes('event')) {
    return 'Executes automated hooks on data state mutations.';
  }
  if (lower.includes('email') || lower.includes('whatsapp') || lower.includes('notify')) {
    return 'Dispatches order and inventory notifications.';
  }
  if (depData?.imported_symbols && depData.imported_symbols.length > 0) {
    const syms = depData.imported_symbols.slice(0, 3).join(', ');
    const more = depData.imported_symbols.length > 3 ? '...' : '';
    return `Imports ${syms}${more} (Line ${depData.line_number || 1}).`;
  }
  if (depData?.via) {
    return `Cascades transitively via ${depData.via} (Depth ${depData.depth || 2}).`;
  }
  return 'Impacted by upstream interface or model changes.';
};

// Helper for target file role in banner
const getTargetFileRole = (filePath: string, language?: string, definedSymbolsCount?: number): string => {
  const lower = filePath.toLowerCase();
  const parts = filePath.split('/');
  const mod = parts.length > 1 ? parts[0] : 'core';

  if (lower.includes('models')) {
    return `Defines core data models used across the ${mod} module.`;
  }
  if (lower.includes('views') || lower.includes('controllers')) {
    return `Handles API endpoints and business logic for the ${mod} module.`;
  }
  if (lower.includes('admin')) {
    return `Configures administration workflows and interfaces for ${mod}.`;
  }
  if (lower.includes('urls') || lower.includes('routes')) {
    return `Defines routing patterns and endpoint bindings for ${mod}.`;
  }
  if (lower.includes('component') || lower.includes('page')) {
    return `Renders user interface and manages client interactions.`;
  }
  if (definedSymbolsCount && definedSymbolsCount > 0) {
    return `Exports ${definedSymbolsCount} symbols and interfaces across the repository.`;
  }
  return `Core ${language || 'source'} file in ${filePath}.`;
};

// Helper for file risk ranking
const getFileRiskLevel = (
  isDirect: boolean,
  importedSymbolsCount: number,
  depth: number,
  filePath: string
): 'High' | 'Medium' | 'Low' => {
  const lower = filePath.toLowerCase();
  if (isDirect) {
    if (lower.includes('admin') || lower.includes('views') || importedSymbolsCount >= 4) {
      return 'High';
    }
    return 'Medium';
  }
  if (depth <= 2 && (lower.includes('migrate') || lower.includes('seed') || lower.includes('order'))) {
    return 'Medium';
  }
  return 'Low';
};

export const ImpactAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [filesData, setFilesData] = useState<ImpactFilesResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [impactResult, setImpactResult] = useState<ImpactAnalysisResponse | null>(null);

  // File navigation history & in-memory cache for instant return
  const [initialRootFile, setInitialRootFile] = useState<string>('');
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const analysisCacheRef = useRef<Map<string, ImpactAnalysisResponse>>(new Map());

  // Previous file in history trail
  const previousFile = historyStack.length > 1 ? historyStack[historyStack.length - 2] : null;

  // View state
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const [sortBy, setSortBy] = useState<'impact-desc' | 'impact-asc' | 'name-asc' | 'depth-asc'>('impact-desc');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Tree collapse state
  const [directExpanded, setDirectExpanded] = useState<boolean>(true);
  const [transitiveExpanded, setTransitiveExpanded] = useState<boolean>(true);
  const [showAllDirect, setShowAllDirect] = useState<boolean>(false);
  const [showAllTransitive, setShowAllTransitive] = useState<boolean>(false);

  // Modal / Drawer state for Explainable Risk Breakdown & Limitations
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);

  // Graph canvas pan/zoom
  const [graphZoom, setGraphZoom] = useState<number>(1);
  const [graphPan, setGraphPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initial load
  useEffect(() => {
    if (!id) return;

    const loadInitialData = async () => {
      setLoadingFiles(true);
      try {
        const repoData = await getDashboardRepository(Number(id));
        setRepo(repoData);

        const files = await getImpactFiles(id);
        setFilesData(files);

        // Preselect the first suggested hub file, or shop/models.py if available, or first file
        let initialFile = '';
        if (files.suggested_files && files.suggested_files.length > 0) {
          const modelHub = files.suggested_files.find((f) => f.includes('models.py'));
          initialFile = modelHub || files.suggested_files[0];
        } else if (files.files && files.files.length > 0) {
          initialFile = files.files[0];
        }

        if (initialFile) {
          setSelectedFile(initialFile);
          setInitialRootFile(initialFile);
          setHistoryStack([initialFile]);
          handleAnalyze(initialFile, false, false);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to load repository files.');
      } finally {
        setLoadingFiles(false);
      }
    };

    loadInitialData();
  }, [id]);

  // Execute Impact Analysis
  const handleAnalyze = async (
    filePathToAnalyze?: string,
    forceRebuild = false,
    isDrillDown = false
  ) => {
    const target = filePathToAnalyze || selectedFile;
    if (!id || !target) {
      toast.error('Please choose or enter a file to analyze.');
      return;
    }

    if (forceRebuild) {
      analysisCacheRef.current.clear();
    }

    setSelectedFile(target);

    // Update history stack
    if (isDrillDown) {
      setHistoryStack((prev) => (prev[prev.length - 1] === target ? prev : [...prev, target]));
    } else {
      if (!isDrillDown) {
        setInitialRootFile(target);
        setHistoryStack([target]);
      }
    }

    // Check cache for instant retrieval without reloading
    if (!forceRebuild && analysisCacheRef.current.has(target)) {
      setImpactResult(analysisCacheRef.current.get(target)!);
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeImpact(id, target, forceRebuild);
      analysisCacheRef.current.set(target, result);
      setImpactResult(result);
      if (forceRebuild) {
        toast.success('Dependency graph rebuilt and analyzed!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Impact analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Drill down into a dependent file
  const handleDrillDown = (targetPath: string) => {
    if (targetPath === selectedFile) return;
    handleAnalyze(targetPath, false, true);
  };

  // Navigate back to the previous file in the history trail
  const handleGoBack = () => {
    if (historyStack.length <= 1) return;
    const newStack = historyStack.slice(0, -1);
    const target = newStack[newStack.length - 1];
    setHistoryStack(newStack);
    setSelectedFile(target);

    if (analysisCacheRef.current.has(target)) {
      setImpactResult(analysisCacheRef.current.get(target)!);
    } else {
      handleAnalyze(target, false, false);
    }
  };

  // Return directly to the original root tree initially generated
  const handleResetToOriginal = () => {
    if (!initialRootFile || initialRootFile === selectedFile) return;
    setHistoryStack([initialRootFile]);
    setSelectedFile(initialRootFile);

    if (analysisCacheRef.current.has(initialRootFile)) {
      setImpactResult(analysisCacheRef.current.get(initialRootFile)!);
    } else {
      handleAnalyze(initialRootFile, false, false);
    }
    toast.success(`Returned to original tree (${initialRootFile.split('/').pop()})`);
  };

  const handleCopyPath = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedFile(text);
    toast.success('File path copied to clipboard');
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // Unified list of affected files with computed metadata
  const affectedFilesList = useMemo(() => {
    if (!impactResult) return [];

    const directList = (impactResult.direct_dependents || []).map((dep) => ({
      file_path: dep.file_path,
      isDirect: true,
      depth: 1,
      imported_symbols: dep.imported_symbols || [],
      line_number: dep.line_number,
      description: getAffectedFileDescription(dep.file_path, dep),
      risk: getFileRiskLevel(true, dep.imported_symbols?.length || 0, 1, dep.file_path),
    }));

    const transitiveList = (impactResult.transitive_dependents || []).map((dep) => ({
      file_path: dep.file_path,
      isDirect: false,
      depth: dep.depth || 2,
      via: dep.via,
      dependency_path: dep.dependency_path || [],
      imported_symbols: [],
      line_number: undefined,
      description: getAffectedFileDescription(dep.file_path, dep),
      risk: getFileRiskLevel(false, 0, dep.depth || 2, dep.file_path),
    }));

    const combined = [...directList, ...transitiveList];

    // Deduplicate if file appears in both
    const seen = new Set<string>();
    const deduplicated = combined.filter((item) => {
      if (seen.has(item.file_path)) return false;
      seen.add(item.file_path);
      return true;
    });

    // Apply sorting
    return deduplicated.sort((a, b) => {
      const riskWeight = { High: 3, Medium: 2, Low: 1 };
      if (sortBy === 'impact-desc') {
        return riskWeight[b.risk] - riskWeight[a.risk] || a.depth - b.depth;
      }
      if (sortBy === 'impact-asc') {
        return riskWeight[a.risk] - riskWeight[b.risk] || a.depth - b.depth;
      }
      if (sortBy === 'name-asc') {
        return a.file_path.localeCompare(b.file_path);
      }
      if (sortBy === 'depth-asc') {
        return a.depth - b.depth;
      }
      return 0;
    });
  }, [impactResult, sortBy]);

  // Key direct dependent files for recommended actions
  const keyDirectFiles = useMemo(() => {
    if (!impactResult || !impactResult.direct_dependents) return [];
    return impactResult.direct_dependents.slice(0, 3).map((d) => d.file_path);
  }, [impactResult]);

  // Interactive SVG graph nodes and edges
  const graphData = useMemo(() => {
    if (!impactResult) return { nodes: [], edges: [], width: 700, height: 420 };

    const target = impactResult.target_file;
    const direct = (impactResult.direct_dependents || []).slice(0, 10);
    const transitive = (impactResult.transitive_dependents || []).slice(0, 6);

    const centerX = 340;
    const centerY = 210;

    const nodes: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      type: 'target' | 'direct' | 'transitive';
      risk: 'High' | 'Medium' | 'Low';
    }> = [
      {
        id: target,
        label: target.split('/').pop() || target,
        x: centerX,
        y: centerY,
        type: 'target',
        risk: 'High',
      },
    ];

    const edges: Array<{ from: string; to: string; type: 'direct' | 'transitive' }> = [];

    // Layout direct dependents in a circular arc on the right/left
    const directRadius = 160;
    direct.forEach((dep, i) => {
      const angle = (Math.PI * 1.5 * i) / Math.max(1, direct.length - 1) - Math.PI * 0.75;
      const x = centerX + Math.cos(angle) * directRadius;
      const y = centerY + Math.sin(angle) * directRadius;
      nodes.push({
        id: dep.file_path,
        label: dep.file_path.split('/').pop() || dep.file_path,
        x,
        y,
        type: 'direct',
        risk: getFileRiskLevel(true, dep.imported_symbols?.length || 0, 1, dep.file_path),
      });
      edges.push({ from: target, to: dep.file_path, type: 'direct' });
    });

    // Layout transitive dependents in an outer arc
    const transRadius = 250;
    transitive.forEach((dep, i) => {
      const angle = (Math.PI * i) / Math.max(1, transitive.length - 1) - Math.PI * 0.5;
      const x = centerX + Math.cos(angle) * transRadius;
      const y = centerY + Math.sin(angle) * transRadius;
      nodes.push({
        id: dep.file_path,
        label: dep.file_path.split('/').pop() || dep.file_path,
        x,
        y,
        type: 'transitive',
        risk: getFileRiskLevel(false, 0, dep.depth || 2, dep.file_path),
      });
      const parent = dep.via || target;
      edges.push({ from: parent, to: dep.file_path, type: 'transitive' });
    });

    return { nodes, edges, width: 680, height: 420 };
  }, [impactResult]);

  return (
    <DashboardLayout>
      <Box sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="xl" disableGutters>
          {/* ─── Top Header Row ──────────────────────────────────────────────── */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            {/* Title & Subtitle with Yellow Lightning Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
              {repo && (
                <Tooltip title="Back to repository overview">
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/repository/${id}`)}
                    sx={{
                      color: '#94a3b8',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      p: 0.8,
                      '&:hover': { color: '#ffd21f', borderColor: 'rgba(255, 210, 31, 0.3)' },
                    }}
                  >
                    <ArrowBackIcon sx={{ fontSize: '1.1rem' }} />
                  </IconButton>
                </Tooltip>
              )}
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: 'rgba(255, 210, 31, 0.12)',
                  border: '1px solid rgba(255, 210, 31, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffd21f',
                  boxShadow: '0 0 20px rgba(255, 210, 31, 0.15)',
                }}
              >
                <FlashOnIcon sx={{ fontSize: '1.6rem' }} />
              </Box>
              <Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                  }}
                >
                  Impact Analysis
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem', mt: 0.2 }}>
                  Analyze the potential impact of a code change before you make it.
                </Typography>
              </Box>
            </Box>

            {/* Rebuild Graph Outlined Button */}
            <Button
              variant="outlined"
              size="medium"
              startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={() => handleAnalyze(selectedFile, true)}
              disabled={analyzing || loadingFiles}
              sx={{
                height: 40,
                borderRadius: '10px',
                color: '#ffd21f',
                borderColor: 'rgba(255, 210, 31, 0.35)',
                background: 'rgba(255, 210, 31, 0.03)',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                px: 2,
                '&:hover': {
                  borderColor: '#ffd21f',
                  background: 'rgba(255, 210, 31, 0.1)',
                },
              }}
            >
              Rebuild Graph
            </Button>
          </Box>

          {/* ─── Card 1: Search & Filter Bar ─────────────────────────────────── */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: { xs: 2.5, sm: 3 },
              mb: 3,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Top row: Label + Autocomplete Input + Analyze Button */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
              }}
            >
              <Typography
                sx={{
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.925rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Select a file to analyze
              </Typography>

              {/* Autocomplete Input styled as the rounded search box */}
              <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 300 } }}>
                <Autocomplete
                  freeSolo
                  options={filesData?.files || []}
                  value={selectedFile}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setSelectedFile(newValue);
                    }
                  }}
                  onInputChange={(_, newInputValue) => {
                    setSelectedFile(newInputValue);
                  }}
                  loading={loadingFiles}
                  renderInput={(params) => {
                    const inputProps = (params as any).InputProps || {};
                    return (
                      <TextField
                        {...params}
                        placeholder="e.g. shop/models.py"
                        variant="outlined"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            height: 44,
                            backgroundColor: '#0c0d12',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            paddingLeft: '12px !important',
                            '& fieldset': {
                              borderColor: 'rgba(255, 255, 255, 0.12)',
                            },
                            '&:hover fieldset': {
                              borderColor: 'rgba(255, 210, 31, 0.45)',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#ffd21f',
                            },
                          },
                        }}
                        slotProps={{
                          input: {
                            ...inputProps,
                            startAdornment: (
                              <InsertDriveFileOutlinedIcon
                                sx={{ color: '#94a3b8', fontSize: '1.2rem', mr: 1, flexShrink: 0 }}
                              />
                            ),
                            endAdornment: selectedFile ? (
                              <IconButton
                                size="small"
                                onClick={() => setSelectedFile('')}
                                sx={{ color: '#64748b', '&:hover': { color: '#ffffff' }, p: 0.5 }}
                              >
                                <CloseIcon sx={{ fontSize: '1rem' }} />
                              </IconButton>
                            ) : (
                              inputProps.endAdornment
                            ),
                          },
                        }}
                      />
                    );
                  }}
                />
              </Box>

              {/* Solid Yellow Analyze Impact Button */}
              <Button
                variant="contained"
                onClick={() => handleAnalyze()}
                disabled={analyzing || !selectedFile}
                startIcon={analyzing ? <CircularProgress size={18} color="inherit" /> : <FlashOnIcon />}
                sx={{
                  height: 44,
                  borderRadius: '10px',
                  background: '#ffd21f',
                  color: '#050505',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  px: 3,
                  flexShrink: 0,
                  width: { xs: '100%', md: 'auto' },
                  boxShadow: '0 4px 14px rgba(255, 210, 31, 0.25)',
                  '&:hover': {
                    background: '#ffe033',
                    boxShadow: '0 6px 20px rgba(255, 210, 31, 0.4)',
                  },
                  '&:disabled': {
                    background: 'rgba(255, 210, 31, 0.3)',
                    color: '#64748b',
                  },
                }}
              >
                {analyzing ? 'Analyzing Impact...' : 'Analyze Impact'}
              </Button>
            </Box>

            {/* Bottom row: Suggested Files horizontal pills */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                mt: 2.5,
                flexWrap: 'wrap',
              }}
            >
              {/* Quick Return to Original Tree Pill if drilled down */}
              {initialRootFile && selectedFile !== initialRootFile && (
                <Box
                  onClick={handleResetToOriginal}
                  sx={{
                    cursor: 'pointer',
                    px: 1.5,
                    py: 0.45,
                    borderRadius: '20px',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    background: 'rgba(255, 210, 31, 0.15)',
                    border: '1.5px solid #ffd21f',
                    color: '#ffd21f',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.6,
                    boxShadow: '0 0 12px rgba(255, 210, 31, 0.25)',
                    transition: 'all 0.18s ease',
                    mr: 1,
                    '&:hover': {
                      background: 'rgba(255, 210, 31, 0.25)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <ArrowBackIcon sx={{ fontSize: '0.85rem' }} />
                  Original Tree: {initialRootFile.split('/').pop()}
                </Box>
              )}

              {filesData?.suggested_files && filesData.suggested_files.length > 0 && (
                <>
                  <Typography sx={{ fontSize: '0.825rem', color: '#94a3b8', fontWeight: 500, mr: 0.5 }}>
                    Suggested Files:
                  </Typography>
                  {filesData.suggested_files.map((file) => {
                    const isSelected = selectedFile === file;
                  return (
                    <Box
                      key={file}
                      onClick={() => {
                        setSelectedFile(file);
                        handleAnalyze(file);
                      }}
                      sx={{
                        cursor: 'pointer',
                        px: 1.4,
                        py: 0.45,
                        borderRadius: '20px',
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        background: isSelected ? 'rgba(255, 210, 31, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? '1px solid #ffd21f' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: isSelected ? '#ffd21f' : '#cbd5e1',
                        transition: 'all 0.18s ease',
                        '&:hover': {
                          borderColor: '#ffd21f',
                          color: '#ffffff',
                          background: 'rgba(255, 210, 31, 0.08)',
                        },
                      }}
                    >
                      {file}
                    </Box>
                  );
                })}
              </>
            )}
          </Box>
        </Card>

          {/* ─── Loading Skeleton / Progress ─────────────────────────────────── */}
          {analyzing && !impactResult && (
            <Box
              sx={{
                p: 6,
                textAlign: 'center',
                borderRadius: '16px',
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                mb: 4,
              }}
            >
              <CircularProgress sx={{ color: '#ffd21f', mb: 2 }} />
              <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                Calculating Downstream Blast Radius...
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.85rem', mt: 0.5 }}>
                Traversing statically verified import trees and evaluating cascade factors.
              </Typography>
            </Box>
          )}

          {/* ─── Main Content when Impact Result is Ready ─────────────────────── */}
          {impactResult && (
            <Box sx={{ mb: 6 }}>
              {/* ─── Card 2: Target File Overview & Key Metrics Banner ───────── */}
              <Card
                sx={{
                  background: '#111218',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  p: { xs: 2.5, sm: 3 },
                  mb: 3,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 3,
                  }}
                >
                  {/* Left: Target File Badge & Role Summary */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: { xs: '1 1 100%', md: '1 1 320px' } }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '12px',
                        background: 'rgba(255, 210, 31, 0.12)',
                        border: '1px solid rgba(255, 210, 31, 0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffd21f',
                        flexShrink: 0,
                      }}
                    >
                      <InsertDriveFileIcon sx={{ fontSize: '1.8rem' }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      {/* History breadcrumb & return to original pill */}
                      {historyStack.length > 1 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, flexWrap: 'wrap' }}>
                          <Box
                            onClick={handleGoBack}
                            sx={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              color: '#ffd21f',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              background: 'rgba(255, 210, 31, 0.1)',
                              border: '1px solid rgba(255, 210, 31, 0.25)',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                background: 'rgba(255, 210, 31, 0.2)',
                                borderColor: '#ffd21f',
                              },
                            }}
                          >
                            <ArrowBackIcon sx={{ fontSize: '0.85rem' }} />
                            Back to {previousFile?.split('/').pop()}
                          </Box>

                          {initialRootFile && initialRootFile !== selectedFile && (
                            <Box
                              onClick={handleResetToOriginal}
                              sx={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                color: '#94a3b8',
                                fontSize: '0.72rem',
                                px: 1,
                                py: 0.25,
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  color: '#ffd21f',
                                  borderColor: 'rgba(255, 210, 31, 0.3)',
                                },
                              }}
                            >
                              Drilled down from <strong>{initialRootFile.split('/').pop()}</strong> (Click to return)
                            </Box>
                          )}
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            wordBreak: 'break-all',
                          }}
                        >
                          {impactResult.target_file}
                        </Typography>
                        <Tooltip title={copiedFile === impactResult.target_file ? 'Copied' : 'Copy Path'}>
                          <IconButton
                            size="small"
                            onClick={(e) => handleCopyPath(impactResult.target_file, e)}
                            sx={{ color: '#64748b', '&:hover': { color: '#ffd21f' }, p: 0.3 }}
                          >
                            {copiedFile === impactResult.target_file ? (
                              <CheckIcon sx={{ fontSize: '0.9rem', color: '#ffd21f' }} />
                            ) : (
                              <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
                            )}
                          </IconButton>
                        </Tooltip>
                        {repo?.url && (
                          <Tooltip title="View on GitHub">
                            <IconButton
                              size="small"
                              onClick={() => {
                                const ghUrl = getGitHubFileUrl(repo.url, repo.default_branch, impactResult.target_file);
                                if (ghUrl) window.open(ghUrl, '_blank', 'noopener,noreferrer');
                              }}
                              sx={{ color: '#64748b', '&:hover': { color: '#ffffff' }, p: 0.3 }}
                            >
                              <GitHubIcon sx={{ fontSize: '0.9rem' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', mt: 0.3 }}>
                        {impactResult.target_metadata.language
                          ? impactResult.target_metadata.language.charAt(0).toUpperCase() +
                            impactResult.target_metadata.language.slice(1)
                          : 'Code'}{' '}
                        • {impactResult.target_metadata.line_count} lines •{' '}
                        {impactResult.target_metadata.defined_symbols.length} symbols
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: '#64748b', mt: 0.2 }}>
                        {getTargetFileRole(
                          impactResult.target_file,
                          impactResult.target_metadata.language,
                          impactResult.target_metadata.defined_symbols.length
                        )}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Vertical Divider */}
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      display: { xs: 'none', lg: 'block' },
                    }}
                  />

                  {/* Impact Risk Card Box */}
                  <Box
                    onClick={() => setDetailsOpen(true)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: '12px',
                      p: '12px 18px',
                      background:
                        impactResult.risk_assessment.level === 'HIGH'
                          ? 'rgba(239, 68, 68, 0.08)'
                          : impactResult.risk_assessment.level === 'MEDIUM'
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'rgba(34, 197, 94, 0.08)',
                      border:
                        impactResult.risk_assessment.level === 'HIGH'
                          ? '1px solid rgba(239, 68, 68, 0.3)'
                          : impactResult.risk_assessment.level === 'MEDIUM'
                          ? '1px solid rgba(245, 158, 11, 0.3)'
                          : '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      minWidth: 165,
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                      },
                    }}
                  >
                    {impactResult.risk_assessment.level === 'LOW' ? (
                      <CheckCircleIcon sx={{ color: '#4ade80', fontSize: '1.75rem' }} />
                    ) : (
                      <WarningAmberIcon
                        sx={{
                          color: impactResult.risk_assessment.level === 'HIGH' ? '#f87171' : '#fbbf24',
                          fontSize: '1.75rem',
                        }}
                      />
                    )}
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color:
                            impactResult.risk_assessment.level === 'HIGH'
                              ? '#f87171'
                              : impactResult.risk_assessment.level === 'MEDIUM'
                              ? '#fbbf24'
                              : '#4ade80',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        Impact Risk
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color:
                            impactResult.risk_assessment.level === 'HIGH'
                              ? '#f87171'
                              : impactResult.risk_assessment.level === 'MEDIUM'
                              ? '#fbbf24'
                              : '#4ade80',
                          lineHeight: 1.2,
                        }}
                      >
                        {impactResult.risk_assessment.level === 'HIGH'
                          ? 'High'
                          : impactResult.risk_assessment.level === 'MEDIUM'
                          ? 'Medium'
                          : 'Low'}{' '}
                        ({impactResult.risk_assessment.score}/100)
                      </Typography>
                    </Box>
                  </Box>

                  {/* Vertical Divider */}
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      display: { xs: 'none', lg: 'block' },
                    }}
                  />

                  {/* Metric: Direct Dependents */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 130 }}>
                    <Box sx={{ color: '#38bdf8', display: 'flex' }}>
                      <CodeIcon sx={{ fontSize: '1.75rem' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                        {impactResult.summary.direct_dependent_count}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        Direct Dependents
                      </Typography>
                    </Box>
                  </Box>

                  {/* Vertical Divider */}
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      display: { xs: 'none', lg: 'block' },
                    }}
                  />

                  {/* Metric: Transitive Dependents */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 140 }}>
                    <Box sx={{ color: '#fbbf24', display: 'flex' }}>
                      <LayersIcon sx={{ fontSize: '1.75rem' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                        {impactResult.summary.transitive_dependent_count}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        Transitive Dependents
                      </Typography>
                    </Box>
                  </Box>

                  {/* Vertical Divider */}
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      display: { xs: 'none', lg: 'block' },
                    }}
                  />

                  {/* Metric: Max Depth */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 100 }}>
                    <Box sx={{ color: '#ffd21f', display: 'flex' }}>
                      <AccountTreeIcon sx={{ fontSize: '1.75rem' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                        {impactResult.summary.max_depth}
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        Max Depth
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Card>

              {/* ─── Middle Section: Two Columns (Side-by-Side) ──────────────── */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* ─── Left Column: Dependency Tree / Graph ──────────────────── */}
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Card
                    sx={{
                      background: '#111218',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      p: { xs: 2.5, sm: 3 },
                      height: '100%',
                      minHeight: 520,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {/* Header: Title + [Tree | Graph] Toggle Pill */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2.5,
                        flexWrap: 'wrap',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
                        <AccountTreeIcon sx={{ color: '#ffd21f', fontSize: '1.35rem' }} />
                        <Box>
                          <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                            Dependency Tree
                          </Typography>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            How changes can propagate from this file.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Pill View Switcher: [ Tree | Graph ] */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          p: '3px',
                          gap: 0.4,
                        }}
                      >
                        <Box
                          onClick={() => setViewMode('tree')}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.6,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: viewMode === 'tree' ? 800 : 600,
                            background: viewMode === 'tree' ? '#ffd21f' : 'transparent',
                            color: viewMode === 'tree' ? '#000000' : '#94a3b8',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <FormatListBulletedIcon sx={{ fontSize: '0.9rem' }} />
                          Tree
                        </Box>

                        <Box
                          onClick={() => setViewMode('graph')}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.6,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: viewMode === 'graph' ? 800 : 600,
                            background: viewMode === 'graph' ? '#ffd21f' : 'transparent',
                            color: viewMode === 'graph' ? '#000000' : '#94a3b8',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <HubIcon sx={{ fontSize: '0.9rem' }} />
                          Graph
                        </Box>
                      </Box>
                    </Box>

                    {/* ─── Mode 1: Clean Tree View matching Image ────────────── */}
                    {viewMode === 'tree' && (
                      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                        {/* History Navigation Bar when drilled down */}
                        {historyStack.length > 1 && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 1.8,
                              p: '8px 12px',
                              borderRadius: '8px',
                              background: 'rgba(255, 210, 31, 0.08)',
                              border: '1px solid rgba(255, 210, 31, 0.3)',
                              flexWrap: 'wrap',
                              gap: 1,
                            }}
                          >
                            <Box
                              onClick={handleGoBack}
                              sx={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.8,
                                color: '#ffd21f',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              <ArrowBackIcon sx={{ fontSize: '0.95rem' }} />
                              Back to {previousFile?.split('/').pop()}
                            </Box>

                            {initialRootFile && initialRootFile !== selectedFile && (
                              <Button
                                size="small"
                                variant="text"
                                onClick={handleResetToOriginal}
                                sx={{
                                  color: '#ffffff',
                                  textTransform: 'none',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  borderRadius: '6px',
                                  py: 0.3,
                                  px: 1.2,
                                  '&:hover': { background: 'rgba(255, 210, 31, 0.2)', color: '#ffd21f' },
                                }}
                              >
                                Return to Original Tree ({initialRootFile.split('/').pop()})
                              </Button>
                            )}
                          </Box>
                        )}

                        {/* Target Node Box with yellow border */}
                        <Box
                          sx={{
                            p: '10px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #ffd21f',
                            background: 'rgba(255, 210, 31, 0.04)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1.2,
                            width: '100%',
                            boxShadow: '0 0 16px rgba(255, 210, 31, 0.08)',
                          }}
                        >
                          <FolderIcon sx={{ color: '#ffd21f', fontSize: '1.25rem' }} />
                          <Typography
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: '#ffd21f',
                            }}
                          >
                            {impactResult.target_file}{' '}
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>(Target)</span>
                          </Typography>
                        </Box>

                        {/* Tree Connecting Container with Left Border line */}
                        <Box sx={{ pl: '20px', position: 'relative', mt: 1 }}>
                          {/* ─── Branch 1: Direct Dependents ───────────────────── */}
                          <Box sx={{ mb: 2 }}>
                            {/* Folder Title */}
                            <Box
                              onClick={() => setDirectExpanded(!directExpanded)}
                              sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 0.5,
                                color: '#ffffff',
                                '&:hover': { color: '#ffd21f' },
                              }}
                            >
                              <IconButton size="small" sx={{ color: '#ffd21f', p: 0 }}>
                                {directExpanded ? (
                                  <KeyboardArrowDownIcon sx={{ fontSize: '1.1rem' }} />
                                ) : (
                                  <KeyboardArrowRightIcon sx={{ fontSize: '1.1rem' }} />
                                )}
                              </IconButton>
                              <FolderIcon sx={{ color: '#ffd21f', fontSize: '1.15rem' }} />
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                Direct Dependents ({impactResult.direct_dependents.length})
                              </Typography>
                            </Box>

                            {/* Direct Dependents Children */}
                            <Collapse in={directExpanded} timeout="auto">
                              <Box sx={{ pl: '24px', borderLeft: '1px dashed rgba(255, 210, 31, 0.25)', ml: '10px' }}>
                                {(showAllDirect
                                  ? impactResult.direct_dependents
                                  : impactResult.direct_dependents.slice(0, 3)
                                ).map((dep) => (
                                  <Box
                                    key={dep.file_path}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      py: 0.8,
                                      px: 1,
                                      borderRadius: '6px',
                                      transition: 'background 0.15s',
                                      '&:hover': {
                                        background: 'rgba(255, 255, 255, 0.04)',
                                      },
                                    }}
                                  >
                                    <Box
                                      onClick={() => handleDrillDown(dep.file_path)}
                                      sx={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        minWidth: 0,
                                      }}
                                    >
                                      <CodeIcon sx={{ color: '#38bdf8', fontSize: '1.05rem', flexShrink: 0 }} />
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.825rem',
                                          color: '#ffffff',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          '&:hover': { color: '#ffd21f', textDecoration: 'underline' },
                                        }}
                                      >
                                        {dep.file_path}
                                      </Typography>
                                    </Box>

                                    {/* Line number badge */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.72rem',
                                          color: '#94a3b8',
                                          background: 'rgba(255, 255, 255, 0.06)',
                                          border: '1px solid rgba(255, 255, 255, 0.08)',
                                          borderRadius: '4px',
                                          px: 0.8,
                                          py: 0.1,
                                        }}
                                      >
                                        L{dep.line_number || 1}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))}

                                {impactResult.direct_dependents.length > 3 && (
                                  <Box
                                    onClick={() => setShowAllDirect(!showAllDirect)}
                                    sx={{
                                      cursor: 'pointer',
                                      py: 0.6,
                                      px: 1,
                                      color: '#ffd21f',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      '&:hover': { textDecoration: 'underline' },
                                    }}
                                  >
                                    {showAllDirect
                                      ? 'Show fewer files'
                                      : `... ${impactResult.direct_dependents.length - 3} more files`}
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </Box>

                          {/* ─── Branch 2: Transitive Dependents ─────────────────── */}
                          <Box>
                            {/* Folder Title */}
                            <Box
                              onClick={() => setTransitiveExpanded(!transitiveExpanded)}
                              sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                py: 0.5,
                                color: '#ffffff',
                                '&:hover': { color: '#ffd21f' },
                              }}
                            >
                              <IconButton size="small" sx={{ color: '#fbbf24', p: 0 }}>
                                {transitiveExpanded ? (
                                  <KeyboardArrowDownIcon sx={{ fontSize: '1.1rem' }} />
                                ) : (
                                  <KeyboardArrowRightIcon sx={{ fontSize: '1.1rem' }} />
                                )}
                              </IconButton>
                              <FolderIcon sx={{ color: '#fbbf24', fontSize: '1.15rem' }} />
                              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                Transitive Dependents ({impactResult.transitive_dependents.length})
                              </Typography>
                            </Box>

                            {/* Transitive Dependents Children */}
                            <Collapse in={transitiveExpanded} timeout="auto">
                              <Box sx={{ pl: '24px', borderLeft: '1px dashed rgba(251, 191, 36, 0.25)', ml: '10px' }}>
                                {(showAllTransitive
                                  ? impactResult.transitive_dependents
                                  : impactResult.transitive_dependents.slice(0, 3)
                                ).map((dep, idx) => (
                                  <Box
                                    key={dep.file_path}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      py: 0.8,
                                      px: 1,
                                      borderRadius: '6px',
                                      transition: 'background 0.15s',
                                      '&:hover': {
                                        background: 'rgba(255, 255, 255, 0.04)',
                                      },
                                    }}
                                  >
                                    <Box
                                      onClick={() => handleDrillDown(dep.file_path)}
                                      sx={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        minWidth: 0,
                                      }}
                                    >
                                      <CodeIcon sx={{ color: '#38bdf8', fontSize: '1.05rem', flexShrink: 0 }} />
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.825rem',
                                          color: '#ffffff',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          '&:hover': { color: '#ffd21f', textDecoration: 'underline' },
                                        }}
                                      >
                                        {dep.file_path}
                                      </Typography>
                                    </Box>

                                    {/* Depth / Line indicator */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.72rem',
                                          color: '#94a3b8',
                                          background: 'rgba(255, 255, 255, 0.06)',
                                          border: '1px solid rgba(255, 255, 255, 0.08)',
                                          borderRadius: '4px',
                                          px: 0.8,
                                          py: 0.1,
                                        }}
                                      >
                                        L{idx + 3}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))}

                                {impactResult.transitive_dependents.length > 3 && (
                                  <Box
                                    onClick={() => setShowAllTransitive(!showAllTransitive)}
                                    sx={{
                                      cursor: 'pointer',
                                      py: 0.6,
                                      px: 1,
                                      color: '#ffd21f',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      '&:hover': { textDecoration: 'underline' },
                                    }}
                                  >
                                    {showAllTransitive
                                      ? 'Show fewer files'
                                      : `... ${impactResult.transitive_dependents.length - 3} more files`}
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {/* ─── Mode 2: Interactive SVG Graph View ────────────────── */}
                    {viewMode === 'graph' && (
                      <Box
                        sx={{
                          flex: 1,
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: '10px',
                          background: '#090a0f',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isPanning ? 'grabbing' : 'grab',
                        }}
                        onMouseDown={(e) => {
                          setIsPanning(true);
                          panStartRef.current = { x: e.clientX - graphPan.x, y: e.clientY - graphPan.y };
                        }}
                        onMouseMove={(e) => {
                          if (!isPanning) return;
                          setGraphPan({
                            x: e.clientX - panStartRef.current.x,
                            y: e.clientY - panStartRef.current.y,
                          });
                        }}
                        onMouseUp={() => setIsPanning(false)}
                        onMouseLeave={() => setIsPanning(false)}
                      >
                        {/* Zoom Controls */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            zIndex: 2,
                            background: 'rgba(18, 18, 24, 0.85)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            p: 0.3,
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => setGraphZoom((z) => Math.min(2, z + 0.15))}
                            sx={{ color: '#94a3b8', '&:hover': { color: '#ffd21f' }, p: 0.4 }}
                          >
                            <ZoomInIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setGraphZoom((z) => Math.max(0.5, z - 0.15))}
                            sx={{ color: '#94a3b8', '&:hover': { color: '#ffd21f' }, p: 0.4 }}
                          >
                            <ZoomOutIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setGraphZoom(1);
                              setGraphPan({ x: 0, y: 0 });
                            }}
                            sx={{ color: '#94a3b8', '&:hover': { color: '#ffd21f' }, p: 0.4 }}
                          >
                            <CenterFocusStrongIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </Box>

                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${graphData.width} ${graphData.height}`}
                          style={{
                            transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${graphZoom})`,
                            transformOrigin: 'center center',
                            transition: isPanning ? 'none' : 'transform 0.15s ease',
                          }}
                        >
                          <defs>
                            <marker
                              id="arrow-direct"
                              viewBox="0 0 10 10"
                              refX="22"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" opacity="0.8" />
                            </marker>
                            <marker
                              id="arrow-transitive"
                              viewBox="0 0 10 10"
                              refX="22"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" opacity="0.8" />
                            </marker>
                          </defs>

                          {/* Edges */}
                          {graphData.edges.map((edge, i) => {
                            const source = graphData.nodes.find((n) => n.id === edge.from);
                            const targetNode = graphData.nodes.find((n) => n.id === edge.to);
                            if (!source || !targetNode) return null;

                            const isDirect = edge.type === 'direct';
                            const strokeColor = isDirect ? 'rgba(56, 189, 248, 0.45)' : 'rgba(251, 191, 36, 0.35)';
                            const marker = isDirect ? 'url(#arrow-direct)' : 'url(#arrow-transitive)';

                            return (
                              <path
                                key={i}
                                d={`M ${source.x} ${source.y} Q ${(source.x + targetNode.x) / 2 + 15} ${
                                  (source.y + targetNode.y) / 2 - 15
                                }, ${targetNode.x} ${targetNode.y}`}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth={isDirect ? 1.8 : 1.2}
                                strokeDasharray={isDirect ? 'none' : '4 3'}
                                markerEnd={marker}
                              />
                            );
                          })}

                          {/* Nodes */}
                          {graphData.nodes.map((node) => {
                            const isTarget = node.type === 'target';
                            const isDirect = node.type === 'direct';

                            const fill = isTarget
                              ? '#ffd21f'
                              : isDirect
                              ? '#38bdf8'
                              : '#fbbf24';
                            const radius = isTarget ? 20 : 14;

                            return (
                              <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleDrillDown(node.id)}
                              >
                                {isTarget && (
                                  <circle
                                    r={radius + 8}
                                    fill="none"
                                    stroke="rgba(255, 210, 31, 0.3)"
                                    strokeWidth="2"
                                  />
                                )}
                                <circle
                                  r={radius}
                                  fill="#111218"
                                  stroke={fill}
                                  strokeWidth={isTarget ? 3 : 2}
                                />
                                <text
                                  textAnchor="middle"
                                  dy=".3em"
                                  fill={fill}
                                  fontSize={isTarget ? '10px' : '8px'}
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                >
                                  {isTarget ? 'TGT' : isDirect ? 'DIR' : 'TRN'}
                                </text>
                                <text
                                  textAnchor="middle"
                                  y={radius + 14}
                                  fill="#ffffff"
                                  fontSize="9.5px"
                                  fontFamily="monospace"
                                  fontWeight={isTarget ? 'bold' : 'normal'}
                                >
                                  {node.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </Box>
                    )}
                  </Card>
                </Grid>

                {/* ─── Right Column: Affected Files List ─────────────────────── */}
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Card
                    sx={{
                      background: '#111218',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      p: { xs: 2.5, sm: 3 },
                      height: '100%',
                      minHeight: 520,
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {/* Header: Title + Sort Dropdown */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2.5,
                        flexWrap: 'wrap',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
                        <LayersIcon sx={{ color: '#fbbf24', fontSize: '1.35rem' }} />
                        <Box>
                          <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                            Affected Files ({impactResult.summary.total_affected_files})
                          </Typography>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            Files that may be impacted by changes in {impactResult.target_file}.
                          </Typography>
                        </Box>
                      </Box>

                      {/* Sort Dropdown */}
                      <Select
                        size="small"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        sx={{
                          height: 34,
                          fontSize: '0.78rem',
                          color: '#cbd5e1',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          '& fieldset': { border: 'none' },
                          '& .MuiSelect-select': { py: 0.5, px: 1.2 },
                          '& .MuiSvgIcon-root': { color: '#94a3b8' },
                        }}
                      >
                        <MenuItem value="impact-desc">Sort by: Impact (High → Low)</MenuItem>
                        <MenuItem value="impact-asc">Sort by: Impact (Low → High)</MenuItem>
                        <MenuItem value="name-asc">Sort by: File Name (A → Z)</MenuItem>
                        <MenuItem value="depth-asc">Sort by: Dependency Depth</MenuItem>
                      </Select>
                    </Box>

                    {/* Affected Files Items List */}
                    <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, maxHeight: 440 }}>
                      {affectedFilesList.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                          <Typography sx={{ color: '#ffd21f', fontWeight: 700, fontSize: '0.95rem' }}>
                            No affected files
                          </Typography>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.825rem', mt: 0.5, mb: historyStack.length > 1 ? 2 : 0 }}>
                            This file is an isolated leaf node; modifying it will not cascade downstream.
                          </Typography>
                          {historyStack.length > 1 && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ArrowBackIcon sx={{ fontSize: '0.9rem' }} />}
                              onClick={handleResetToOriginal}
                              sx={{
                                color: '#ffd21f',
                                borderColor: 'rgba(255, 210, 31, 0.4)',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                borderRadius: '8px',
                                px: 2,
                                '&:hover': {
                                  borderColor: '#ffd21f',
                                  background: 'rgba(255, 210, 31, 0.1)',
                                },
                              }}
                            >
                              Return to Original Tree ({initialRootFile?.split('/').pop()})
                            </Button>
                          )}
                        </Box>
                      ) : (
                        affectedFilesList.map((item) => (
                          <Box
                            key={item.file_path}
                            onClick={() => handleDrillDown(item.file_path)}
                            sx={{
                              p: '12px 14px',
                              mb: 1.2,
                              borderRadius: '10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1.5,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                background: 'rgba(255, 255, 255, 0.04)',
                                borderColor: 'rgba(255, 210, 31, 0.3)',
                                transform: 'translateX(2px)',
                              },
                            }}
                          >
                            {/* Left: Blue file icon + path & description */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, minWidth: 0 }}>
                              <Box
                                sx={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '8px',
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#38bdf8',
                                  flexShrink: 0,
                                }}
                              >
                                <InsertDriveFileIcon sx={{ fontSize: '1.15rem' }} />
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: '0.84rem',
                                    color: '#ffffff',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {item.file_path}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontSize: '0.75rem',
                                    color: '#94a3b8',
                                    mt: 0.2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {item.description}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Right: Risk Level Badge (High / Medium / Low) */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                              <Chip
                                label={item.risk}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  background:
                                    item.risk === 'High'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : item.risk === 'Medium'
                                      ? 'rgba(245, 158, 11, 0.15)'
                                      : 'rgba(34, 197, 94, 0.15)',
                                  color:
                                    item.risk === 'High'
                                      ? '#f87171'
                                      : item.risk === 'Medium'
                                      ? '#fbbf24'
                                      : '#4ade80',
                                  border:
                                    item.risk === 'High'
                                      ? '1px solid rgba(239, 68, 68, 0.35)'
                                      : item.risk === 'Medium'
                                      ? '1px solid rgba(245, 158, 11, 0.35)'
                                      : '1px solid rgba(34, 197, 94, 0.35)',
                                  borderRadius: '6px',
                                  px: 0.5,
                                }}
                              />
                            </Box>
                          </Box>
                        ))
                      )}
                    </Box>
                  </Card>
                </Grid>
              </Grid>

              {/* ─── Card 3: AI Impact Summary & Action Plan ─────────────────── */}
              <Card
                sx={{
                  background: '#111218',
                  border: '1px solid rgba(255, 210, 31, 0.35)',
                  borderRadius: '16px',
                  p: { xs: 2.5, sm: 3 },
                  mb: 3,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45), 0 0 24px rgba(255, 210, 31, 0.05)',
                }}
              >
                {/* Header: Sparkles + Title + Grounded AI Badge */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 2 }}>
                  <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: '1.35rem' }} />
                  <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                    AI Impact Summary & Action Plan
                  </Typography>
                  <Chip
                    label="Grounded AI"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: 'rgba(255, 210, 31, 0.12)',
                      color: '#ffd21f',
                      border: '1px solid rgba(255, 210, 31, 0.3)',
                      borderRadius: '10px',
                    }}
                  />
                </Box>

                {/* Content: 2-column layout (Summary on left, Actions on right) */}
                <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
                  {/* Left Column: AI Grounded Narrative */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography
                      sx={{
                        fontSize: '0.9rem',
                        color: '#cbd5e1',
                        lineHeight: 1.65,
                      }}
                    >
                      {impactResult.ai_advisory?.available && impactResult.ai_advisory.insight
                        ? impactResult.ai_advisory.insight
                        : `Changing ${impactResult.target_file} has a ${impactResult.risk_assessment.level.toLowerCase()} impact, as it is directly used by ${
                            impactResult.summary.direct_dependent_count
                          } files and indirectly affects ${
                            impactResult.summary.transitive_dependent_count
                          } more through transitive dependencies.`}
                    </Typography>

                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mt: 1.5, fontStyle: 'italic' }}>
                      ⚖️ Risk scores are explainable heuristic estimates based on static graph metrics.
                    </Typography>
                  </Grid>

                  {/* Vertical Divider */}
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      display: { xs: 'none', md: 'block' },
                      mx: 1,
                    }}
                  />

                  {/* Right Column: Recommended Actions */}
                  <Grid size={{ xs: 12, md: 5.5 }}>
                    <Typography
                      sx={{
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        mb: 1.2,
                      }}
                    >
                      Recommended Actions
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9 }}>
                      {/* Action 1 */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#ffd21f',
                            mt: 0.8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          Review dependent files{' '}
                          {keyDirectFiles.length > 0 && (
                            <span>
                              (especially{' '}
                              <strong>
                                {keyDirectFiles
                                  .slice(0, 2)
                                  .map((f) => f.split('/').pop())
                                  .join(' and ')}
                              </strong>
                              )
                            </span>
                          )}
                          .
                        </Typography>
                      </Box>

                      {/* Action 2 */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#ffd21f',
                            mt: 0.8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          Run tests for product and admin workflows.
                        </Typography>
                      </Box>

                      {/* Action 3 */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#ffd21f',
                            mt: 0.8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {impactResult.target_file.includes('model')
                            ? 'Check database migrations if model fields are modified.'
                            : 'Verify exported interfaces and type signatures before committing.'}
                        </Typography>
                      </Box>

                      {/* Action 4 */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#ffd21f',
                            mt: 0.8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {impactResult.summary.total_affected_files >= 10
                            ? 'Consider a staged rollout if the change is large.'
                            : 'Ensure downstream consumers are aligned with signature changes.'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Card>

              {/* ─── Secondary Expandable: Analysis Details & Explainable Risk ─── */}
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setDetailsOpen(true)}
                  startIcon={<InfoOutlinedIcon sx={{ fontSize: '1rem', color: '#ffd21f' }} />}
                  sx={{
                    color: '#94a3b8',
                    textTransform: 'none',
                    fontSize: '0.825rem',
                    '&:hover': { color: '#ffd21f' },
                  }}
                >
                  View Explainable Risk Breakdown & Static Limitations ({impactResult.limitations.length})
                </Button>
              </Box>

              {/* ─── Modal Dialog: Explainable Risk & Static Limitations ─────── */}
              <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                maxWidth="md"
                fullWidth
                slotProps={{
                  paper: {
                    sx: {
                      background: '#111218',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      color: '#ffffff',
                      p: 1,
                    },
                  },
                }}
              >
                <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#ffd21f' }}>
                  Explainable Risk Assessment & Analysis Details
                </DialogTitle>
                <DialogContent dividers sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  {/* Risk Contributing Factors */}
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', mb: 1.2 }}>
                    Contributing Graph Factors:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                    {impactResult.risk_assessment.reasons.map((reason, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#ffd21f',
                            mt: 0.8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography sx={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{reason}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Factor Values Grid */}
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', mb: 1.2 }}>
                    Exact Heuristic Metrics:
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                      gap: 1.5,
                      p: 2,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      mb: 3,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>IN-DEGREE</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffd21f' }}>
                        {impactResult.risk_assessment.factors.in_degree_centrality}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>BLAST RADIUS</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {(impactResult.risk_assessment.factors.blast_radius_ratio * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>MAX DEPTH</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {impactResult.risk_assessment.factors.max_dependency_depth}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>CYCLES DETECTED</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {impactResult.risk_assessment.factors.cycles_detected_count}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Static Analysis Limitations */}
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', mb: 1.2 }}>
                    Static Analysis Scope & Limitations:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    {impactResult.limitations.map((lim, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                        <InfoOutlinedIcon sx={{ fontSize: '1rem', color: '#ffd21f', mt: 0.3 }} />
                        <Typography sx={{ fontSize: '0.825rem', color: '#cbd5e1' }}>{lim}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Cycles detected if any */}
                  {impactResult.cycles_detected && impactResult.cycles_detected.length > 0 && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        mt: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LoopIcon sx={{ color: '#f87171', fontSize: '1.2rem' }} />
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>
                          Circular Dependencies ({impactResult.cycles_detected.length})
                        </Typography>
                      </Box>
                      {impactResult.cycles_detected.map((cycle, i) => (
                        <Typography key={i} sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                          {cycle.join(' ➔ ')}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                  <Button
                    onClick={() => setDetailsOpen(false)}
                    variant="contained"
                    sx={{
                      background: '#ffd21f',
                      color: '#050505',
                      fontWeight: 700,
                      textTransform: 'none',
                      '&:hover': { background: '#ffe033' },
                    }}
                  >
                    Close
                  </Button>
                </DialogActions>
              </Dialog>
            </Box>
          )}
        </Container>
      </Box>
    </DashboardLayout>
  );
};

export default ImpactAnalysis;
