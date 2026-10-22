import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Chip,
  Button,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  MenuItem,
  Select,
  FormControl,
  Collapse,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getArchitectureOverview,
  getArchitectureTree,
  getArchitectureGraph,
  getArchitectureNodeDetail,
  getArchitectureFindings,
} from '../services/api';

import type {
  ArchitectureOverview as IArchitectureOverview,
  ArchitectureTreeNode,
  ArchitectureGraphNode,
  ArchitectureGraphResponse,
  ArchitectureNodeDetail as IArchitectureNodeDetail,
  ArchitectureFindingsResponse,
} from '../types';

// ─── Visual Theme Helpers ────────────────────────────────────────────────────

const COMPONENT_TYPE_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  entry_point: { label: 'Entry Point', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
  route: { label: 'Route / API', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  model: { label: 'Model', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  service: { label: 'Service', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
  component: { label: 'Component', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  config: { label: 'Config', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
  test: { label: 'Test', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  file: { label: 'File', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
};

const getLanguageBadge = (lang?: string) => {
  const l = (lang || '').toLowerCase();
  if (l.includes('python')) return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' };
  if (l.includes('typescript')) return { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)' };
  if (l.includes('javascript')) return { color: '#ffd21f', bg: 'rgba(255, 210, 31, 0.12)' };
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' };
};

// ─── Hierarchical Tree Item Component ───────────────────────────────────────

interface TreeItemProps {
  node: ArchitectureTreeNode;
  depth?: number;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  expandAll: boolean;
  collapseAll: boolean;
}

const ArchitectureTreeItem: React.FC<TreeItemProps> = ({
  node,
  depth = 0,
  selectedFile,
  onSelectFile,
  expandAll,
  collapseAll,
}) => {
  const [open, setOpen] = useState<boolean>(depth === 0);

  useEffect(() => {
    if (expandAll) setOpen(true);
    if (collapseAll) setOpen(false);
  }, [expandAll, collapseAll]);

  if (node.type === 'directory') {
    return (
      <Box sx={{ userSelect: 'none' }}>
        <Box
          onClick={() => setOpen(!open)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.6,
            px: 1,
            pl: depth * 1.8 + 1,
            borderRadius: 1,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.04)',
            },
          }}
        >
          <IconButton
            size="small"
            sx={{ p: 0.2, mr: 0.5, color: '#64748b' }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? (
              <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>

          {open ? (
            <FolderOpenIcon sx={{ fontSize: 16, color: '#ffd21f', mr: 1 }} />
          ) : (
            <FolderIcon sx={{ fontSize: 16, color: '#f59e0b', mr: 1 }} />
          )}

          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              fontSize: '0.8rem',
              color: '#e2e8f0',
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </Typography>

          {node.file_count !== undefined && (
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.65rem',
                color: '#64748b',
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                px: 0.6,
                py: 0.1,
                borderRadius: 0.8,
              }}
            >
              {node.file_count}
            </Typography>
          )}
        </Box>

        <Collapse in={open} timeout="auto" unmountOnExit>
          {node.children &&
            node.children.map((child) => (
              <ArchitectureTreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                expandAll={expandAll}
                collapseAll={collapseAll}
              />
            ))}
        </Collapse>
      </Box>
    );
  }

  // File node
  const isSelected = selectedFile === node.path;
  const ctypeStyle = COMPONENT_TYPE_COLORS[node.component_type || 'file'] || COMPONENT_TYPE_COLORS.file;
  const langBadge = getLanguageBadge(node.language);

  return (
    <Box
      onClick={() => onSelectFile(node.path)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 0.5,
        px: 1,
        pl: depth * 1.8 + 2.5,
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: isSelected ? 'rgba(255, 210, 31, 0.14)' : 'transparent',
        borderLeft: isSelected ? '2px solid #ffd21f' : '2px solid transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: isSelected ? 'rgba(255, 210, 31, 0.2)' : 'rgba(255, 255, 255, 0.03)',
        },
      }}
    >
      <InsertDriveFileIcon sx={{ fontSize: 15, color: langBadge.color, mr: 1, flexShrink: 0 }} />

      <Typography
        variant="body2"
        sx={{
          fontSize: '0.78rem',
          color: isSelected ? '#ffd21f' : '#cbd5e1',
          fontWeight: isSelected ? 600 : 400,
          flexGrow: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {node.name}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {node.is_circular && (
          <Tooltip title="Circular dependency detected" arrow>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#ef4444',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)',
              }}
            />
          </Tooltip>
        )}

        {node.has_unresolved && (
          <Tooltip title="Unresolved internal import" arrow>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#f59e0b',
              }}
            />
          </Tooltip>
        )}

        <Chip
          label={ctypeStyle.label}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.62rem',
            color: ctypeStyle.color,
            bgcolor: ctypeStyle.bg,
            border: `1px solid ${ctypeStyle.color}33`,
            fontWeight: 500,
          }}
        />
      </Box>
    </Box>
  );
};

// ─── Main Architecture Explorer Page ────────────────────────────────────────

export const ArchitectureExplorer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Primary State
  const [overview, setOverview] = useState<IArchitectureOverview | null>(null);
  const [treeData, setTreeData] = useState<ArchitectureTreeNode[]>([]);
  const [graphData, setGraphData] = useState<ArchitectureGraphResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<IArchitectureNodeDetail | null>(null);
  const [findings, setFindings] = useState<ArchitectureFindingsResponse | null>(null);

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Filters & Controls
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [graphSearch, setGraphSearch] = useState<string>('');
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('all');
  const [relationshipTypeFilter, setRelationshipTypeFilter] = useState<string>('all');
  const [graphLimit, setGraphLimit] = useState<number>(80);
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Component Details, 1 = Architecture Findings
  const [expandAllTree, setExpandAllTree] = useState<boolean>(false);
  const [collapseAllTree, setCollapseAllTree] = useState<boolean>(false);

  // SVG Pan & Zoom Canvas State
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ─── Initial Data Loading ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoadingInitial(true);
    try {
      const [overviewRes, treeRes, findingsRes] = await Promise.all([
        getArchitectureOverview(id),
        getArchitectureTree(id),
        getArchitectureFindings(id),
      ]);

      setOverview(overviewRes);
      setTreeData(treeRes.tree);
      setFindings(findingsRes);

      // Auto-select first circular file or first file
      if (findingsRes.circular_dependencies && findingsRes.circular_dependencies.length > 0) {
        setSelectedFile(findingsRes.circular_dependencies[0].cycle[0]);
      } else if (treeRes.tree.length > 0) {
        const findFirstFile = (nodes: ArchitectureTreeNode[]): string | null => {
          for (const n of nodes) {
            if (n.type === 'file') return n.path;
            if (n.children) {
              const res = findFirstFile(n.children);
              if (res) return res;
            }
          }
          return null;
        };
        const first = findFirstFile(treeRes.tree);
        if (first) setSelectedFile(first);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load architecture data.');
    } finally {
      setLoadingInitial(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Load Graph Data when Filters Change ───────────────────────────────────

  const fetchGraph = useCallback(async () => {
    if (!id) return;
    setLoadingGraph(true);
    try {
      const res = await getArchitectureGraph(id, {
        search: graphSearch || undefined,
        component_type: componentTypeFilter !== 'all' ? componentTypeFilter : undefined,
        relationship_type: relationshipTypeFilter !== 'all' ? relationshipTypeFilter : undefined,
        focus: selectedFile || undefined,
        limit: graphLimit,
      });
      setGraphData(res);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update architecture graph.');
    } finally {
      setLoadingGraph(false);
    }
  }, [id, graphSearch, componentTypeFilter, relationshipTypeFilter, selectedFile, graphLimit]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // ─── Load Component Details when Selected File Changes ─────────────────────

  useEffect(() => {
    if (!id || !selectedFile) {
      setNodeDetail(null);
      return;
    }
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await getArchitectureNodeDetail(id, selectedFile);
        setNodeDetail(res);
      } catch {
        // If file not found or error, clear detail
        setNodeDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [id, selectedFile]);

  // ─── Tree Search Query Handler ─────────────────────────────────────────────

  const handleTreeSearchChange = async (query: string) => {
    setTreeSearch(query);
    if (!id) return;
    try {
      const res = await getArchitectureTree(id, query);
      setTreeData(res.tree);
    } catch {
      // ignore transient search errors
    }
  };

  // ─── Layout Simulation for Graph Nodes ─────────────────────────────────────

  const graphLayout = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) {
      return { positions: {}, modules: {}, width: 1000, height: 700 };
    }

    const nodes = graphData.nodes;
    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const modules: Record<string, { x: number; y: number; width: number; height: number; name: string }> = {};

    // Group nodes by module
    const moduleGroups: Record<string, ArchitectureGraphNode[]> = {};
    nodes.forEach((n) => {
      const mod = n.module || 'root';
      if (!moduleGroups[mod]) moduleGroups[mod] = [];
      moduleGroups[mod].push(n);
    });

    const moduleKeys = Object.keys(moduleGroups).sort();
    const cols = Math.max(1, Math.ceil(Math.sqrt(moduleKeys.length * 1.5)));
    const modPadding = 40;
    const nodeWidth = 190;
    const nodeHeight = 54;
    const nodeGapX = 24;
    const nodeGapY = 18;

    let currentModX = 60;
    let currentModY = 60;
    let maxRowHeight = 0;
    let canvasMaxWidth = 1000;
    let canvasMaxHeight = 700;

    moduleKeys.forEach((modKey, idx) => {
      const groupNodes = moduleGroups[modKey];
      const innerCols = Math.min(3, Math.ceil(Math.sqrt(groupNodes.length)));
      const innerRows = Math.ceil(groupNodes.length / innerCols);

      const modWidth = innerCols * (nodeWidth + nodeGapX) - nodeGapX + modPadding * 2;
      const modHeight = innerRows * (nodeHeight + nodeGapY) - nodeGapY + modPadding * 2 + 20;

      if (idx > 0 && idx % cols === 0) {
        currentModX = 60;
        currentModY += maxRowHeight + 50;
        maxRowHeight = 0;
      }

      modules[modKey] = {
        x: currentModX,
        y: currentModY,
        width: modWidth,
        height: modHeight,
        name: modKey,
      };

      groupNodes.forEach((node, nodeIdx) => {
        const c = nodeIdx % innerCols;
        const r = Math.floor(nodeIdx / innerCols);
        const nx = currentModX + modPadding + c * (nodeWidth + nodeGapX);
        const ny = currentModY + modPadding + 20 + r * (nodeHeight + nodeGapY);

        positions[node.id] = {
          x: nx,
          y: ny,
          width: nodeWidth,
          height: nodeHeight,
        };
      });

      maxRowHeight = Math.max(maxRowHeight, modHeight);
      currentModX += modWidth + 50;
      canvasMaxWidth = Math.max(canvasMaxWidth, currentModX + 200);
      canvasMaxHeight = Math.max(canvasMaxHeight, currentModY + maxRowHeight + 100);
    });

    return { positions, modules, width: canvasMaxWidth, height: canvasMaxHeight };
  }, [graphData]);

  // ─── SVG Interactive Canvas Event Handlers ─────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 3.0));
  };

  const handleResetCanvas = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.3));

  // ─── Loading Screen ────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <DashboardLayout>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '75vh',
            gap: 2,
          }}
        >
          <CircularProgress sx={{ color: '#ffd21f' }} size={48} thickness={4} />
          <Typography variant="body1" sx={{ color: '#94a3b8', fontWeight: 500 }}>
            Analyzing repository architecture & dependency map...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  // ─── Empty Repository State ────────────────────────────────────────────────

  if (!overview || overview.total_files === 0) {
    return (
      <DashboardLayout>
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
          <Card
            sx={{
              p: 6,
              bgcolor: '#121218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 64, color: '#64748b', mb: 2 }} />
            <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 600, mb: 1 }}>
              No Analyzable Architecture Found
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 3 }}>
              This repository does not contain supported code files (Python, TypeScript, JavaScript)
              or the files are not available locally.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate(`/repository/${id}`)}
              sx={{
                bgcolor: '#ffd21f',
                color: '#09090d',
                fontWeight: 600,
                '&:hover': { bgcolor: '#e6bd19' },
              }}
            >
              Return to Repository Overview
            </Button>
          </Card>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 72px)',
          bgcolor: '#09090d',
          overflow: 'hidden',
        }}
      >
        {/* ─── Top Control & Metrics Bar ───────────────────────────────────── */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: '#0d0d14',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {/* Left Title & Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: 'rgba(255, 210, 31, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 210, 31, 0.3)',
              }}
            >
              <AccountTreeIcon sx={{ color: '#ffd21f', fontSize: 20 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.05rem' }}>
                  Architecture Intelligence
                </Typography>
                <Chip
                  label={`${overview.total_files} files`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: '#94a3b8',
                  }}
                />
                <Chip
                  label={`${overview.total_dependencies} dependencies`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    bgcolor: 'rgba(6, 182, 212, 0.1)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                  }}
                />
                {overview.circular_cycles_count > 0 && (
                  <Chip
                    icon={<WarningAmberIcon sx={{ fontSize: '13px !important', color: '#f59e0b' }} />}
                    label={`${overview.circular_cycles_count} cycles`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.68rem',
                      bgcolor: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          {/* Right Controls: Filters & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Search graph */}
            <TextField
              size="small"
              placeholder="Search components in graph..."
              value={graphSearch}
              onChange={(e) => setGraphSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#64748b', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                  endAdornment: graphSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setGraphSearch('')}>
                        <ClearIcon sx={{ color: '#64748b', fontSize: 16 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{
                width: 210,
                '& .MuiInputBase-root': {
                  height: 32,
                  fontSize: '0.8rem',
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#e2e8f0',
                  borderRadius: 1,
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 210, 31, 0.3)' },
                },
              }}
            />

            {/* Component Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={componentTypeFilter}
                onChange={(e) => setComponentTypeFilter(e.target.value)}
                sx={{
                  height: 32,
                  fontSize: '0.78rem',
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#e2e8f0',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="service">Services</MenuItem>
                <MenuItem value="component">Components</MenuItem>
                <MenuItem value="model">Models</MenuItem>
                <MenuItem value="route">Routes / Views</MenuItem>
                <MenuItem value="entry_point">Entry Points</MenuItem>
                <MenuItem value="config">Configs</MenuItem>
              </Select>
            </FormControl>

            {/* Relationship Filter */}
            <FormControl size="small" sx={{ minWidth: 135 }}>
              <Select
                value={relationshipTypeFilter}
                onChange={(e) => setRelationshipTypeFilter(e.target.value)}
                sx={{
                  height: 32,
                  fontSize: '0.78rem',
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#e2e8f0',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                <MenuItem value="all">All Dependencies</MenuItem>
                <MenuItem value="imports_module">Module Imports</MenuItem>
                <MenuItem value="imports_symbol">Symbol Imports</MenuItem>
                <MenuItem value="calls_function">Function Calls</MenuItem>
              </Select>
            </FormControl>

            {/* Graph Node Limit */}
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={graphLimit}
                onChange={(e) => setGraphLimit(Number(e.target.value))}
                sx={{
                  height: 32,
                  fontSize: '0.78rem',
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#e2e8f0',
                  borderRadius: 1,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                <MenuItem value={40}>Top 40</MenuItem>
                <MenuItem value={80}>Top 80</MenuItem>
                <MenuItem value={150}>Top 150</MenuItem>
                <MenuItem value={300}>All (300 max)</MenuItem>
              </Select>
            </FormControl>

            {/* Refresh */}
            <Tooltip title="Refresh Graph Data">
              <IconButton
                size="small"
                onClick={fetchGraph}
                disabled={loadingGraph}
                sx={{
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  '&:hover': { color: '#ffd21f', borderColor: '#ffd21f' },
                }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ─── Main 3-Pane Explorer Layout ─────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* ─────────────────────────────────────────────────────────────────
              1. LEFT PANE: Repository File & Folder Tree
          ───────────────────────────────────────────────────────────────── */}
          <Box
            sx={{
              width: 310,
              minWidth: 260,
              maxWidth: 380,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              bgcolor: '#0b0b12',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Tree Header & Search */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
                >
                  Repository Explorer
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Expand All">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setExpandAllTree(true);
                        setCollapseAllTree(false);
                      }}
                      sx={{ p: 0.3, color: '#64748b' }}
                    >
                      <UnfoldMoreIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Collapse All">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setCollapseAllTree(true);
                        setExpandAllTree(false);
                      }}
                      sx={{ p: 0.3, color: '#64748b' }}
                    >
                      <UnfoldLessIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <TextField
                size="small"
                fullWidth
                placeholder="Search files or paths..."
                value={treeSearch}
                onChange={(e) => handleTreeSearchChange(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#64748b', fontSize: 16 }} />
                      </InputAdornment>
                    ),
                    endAdornment: treeSearch ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => handleTreeSearchChange('')}>
                          <ClearIcon sx={{ color: '#64748b', fontSize: 14 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    height: 28,
                    fontSize: '0.75rem',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    color: '#e2e8f0',
                    borderRadius: 1,
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                  },
                }}
              />
            </Box>

            {/* Tree Items List */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
              {treeData.length === 0 ? (
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', p: 2, textAlign: 'center' }}>
                  No matching files found.
                </Typography>
              ) : (
                treeData.map((node) => (
                  <ArchitectureTreeItem
                    key={node.id}
                    node={node}
                    selectedFile={selectedFile}
                    onSelectFile={(f) => setSelectedFile(f)}
                    expandAll={expandAllTree}
                    collapseAll={collapseAllTree}
                  />
                ))
              )}
            </Box>
          </Box>

          {/* ─────────────────────────────────────────────────────────────────
              2. CENTER PANE: Interactive Dependency Graph
          ───────────────────────────────────────────────────────────────── */}
          <Box
            ref={svgContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            sx={{
              flexGrow: 1,
              position: 'relative',
              bgcolor: '#09090e',
              backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
              cursor: isPanning ? 'grabbing' : 'grab',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {/* Graph Floating Canvas Controls */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(18, 18, 24, 0.85)',
                backdropFilter: 'blur(10px)',
                p: 0.6,
                borderRadius: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              <Tooltip title="Zoom In">
                <IconButton size="small" onClick={handleZoomIn} sx={{ color: '#cbd5e1' }}>
                  <ZoomInIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton size="small" onClick={handleZoomOut} sx={{ color: '#cbd5e1' }}>
                  <ZoomOutIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Tooltip title="Reset View">
                <IconButton size="small" onClick={handleResetCanvas} sx={{ color: '#cbd5e1' }}>
                  <RestartAltIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>

              <Typography variant="caption" sx={{ color: '#94a3b8', px: 1, fontWeight: 500 }}>
                {Math.round(zoom * 100)}%
              </Typography>

              {graphData?.is_truncated && (
                <Chip
                  label={`Showing ${graphData.nodes_returned} / ${graphData.total_nodes_in_repo}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(255, 210, 31, 0.12)',
                    color: '#ffd21f',
                  }}
                />
              )}
            </Box>

            {/* Graph Loading Spinner */}
            {loadingGraph && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'rgba(18, 18, 24, 0.85)',
                  px: 1.5,
                  py: 0.8,
                  borderRadius: 2,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <CircularProgress size={16} sx={{ color: '#ffd21f' }} />
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  Updating graph...
                </Typography>
              </Box>
            )}

            {/* Interactive SVG Canvas */}
            <svg
              width="100%"
              height="100%"
              style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
            >
              <defs>
                {/* Arrow markers */}
                <marker
                  id="arrow-normal"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#64748b" />
                </marker>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ffd21f" />
                </marker>
                <marker
                  id="arrow-circular"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ef4444" />
                </marker>
                <marker
                  id="arrow-incoming"
                  viewBox="0 0 10 10"
                  refX="16"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* 1. Module Boundary Boxes */}
                {Object.values(graphLayout.modules).map((mod) => (
                  <g key={`mod-${mod.name}`}>
                    <rect
                      x={mod.x}
                      y={mod.y}
                      width={mod.width}
                      height={mod.height}
                      rx={12}
                      fill="rgba(255, 255, 255, 0.015)"
                      stroke="rgba(255, 255, 255, 0.07)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={mod.x + 16}
                      y={mod.y + 24}
                      fill="#64748b"
                      fontSize="12px"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      📁 {mod.name}
                    </text>
                  </g>
                ))}

                {/* 2. Edges (Dependencies) */}
                {graphData?.edges.map((edge) => {
                  const srcPos = graphLayout.positions[edge.source];
                  const tgtPos = graphLayout.positions[edge.target];
                  if (!srcPos || !tgtPos) return null;

                  const isConnectedToSelected =
                    selectedFile === edge.source || selectedFile === edge.target;
                  const isOutgoingFromSelected = selectedFile === edge.source;
                  const isIncomingToSelected = selectedFile === edge.target;

                  // Edge connection coordinates
                  const x1 = srcPos.x + srcPos.width / 2;
                  const y1 = srcPos.y + srcPos.height / 2;
                  const x2 = tgtPos.x + tgtPos.width / 2;
                  const y2 = tgtPos.y + tgtPos.height / 2;

                  // Curved quadratic control point
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const cx = (x1 + x2) / 2 - dy * 0.15;
                  const cy = (y1 + y2) / 2 + dx * 0.15;

                  let strokeColor = 'rgba(100, 116, 139, 0.35)';
                  let strokeWidth = 1.2;
                  let markerEnd = 'url(#arrow-normal)';

                  if (edge.is_circular) {
                    strokeColor = '#ef4444';
                    strokeWidth = 2;
                    markerEnd = 'url(#arrow-circular)';
                  } else if (isOutgoingFromSelected) {
                    strokeColor = '#ffd21f';
                    strokeWidth = 2.4;
                    markerEnd = 'url(#arrow-active)';
                  } else if (isIncomingToSelected) {
                    strokeColor = '#38bdf8';
                    strokeWidth = 2.4;
                    markerEnd = 'url(#arrow-incoming)';
                  } else if (selectedFile && !isConnectedToSelected) {
                    strokeColor = 'rgba(100, 116, 139, 0.12)';
                  }

                  return (
                    <path
                      key={edge.id}
                      d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      markerEnd={markerEnd}
                      style={{ transition: 'stroke 0.2s ease' }}
                    />
                  );
                })}

                {/* 3. Graph Nodes */}
                {graphData?.nodes.map((node) => {
                  const pos = graphLayout.positions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedFile === node.id;
                  const ctype = COMPONENT_TYPE_COLORS[node.component_type] || COMPONENT_TYPE_COLORS.file;
                  const lang = getLanguageBadge(node.language);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(node.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Node Card Background */}
                      <rect
                        width={pos.width}
                        height={pos.height}
                        rx={8}
                        fill={isSelected ? '#1e1e28' : '#121218'}
                        stroke={
                          isSelected
                            ? '#ffd21f'
                            : node.is_circular
                            ? '#ef4444'
                            : 'rgba(255, 255, 255, 0.1)'
                        }
                        strokeWidth={isSelected ? 2 : node.is_circular ? 1.5 : 1}
                        filter={
                          isSelected
                            ? 'drop-shadow(0 0 10px rgba(255, 210, 31, 0.35))'
                            : node.is_circular
                            ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.3))'
                            : 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))'
                        }
                      />

                      {/* Left Accent indicator strip */}
                      <rect
                        x={0}
                        y={0}
                        width={4}
                        height={pos.height}
                        rx={2}
                        fill={isSelected ? '#ffd21f' : ctype.color}
                      />

                      {/* Node Name */}
                      <text
                        x={12}
                        y={22}
                        fill={isSelected ? '#ffd21f' : '#f8fafc'}
                        fontSize="12px"
                        fontWeight={isSelected ? '700' : '600'}
                      >
                        {node.name.length > 20 ? `${node.name.substring(0, 19)}...` : node.name}
                      </text>

                      {/* Subtitle / Role Badge */}
                      <text x={12} y={39} fill={ctype.color} fontSize="10px" fontWeight="500">
                        {ctype.label} • <tspan fill={lang.color}>{node.language}</tspan>
                      </text>

                      {/* Badges: Degree Counters */}
                      <g transform={`translate(${pos.width - 45}, 12)`}>
                        <text fill="#64748b" fontSize="10px" fontWeight="600" textAnchor="end">
                          ↘{node.out_degree} ↖{node.in_degree}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          </Box>

          {/* ─────────────────────────────────────────────────────────────────
              3. RIGHT PANE: Component Details & Architecture Issues
          ───────────────────────────────────────────────────────────────── */}
          <Box
            sx={{
              width: 360,
              minWidth: 320,
              maxWidth: 420,
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              bgcolor: '#0d0d14',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Header Tabs: Component Details vs Issues */}
            <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Tabs
                value={activeTab}
                onChange={(_, val) => setActiveTab(val)}
                textColor="inherit"
                sx={{
                  minHeight: 44,
                  '& .MuiTab-root': {
                    minHeight: 44,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#94a3b8',
                    textTransform: 'none',
                    '&.Mui-selected': { color: '#ffd21f' },
                  },
                  '& .MuiTabs-indicator': { bgcolor: '#ffd21f' },
                }}
              >
                <Tab label="Component Details" />
                <Tab
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <span>Architecture Issues</span>
                      {findings && findings.total_findings > 0 && (
                        <Chip
                          label={findings.total_findings}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: 'rgba(239, 68, 68, 0.18)',
                            color: '#ef4444',
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              </Tabs>
            </Box>

            {/* TAB CONTENT */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
              {activeTab === 0 ? (
                /* TAB 0: COMPONENT DETAILS */
                loadingDetail ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress size={28} sx={{ color: '#ffd21f' }} />
                  </Box>
                ) : !nodeDetail ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: '#64748b' }}>
                    <AccountTreeIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
                    <Typography variant="body2">
                      Select any file in the explorer tree or dependency graph to inspect its architecture relationships.
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Component Title Card */}
                    <Card
                      sx={{
                        p: 2,
                        bgcolor: '#121218',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 700, wordBreak: 'break-all' }}>
                          {nodeDetail.name}
                        </Typography>
                        <Chip
                          label={nodeDetail.component_type}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            color: COMPONENT_TYPE_COLORS[nodeDetail.component_type]?.color || '#94a3b8',
                            bgcolor: COMPONENT_TYPE_COLORS[nodeDetail.component_type]?.bg || 'transparent',
                            textTransform: 'capitalize',
                          }}
                        />
                      </Box>

                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5, wordBreak: 'break-all' }}>
                        {nodeDetail.file_path}
                      </Typography>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        <Chip
                          label={`${nodeDetail.line_count} lines`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8' }}
                        />
                        <Chip
                          label={nodeDetail.language}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            bgcolor: getLanguageBadge(nodeDetail.language).bg,
                            color: getLanguageBadge(nodeDetail.language).color,
                          }}
                        />
                      </Box>

                      {/* Action Links */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        {nodeDetail.github_url && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNewIcon sx={{ fontSize: '14px !important' }} />}
                            href={nodeDetail.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              flex: 1,
                              fontSize: '0.72rem',
                              color: '#94a3b8',
                              borderColor: 'rgba(255, 255, 255, 0.15)',
                              textTransform: 'none',
                              '&:hover': { color: '#ffd21f', borderColor: '#ffd21f' },
                            }}
                          >
                            GitHub
                          </Button>
                        )}

                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<FlashOnIcon sx={{ fontSize: '14px !important' }} />}
                          onClick={() => navigate(`/repository/${id}/impact`)}
                          sx={{
                            flex: 1,
                            fontSize: '0.72rem',
                            bgcolor: '#ffd21f',
                            color: '#09090d',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#e6bd19' },
                          }}
                        >
                          Impact Analysis
                        </Button>
                      </Box>
                    </Card>

                    {/* Detected Issues Banner for this node */}
                    {nodeDetail.is_circular && (
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <WarningAmberIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                          <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700 }}>
                            Circular Dependency Loop
                          </Typography>
                        </Box>
                        {nodeDetail.cycles.map((cyc, idx) => (
                          <Typography key={idx} variant="caption" sx={{ color: '#fca5a5', display: 'block', fontSize: '0.7rem' }}>
                            {cyc.join(' → ')}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    {/* Incoming Dependencies (Dependents) */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                          Incoming Dependents ({nodeDetail.incoming_count})
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Files importing this
                        </Typography>
                      </Box>

                      {nodeDetail.incoming_dependencies.length === 0 ? (
                        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block' }}>
                          No files import this component.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {nodeDetail.incoming_dependencies.map((dep, idx) => (
                            <Box
                              key={idx}
                              onClick={() => setSelectedFile(dep.file_path)}
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  bgcolor: 'rgba(56, 189, 248, 0.08)',
                                  borderColor: 'rgba(56, 189, 248, 0.3)',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600 }}>
                                  {dep.file_path.split('/').pop()}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
                                  Line {dep.line_number}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>
                                {dep.file_path}
                              </Typography>
                              {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                  {dep.imported_symbols.map((sym, sIdx) => (
                                    <Chip
                                      key={sIdx}
                                      label={sym}
                                      size="small"
                                      sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>

                    {/* Outgoing Dependencies (Imports) */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                          Outgoing Imports ({nodeDetail.outgoing_count})
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Files imported by this
                        </Typography>
                      </Box>

                      {nodeDetail.outgoing_dependencies.length === 0 ? (
                        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block' }}>
                          No outgoing dependencies.
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {nodeDetail.outgoing_dependencies.map((dep, idx) => (
                            <Box
                              key={idx}
                              onClick={() => setSelectedFile(dep.file_path)}
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  bgcolor: 'rgba(255, 210, 31, 0.08)',
                                  borderColor: 'rgba(255, 210, 31, 0.3)',
                                },
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="body2" sx={{ color: '#ffd21f', fontSize: '0.78rem', fontWeight: 600 }}>
                                  {dep.file_path.split('/').pop()}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
                                  Line {dep.line_number}
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>
                                {dep.file_path}
                              </Typography>
                              {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                  {dep.imported_symbols.map((sym, sIdx) => (
                                    <Chip
                                      key={sIdx}
                                      label={sym}
                                      size="small"
                                      sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255, 210, 31, 0.1)', color: '#ffd21f' }}
                                    />
                                  ))}
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>

                    {/* Defined Symbols */}
                    {nodeDetail.defined_symbols && nodeDetail.defined_symbols.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                          Defined Symbols ({nodeDetail.defined_symbols.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                          {nodeDetail.defined_symbols.map((sym, idx) => (
                            <Chip
                              key={idx}
                              label={sym.class_name ? `${sym.class_name}.${sym.name}` : sym.name}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                bgcolor: 'rgba(255, 255, 255, 0.05)',
                                color: '#e2e8f0',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )
              ) : (
                /* TAB 1: ARCHITECTURE FINDINGS */
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Summary Metric Cards */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <Card
                      sx={{
                        p: 1.5,
                        bgcolor: '#121218',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Circular Cycles
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#ef4444', fontWeight: 700, mt: 0.5 }}>
                        {findings?.circular_count || 0}
                      </Typography>
                    </Card>

                    <Card
                      sx={{
                        p: 1.5,
                        bgcolor: '#121218',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Unresolved Imports
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#f59e0b', fontWeight: 700, mt: 0.5 }}>
                        {findings?.unresolved_count || 0}
                      </Typography>
                    </Card>
                  </Box>

                  {/* Circular Dependencies Section */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                      Circular Dependencies
                    </Typography>

                    {findings?.circular_dependencies.length === 0 ? (
                      <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.08)', borderRadius: 2, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#10b981', fontSize: 18 }} />
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                            No circular dependencies detected.
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {findings?.circular_dependencies.map((circ) => (
                          <Card
                            key={circ.id}
                            sx={{
                              p: 1.5,
                              bgcolor: '#14141d',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: 2,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem' }}>
                                {circ.title}
                              </Typography>
                              <Chip
                                label="HIGH"
                                size="small"
                                sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700 }}
                              />
                            </Box>

                            {/* Clickable cycle chain */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                              {circ.cycle.map((filePath, cIdx) => (
                                <Box
                                  key={cIdx}
                                  onClick={() => {
                                    setSelectedFile(filePath);
                                    setActiveTab(0);
                                  }}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.8,
                                    cursor: 'pointer',
                                    p: 0.4,
                                    borderRadius: 1,
                                    '&:hover': { bgcolor: 'rgba(255, 210, 31, 0.1)' },
                                  }}
                                >
                                  <ArrowForwardIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
                                  <Typography variant="caption" sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                                    {filePath}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>

                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontSize: '0.68rem', mt: 0.5 }}>
                              {circ.recommendation}
                            </Typography>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Unresolved Imports Section */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                      Unresolved Imports
                    </Typography>

                    {findings?.unresolved_imports.length === 0 ? (
                      <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.08)', borderRadius: 2, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: '#10b981', fontSize: 18 }} />
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                            All internal imports resolved successfully.
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {findings?.unresolved_imports.map((unres) => (
                          <Card
                            key={unres.id}
                            onClick={() => {
                              setSelectedFile(unres.file_path);
                              setActiveTab(0);
                            }}
                            sx={{
                              p: 1.2,
                              bgcolor: '#14141d',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              borderRadius: 2,
                              cursor: 'pointer',
                              '&:hover': { borderColor: '#ffd21f' },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.78rem' }}>
                                {unres.module}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
                                Line {unres.line_number}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontSize: '0.68rem' }}>
                              In: {unres.file_path}
                            </Typography>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </DashboardLayout>
  );
};

export default ArchitectureExplorer;
