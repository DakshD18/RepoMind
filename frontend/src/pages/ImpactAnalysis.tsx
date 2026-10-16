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
  Divider,
  Autocomplete,
  TextField,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TableViewIcon from '@mui/icons-material/TableView';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RouteIcon from '@mui/icons-material/Route';
import LoopIcon from '@mui/icons-material/Loop';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import { getDashboardRepository, getImpactFiles, analyzeImpact } from '../services/api';
import type {
  Repository,
  ImpactFilesResponse,
  ImpactAnalysisResponse,
  DependencyTreeNode,
} from '../types';

export const ImpactAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [repo, setRepo] = useState<Repository | null>(null);
  const [filesData, setFilesData] = useState<ImpactFilesResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [impactResult, setImpactResult] = useState<ImpactAnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Load repo metadata & analyzable files
  useEffect(() => {
    if (!id) return;

    const loadInitialData = async () => {
      setLoadingFiles(true);
      try {
        const repoData = await getDashboardRepository(Number(id));
        setRepo(repoData);

        const files = await getImpactFiles(id);
        setFilesData(files);

        // Preselect the first suggested file or first file
        if (files.suggested_files && files.suggested_files.length > 0) {
          setSelectedFile(files.suggested_files[0]);
        } else if (files.files && files.files.length > 0) {
          setSelectedFile(files.files[0]);
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
  const handleAnalyze = async (filePathToAnalyze?: string, forceRebuild = false) => {
    const target = filePathToAnalyze || selectedFile;
    if (!id || !target) {
      toast.error('Please choose or enter a file to analyze.');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeImpact(id, target, forceRebuild);
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

  const handleCopyPath = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('File path copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const riskBadgeConfig = useMemo(() => {
    if (!impactResult) return null;
    const level = impactResult.risk_assessment.level;
    switch (level) {
      case 'HIGH':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          color: '#f87171',
          gradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          icon: <WarningAmberIcon sx={{ color: '#f87171', fontSize: '1.2rem' }} />,
        };
      case 'MEDIUM':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          color: '#fbbf24',
          gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          icon: <WarningAmberIcon sx={{ color: '#fbbf24', fontSize: '1.2rem' }} />,
        };
      case 'LOW':
      default:
        return {
          bg: 'rgba(255, 210, 31, 0.12)',
          border: '1px solid rgba(255, 210, 31, 0.4)',
          color: '#ffd21f',
          gradient: 'linear-gradient(135deg, #ffd21f 0%, #d97706 100%)',
          icon: <CheckCircleIcon sx={{ color: '#ffd21f', fontSize: '1.2rem' }} />,
        };
    }
  }, [impactResult]);

  // Recursive Tree Component
  const renderTree = (node: DependencyTreeNode, depth = 0) => {
    const isRoot = depth === 0;

    return (
      <Box
        key={`${node.file_path}-${depth}`}
        sx={{
          ml: isRoot ? 0 : 3.5,
          pl: isRoot ? 0 : 2,
          borderLeft: isRoot ? 'none' : '1px dashed rgba(255, 210, 31, 0.25)',
          position: 'relative',
          my: 1.2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.4,
            borderRadius: '10px',
            background: isRoot ? 'rgba(255, 210, 31, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            border: isRoot ? '1px solid rgba(255, 210, 31, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.06)',
              borderColor: 'rgba(255, 210, 31, 0.3)',
            },
          }}
        >
          <InsertDriveFileIcon sx={{ fontSize: '1.1rem', color: isRoot ? '#ffd21f' : '#94a3b8' }} />

          <Typography
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              fontWeight: isRoot ? 700 : 500,
              color: isRoot ? '#ffd21f' : '#e2e8f0',
            }}
          >
            {node.file_path}
          </Typography>

          {node.relationship_type && (
            <Chip
              label={node.relationship_type.replace('_', ' ')}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                textTransform: 'uppercase',
              }}
            />
          )}

          {node.imported_symbols && node.imported_symbols.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap', ml: 'auto' }}>
              {node.imported_symbols.slice(0, 3).map((sym) => (
                <Chip
                  key={sym}
                  label={sym}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontFamily: 'monospace',
                    borderColor: 'rgba(255, 210, 31, 0.3)',
                    color: '#fef08a',
                  }}
                />
              ))}
              {node.imported_symbols.length > 3 && (
                <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', alignSelf: 'center' }}>
                  +{node.imported_symbols.length - 3} more
                </Typography>
              )}
            </Box>
          )}

          {isRoot && (
            <Chip
              label="TARGET FILE"
              size="small"
              sx={{
                ml: 'auto',
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 800,
                background: '#ffd21f',
                color: '#050505',
                letterSpacing: '0.5px',
              }}
            />
          )}
        </Box>

        {node.children && node.children.length > 0 && (
          <Box sx={{ mt: 0.8 }}>
            {node.children.map((child) => renderTree(child, depth + 1))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <DashboardLayout>
      <Box sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        <Container maxWidth="xl" disableGutters>
          {/* Header & Back Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={() => navigate(`/repository/${id}`)}
                sx={{
                  color: '#94a3b8',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { borderColor: '#ffd21f', color: '#ffd21f' },
                }}
              >
                Back to Overview
              </Button>

              {repo && (
                <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  / <strong style={{ color: '#fff' }}>{repo.owner}/{repo.name}</strong>
                </Typography>
              )}
            </Box>

            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={() => handleAnalyze(selectedFile, true)}
              disabled={analyzing || loadingFiles}
              sx={{
                color: '#ffd21f',
                borderColor: 'rgba(255, 210, 31, 0.3)',
                '&:hover': { borderColor: '#ffd21f', background: 'rgba(255, 210, 31, 0.08)' },
              }}
            >
              Rebuild Graph
            </Button>
          </Box>

          {/* Hero Banner */}
          <Card
            sx={{
              background: 'rgba(18, 18, 24, 0.75)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              p: { xs: 2.5, sm: 3.5 },
              mb: 4,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.8 }}>
                  <Box
                    sx={{
                      p: 0.7,
                      borderRadius: '8px',
                      background: 'rgba(255, 210, 31, 0.12)',
                      color: '#ffd21f',
                      display: 'flex',
                    }}
                  >
                    <FlashOnIcon />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                    Impact Analysis Engine
                  </Typography>
                  <Chip
                    label="PHASE 4"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: 'rgba(255, 210, 31, 0.15)',
                      color: '#ffd21f',
                      border: '1px solid rgba(255, 210, 31, 0.3)',
                    }}
                  />
                </Box>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: 820 }}>
                  Determine downstream ramifications before changing code: inspect direct and transitive dependents,
                  evaluate cascading blast radius, and explore transparent risk scoring.
                </Typography>
              </Box>
            </Box>

            {/* File Search & Quick Selector */}
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, md: 9 }}>
                  <Autocomplete
                    freeSolo
                    options={filesData?.files || []}
                    value={selectedFile}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        setSelectedFile(newValue);
                        handleAnalyze(newValue);
                      }
                    }}
                    onInputChange={(_, newInputValue) => {
                      setSelectedFile(newInputValue);
                    }}
                    loading={loadingFiles}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select or type repository file to evaluate impact"
                        placeholder="e.g. backend/api/models.py or src/App.tsx"
                        variant="outlined"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(10, 10, 14, 0.8)',
                            borderRadius: '12px',
                            color: '#ffffff',
                            fontFamily: 'monospace',
                            '& fieldset': {
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                            },
                            '&:hover fieldset': {
                              borderColor: 'rgba(255, 210, 31, 0.4)',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#ffd21f',
                            },
                          },
                          '& .MuiInputLabel-root': {
                            color: '#94a3b8',
                          },
                        }}
                      />
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={() => handleAnalyze()}
                    disabled={analyzing || !selectedFile}
                    startIcon={analyzing ? <CircularProgress size={20} color="inherit" /> : <FlashOnIcon />}
                    sx={{
                      height: 54,
                      borderRadius: '12px',
                      background: '#ffd21f',
                      color: '#050505',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      '&:hover': { background: '#ffe033' },
                    }}
                  >
                    {analyzing ? 'Analyzing Impact...' : 'Analyze Impact'}
                  </Button>
                </Grid>
              </Grid>

              {/* Suggested Hub Modules */}
              {filesData && filesData.suggested_files && filesData.suggested_files.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                    Suggested Hub Modules:
                  </Typography>
                  {filesData.suggested_files.map((file) => (
                    <Chip
                      key={file}
                      label={file}
                      size="small"
                      clickable
                      onClick={() => {
                        setSelectedFile(file);
                        handleAnalyze(file);
                      }}
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        background: selectedFile === file ? 'rgba(255, 210, 31, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: selectedFile === file ? '1px solid #ffd21f' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: selectedFile === file ? '#ffd21f' : '#cbd5e1',
                        '&:hover': {
                          borderColor: '#ffd21f',
                          background: 'rgba(255, 210, 31, 0.1)',
                        },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Card>

          {/* Analysis Results View */}
          {impactResult && riskBadgeConfig && (
            <Box sx={{ mb: 6 }}>
              {/* Target File Overview & Risk Banner */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* File Details Card */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Card
                    sx={{
                      background: 'rgba(18, 18, 24, 0.7)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      p: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Chip
                          label={impactResult.target_metadata.language.toUpperCase()}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            background: 'rgba(255, 210, 31, 0.1)',
                            color: '#ffd21f',
                            border: '1px solid rgba(255, 210, 31, 0.3)',
                          }}
                        />
                        <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {impactResult.target_metadata.line_count} lines
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            wordBreak: 'break-all',
                          }}
                        >
                          {impactResult.target_file}
                        </Typography>
                        <Tooltip title={copied ? 'Copied!' : 'Copy Path'}>
                          <IconButton size="small" onClick={() => handleCopyPath(impactResult.target_file)}>
                            <ContentCopyIcon sx={{ fontSize: '0.9rem', color: '#94a3b8' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {impactResult.target_metadata.defined_symbols.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', mb: 1 }}>
                            DEFINED SYMBOLS:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, maxHeight: 100, overflowY: 'auto' }}>
                            {impactResult.target_metadata.defined_symbols.map((sym) => (
                              <Chip
                                key={sym}
                                label={sym}
                                size="small"
                                sx={{
                                  fontSize: '0.7rem',
                                  fontFamily: 'monospace',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: '#e2e8f0',
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {/* Blast Radius Summary Metrics */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mt: 3, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>DIRECT</Typography>
                        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffd21f' }}>
                          {impactResult.summary.direct_dependent_count}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>TRANSITIVE</Typography>
                        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#cbd5e1' }}>
                          {impactResult.summary.transitive_dependent_count}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>MAX DEPTH</Typography>
                        <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#cbd5e1' }}>
                          {impactResult.summary.max_depth}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                </Grid>

                {/* Risk Assessment Card */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Card
                    sx={{
                      background: 'rgba(18, 18, 24, 0.7)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '16px',
                      p: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {riskBadgeConfig.icon}
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#94a3b8' }}>
                            Explainable Risk Assessment
                          </Typography>
                        </Box>

                        <Chip
                          label={`${impactResult.risk_assessment.level} RISK (${impactResult.risk_assessment.score}/100)`}
                          sx={{
                            background: riskBadgeConfig.bg,
                            border: riskBadgeConfig.border,
                            color: riskBadgeConfig.color,
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            letterSpacing: '0.5px',
                          }}
                        />
                      </Box>

                      {/* Reasons Breakdown */}
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', mb: 1 }}>
                        Contributing Graph Factors:
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
                        {impactResult.risk_assessment.reasons.map((reason, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#ffd21f', mt: 0.8, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                              {reason}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    {/* Disclaimer Note */}
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        ⚖️ {impactResult.risk_assessment.disclaimer}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              </Grid>

              {/* AI-Inferred Runtime Advisory (Optional Gemini) */}
              {impactResult.ai_advisory && impactResult.ai_advisory.available && impactResult.ai_advisory.insight && (
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, rgba(255, 210, 31, 0.05) 0%, rgba(20, 20, 28, 0.8) 100%)',
                    border: '1px solid rgba(255, 210, 31, 0.3)',
                    borderRadius: '16px',
                    p: 2.5,
                    mb: 3.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: '1.2rem' }} />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffd21f', letterSpacing: '0.5px' }}>
                        AI RUNTIME ADVISORY
                      </Typography>
                    </Box>
                    <Chip
                      label="INFERRED ADVISORY"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        background: 'rgba(255, 210, 31, 0.1)',
                        color: '#ffd21f',
                        border: '1px solid rgba(255, 210, 31, 0.25)',
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.5, mb: 1 }}>
                    {impactResult.ai_advisory.insight}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Note: {impactResult.ai_advisory.disclaimer}
                  </Typography>
                </Card>
              )}

              {/* Tabs for Tree View, Table View, and Graph Details */}
              <Card
                sx={{
                  background: 'rgba(18, 18, 24, 0.75)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '18px',
                  overflow: 'hidden',
                }}
              >
                <Tabs
                  value={activeTab}
                  onChange={(_, val) => setActiveTab(val)}
                  sx={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    px: 2,
                    '& .MuiTab-root': {
                      color: '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      minHeight: 52,
                      '&.Mui-selected': {
                        color: '#ffd21f',
                      },
                    },
                    '& .MuiTabs-indicator': {
                      backgroundColor: '#ffd21f',
                      height: 3,
                    },
                  }}
                >
                  <Tab icon={<AccountTreeIcon sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Dependency Tree" />
                  <Tab icon={<TableViewIcon sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label={`Affected Files (${impactResult.summary.total_affected_files})`} />
                  <Tab icon={<InfoOutlinedIcon sx={{ fontSize: '1.1rem' }} />} iconPosition="start" label="Analysis Details & Limitations" />
                </Tabs>

                {/* Tab 0: Dependency Tree */}
                {activeTab === 0 && (
                  <Box sx={{ p: 3 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', mb: 2 }}>
                      Hierarchical visualization of cascading dependencies starting from <strong>{impactResult.target_file}</strong>.
                    </Typography>
                    {impactResult.summary.total_affected_files === 0 ? (
                      <Alert severity="info" sx={{ background: 'rgba(255, 210, 31, 0.08)', color: '#ffd21f', border: '1px solid rgba(255, 210, 31, 0.2)' }}>
                        No files in the repository depend on this file. It is a leaf module; modifications are unlikely to affect other files.
                      </Alert>
                    ) : (
                      <Box sx={{ maxHeight: 600, overflowY: 'auto', p: 1 }}>
                        {renderTree(impactResult.dependency_tree)}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Tab 1: Detailed Tables */}
                {activeTab === 1 && (
                  <Box sx={{ p: 3 }}>
                    {/* Direct Dependents */}
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', mb: 1.5 }}>
                      Direct Dependents ({impactResult.direct_dependents.length})
                    </Typography>
                    {impactResult.direct_dependents.length === 0 ? (
                      <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8', mb: 3 }}>
                        No direct dependents found.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 4 }}>
                        {impactResult.direct_dependents.map((dep) => (
                          <Box
                            key={dep.file_path}
                            sx={{
                              p: 1.8,
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 1.5,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <InsertDriveFileIcon sx={{ color: '#ffd21f', fontSize: '1.2rem' }} />
                              <Box>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                                  {dep.file_path}
                                </Typography>
                                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  Line {dep.line_number} • {dep.relationship_type.replace('_', ' ')}
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                              {dep.imported_symbols.map((sym) => (
                                <Chip
                                  key={sym}
                                  label={sym}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace',
                                    background: 'rgba(255, 210, 31, 0.12)',
                                    color: '#ffd21f',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}

                    <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

                    {/* Transitive Dependents */}
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', mb: 1.5 }}>
                      Transitive Dependents ({impactResult.transitive_dependents.length})
                    </Typography>
                    {impactResult.transitive_dependents.length === 0 ? (
                      <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        No transitive dependents found.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                        {impactResult.transitive_dependents.map((dep) => (
                          <Box
                            key={dep.file_path}
                            sx={{
                              p: 1.8,
                              borderRadius: '12px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <RouteIcon sx={{ color: '#94a3b8', fontSize: '1.2rem' }} />
                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                                  {dep.file_path}
                                </Typography>
                              </Box>
                              <Chip
                                label={`DEPTH ${dep.depth}`}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  color: '#cbd5e1',
                                }}
                              />
                            </Box>

                            {/* Dependency Path Breadcrumbs */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mt: 0.8 }}>
                              <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>PATH:</Typography>
                              {dep.dependency_path.map((step, idx) => (
                                <React.Fragment key={idx}>
                                  <Typography
                                    sx={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      color: idx === dep.dependency_path.length - 1 ? '#ffd21f' : '#cbd5e1',
                                      fontWeight: idx === dep.dependency_path.length - 1 ? 700 : 400,
                                    }}
                                  >
                                    {step}
                                  </Typography>
                                  {idx < dep.dependency_path.length - 1 && (
                                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>➔</Typography>
                                  )}
                                </React.Fragment>
                              ))}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Tab 2: Limitations & Details */}
                {activeTab === 2 && (
                  <Box sx={{ p: 3 }}>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', mb: 1.5 }}>
                      Analysis Scope & Static Limitations
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, mb: 3 }}>
                      {impactResult.limitations.map((lim, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
                          <InfoOutlinedIcon sx={{ fontSize: '1rem', color: '#ffd21f', mt: 0.3 }} />
                          <Typography sx={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                            {lim}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {impactResult.cycles_detected.length > 0 && (
                      <Box sx={{ mt: 3, p: 2, borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <LoopIcon sx={{ color: '#f87171' }} />
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>
                            Circular Dependencies Detected ({impactResult.cycles_detected.length})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                          {impactResult.cycles_detected.map((cycle, idx) => (
                            <Typography key={idx} sx={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                              {cycle.join(' ➔ ')}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </Card>
            </Box>
          )}
        </Container>
      </Box>
    </DashboardLayout>
  );
};

export default ImpactAnalysis;
