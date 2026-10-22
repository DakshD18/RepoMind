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
  Divider,
  MenuItem,
  Select,
  FormControl,
  Drawer,
  Collapse,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LanIcon from '@mui/icons-material/Lan';
import RouteIcon from '@mui/icons-material/Route';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import {
  getArchitectureOverview,
  getArchitectureTree,
  getArchitectureGraph,
  getArchitectureModuleGraph,
  getArchitectureNodeDetail,
  getArchitectureFindings,
} from '../services/api';

import type {
  ArchitectureOverview as IArchitectureOverview,
  ArchitectureTreeNode,
  ArchitectureGraphResponse,
  ArchitectureModuleNode,
  ArchitectureModuleGraphResponse,
  ArchitectureNodeDetail as IArchitectureNodeDetail,
  ArchitectureFindingsResponse,
} from '../types';

// ─── Visual Theme & Badge Helpers ────────────────────────────────────────────

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

const MODULE_ROLE_STYLES: Record<string, { color: string; bg: string }> = {
  'API Routes': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
  'Services': { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.14)' },
  'Data Models': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)' },
  'UI Components': { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' },
  'Pages & Views': { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)' },
  'Utilities & Hooks': { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' },
  'Configuration': { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)' },
  'Tests': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)' },
  'Backend Core': { color: '#ffd21f', bg: 'rgba(255, 210, 31, 0.14)' },
  'Frontend Core': { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' },
  'Module': { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)' },
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
  selectedModulePath: string | null;
  onSelectFile: (filePath: string) => void;
  onSelectModule: (modulePath: string) => void;
  expandAll: boolean;
  collapseAll: boolean;
}

const ArchitectureTreeItem: React.FC<TreeItemProps> = ({
  node,
  depth = 0,
  selectedFile,
  selectedModulePath,
  onSelectFile,
  onSelectModule,
  expandAll,
  collapseAll,
}) => {
  const [open, setOpen] = useState<boolean>(depth === 0);

  useEffect(() => {
    if (expandAll) setOpen(true);
    if (collapseAll) setOpen(false);
  }, [expandAll, collapseAll]);

  if (node.type === 'directory') {
    const isModuleSelected = selectedModulePath === node.path;
    return (
      <Box sx={{ userSelect: 'none' }}>
        <Box
          onClick={() => {
            onSelectModule(node.path);
            setOpen(!open);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            py: 0.5,
            px: 1,
            pl: depth * 1.5 + 0.8,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: isModuleSelected ? 'rgba(255, 210, 31, 0.12)' : 'transparent',
            border: isModuleSelected ? '1px solid rgba(255, 210, 31, 0.3)' : '1px solid transparent',
            transition: 'all 0.15s ease',
            '&:hover': {
              bgcolor: isModuleSelected ? 'rgba(255, 210, 31, 0.16)' : 'rgba(255, 255, 255, 0.04)',
            },
          }}
        >
          <IconButton
            size="small"
            sx={{ p: 0.2, mr: 0.4, color: '#64748b' }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            {open ? (
              <KeyboardArrowDownIcon sx={{ fontSize: 15 }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>

          {open ? (
            <FolderOpenIcon sx={{ fontSize: 15, color: '#ffd21f', mr: 0.8 }} />
          ) : (
            <FolderIcon sx={{ fontSize: 15, color: '#f59e0b', mr: 0.8 }} />
          )}

          <Typography
            variant="body2"
            sx={{
              color: isModuleSelected ? '#ffd21f' : '#e2e8f0',
              fontWeight: isModuleSelected ? 700 : 500,
              fontSize: '0.78rem',
              flexGrow: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name}
          </Typography>

          {node.file_count !== undefined && (
            <Chip
              label={node.file_count}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.62rem',
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                color: '#64748b',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}
        </Box>

        <Collapse in={open} timeout="auto" unmountOnExit>
          {node.children && (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {node.children.map((child) => (
                <ArchitectureTreeItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  selectedFile={selectedFile}
                  selectedModulePath={selectedModulePath}
                  onSelectFile={onSelectFile}
                  onSelectModule={onSelectModule}
                  expandAll={expandAll}
                  collapseAll={collapseAll}
                />
              ))}
            </Box>
          )}
        </Collapse>
      </Box>
    );
  }

  // File item
  const isSelected = selectedFile === node.path;
  const roleStyle = COMPONENT_TYPE_COLORS[node.component_type || 'file'] || COMPONENT_TYPE_COLORS.file;
  const langStyle = getLanguageBadge(node.language);

  return (
    <Box
      onClick={() => onSelectFile(node.path)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: 0.5,
        px: 1,
        pl: depth * 1.5 + 2.4,
        borderRadius: 1,
        cursor: 'pointer',
        bgcolor: isSelected ? 'rgba(255, 210, 31, 0.15)' : 'transparent',
        border: isSelected ? '1px solid rgba(255, 210, 31, 0.4)' : '1px solid transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: isSelected ? 'rgba(255, 210, 31, 0.2)' : 'rgba(255, 255, 255, 0.04)',
        },
      }}
    >
      <InsertDriveFileIcon
        sx={{
          fontSize: 14,
          color: isSelected ? '#ffd21f' : langStyle.color,
          mr: 0.8,
          flexShrink: 0,
        }}
      />

      <Typography
        variant="body2"
        sx={{
          color: isSelected ? '#ffffff' : '#cbd5e1',
          fontWeight: isSelected ? 700 : 400,
          fontSize: '0.76rem',
          flexGrow: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {node.name}
      </Typography>

      {node.is_circular && (
        <Tooltip title="Participates in Circular Dependency">
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#ef4444',
              boxShadow: '0 0 6px #ef4444',
              mr: 0.5,
              flexShrink: 0,
            }}
          />
        </Tooltip>
      )}

      {node.component_type && node.component_type !== 'file' && (
        <Chip
          label={roleStyle.label}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.58rem',
            bgcolor: roleStyle.bg,
            color: roleStyle.color,
            border: `1px solid ${roleStyle.color}33`,
            flexShrink: 0,
            '& .MuiChip-label': { px: 0.5 },
          }}
        />
      )}
    </Box>
  );
};

// ─── Main ArchitectureExplorer Component ─────────────────────────────────────

export const ArchitectureExplorer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Primary Data State
  const [overview, setOverview] = useState<IArchitectureOverview | null>(null);
  const [treeData, setTreeData] = useState<ArchitectureTreeNode[]>([]);
  const [moduleGraph, setModuleGraph] = useState<ArchitectureModuleGraphResponse | null>(null);
  const [fileGraph, setFileGraph] = useState<ArchitectureGraphResponse | null>(null);
  const [nodeDetail, setNodeDetail] = useState<IArchitectureNodeDetail | null>(null);
  const [findings, setFindings] = useState<ArchitectureFindingsResponse | null>(null);

  // View Mode: 'whole_repo' (high level modules) or 'file_connections' (focused 1-hop file dependencies)
  const [viewMode, setViewMode] = useState<'whole_repo' | 'file_connections'>('whole_repo');

  // Selections
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedModulePath, setSelectedModulePath] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Filters & Controls
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [graphSearch, setGraphSearch] = useState<string>('');
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('all');
  const [expandAllTree, setExpandAllTree] = useState<boolean>(false);
  const [collapseAllTree, setCollapseAllTree] = useState<boolean>(false);

  // Findings Drawer State
  const [issuesDrawerOpen, setIssuesDrawerOpen] = useState<boolean>(false);
  const [issuesFilterTab, setIssuesFilterTab] = useState<'all' | 'circular' | 'unresolved' | 'hubs'>('all');

  // SVG Pan & Zoom Canvas State
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ─── 1. Load Initial Overview, Tree, Module Graph, Findings ────────────────

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoadingInitial(true);
    try {
      const [overviewRes, treeRes, modGraphRes, findingsRes] = await Promise.all([
        getArchitectureOverview(id),
        getArchitectureTree(id),
        getArchitectureModuleGraph(id),
        getArchitectureFindings(id),
      ]);

      setOverview(overviewRes);
      setTreeData(treeRes.tree);
      setModuleGraph(modGraphRes);
      setFindings(findingsRes);

      // Default select the top module
      if (modGraphRes.modules.length > 0) {
        setSelectedModulePath(modGraphRes.modules[0].id);
      }

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

  // ─── 2. Load File Connections Graph when in File Connections View ──────────

  const fetchFileGraph = useCallback(async () => {
    if (!id || !selectedFile) return;
    setLoadingGraph(true);
    try {
      const res = await getArchitectureGraph(id, {
        focus: selectedFile,
        component_type: componentTypeFilter !== 'all' ? componentTypeFilter : undefined,
        limit: 80,
      });
      setFileGraph(res);
    } catch {
      // ignore transient graph load errors
    } finally {
      setLoadingGraph(false);
    }
  }, [id, selectedFile, componentTypeFilter]);

  useEffect(() => {
    if (viewMode === 'file_connections') {
      fetchFileGraph();
    }
  }, [viewMode, fetchFileGraph]);

  // ─── 3. Load Component Details when Selected File Changes ──────────────────

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
        setNodeDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [id, selectedFile]);

  // ─── 4. Tree Search Query Handler ──────────────────────────────────────────

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

  // ─── 5. Synchronized Drill-Down to File Connections ─────────────────────────

  const handleOpenFileConnections = (filePath: string) => {
    setSelectedFile(filePath);
    setViewMode('file_connections');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ─── 6. Whole Repository Module Graph Layout ───────────────────────────────

  const moduleLayout = useMemo(() => {
    if (!moduleGraph || moduleGraph.modules.length === 0) {
      return { positions: {}, edges: [], width: 900, height: 600 };
    }

    const modules = moduleGraph.modules.filter((m) => {
      if (!graphSearch) return true;
      const q = graphSearch.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.path.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
    });

    const positions: Record<string, { x: number; y: number; width: number; height: number; module: ArchitectureModuleNode }> = {};
    const cardWidth = 260;
    const baseCardHeight = 110;
    const expandedCardHeight = 220;
    const gapX = 80;
    const gapY = 50;

    // Arrange modules into smart columns based on architecture role
    const colOrder = [
      ['Frontend Core', 'Pages & Views', 'UI Components'],
      ['API Routes', 'Services', 'Utilities & Hooks'],
      ['Backend Core', 'Data Models', 'Configuration', 'Tests', 'Module'],
    ];

    const colGroups: ArchitectureModuleNode[][] = [[], [], []];

    modules.forEach((mod) => {
      let placed = false;
      for (let c = 0; c < colOrder.length; c++) {
        if (colOrder[c].includes(mod.role)) {
          colGroups[c].push(mod);
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Fallback to least loaded column
        const minCol = colGroups.reduce((acc, curr, idx) => (curr.length < colGroups[acc].length ? idx : acc), 0);
        colGroups[minCol].push(mod);
      }
    });

    let maxCanvasWidth = 850;
    let maxCanvasHeight = 600;

    colGroups.forEach((colMods, colIdx) => {
      let curY = 60;
      const curX = 60 + colIdx * (cardWidth + gapX);

      colMods.forEach((mod) => {
        const isExp = expandedModules.has(mod.id);
        const cardH = isExp ? expandedCardHeight : baseCardHeight;

        positions[mod.id] = {
          x: curX,
          y: curY,
          width: cardWidth,
          height: cardH,
          module: mod,
        };

        curY += cardH + gapY;
      });

      maxCanvasWidth = Math.max(maxCanvasWidth, curX + cardWidth + 80);
      maxCanvasHeight = Math.max(maxCanvasHeight, curY + 60);
    });

    return { positions, edges: moduleGraph.edges, width: maxCanvasWidth, height: maxCanvasHeight };
  }, [moduleGraph, graphSearch, expandedModules]);

  // ─── 7. File Connections Focused Graph Layout ──────────────────────────────

  const fileConnectionLayout = useMemo(() => {
    if (!selectedFile) {
      return { centerNode: null, incomingNodes: [], outgoingNodes: [], width: 900, height: 600 };
    }

    const centerNode = fileGraph?.nodes.find((n) => n.id === selectedFile) || {
      id: selectedFile,
      name: selectedFile.split('/').pop() || selectedFile,
      path: selectedFile,
      type: 'file' as const,
      component_type: 'file',
      language: 'Code',
      line_count: 0,
      in_degree: nodeDetail?.incoming_count || 0,
      out_degree: nodeDetail?.outgoing_count || 0,
      total_degree: (nodeDetail?.incoming_count || 0) + (nodeDetail?.outgoing_count || 0),
      module: selectedFile.split('/').slice(0, -1).join('/') || 'root',
      is_circular: nodeDetail?.is_circular || false,
      has_unresolved: (nodeDetail?.unresolved_imports?.length || 0) > 0,
    };

    const incoming = fileGraph?.nodes.filter((n) => n.id !== selectedFile && n.direction === 'incoming') || [];
    const outgoing = fileGraph?.nodes.filter((n) => n.id !== selectedFile && n.direction === 'outgoing') || [];

    // Fallback if fileGraph isn't loaded yet, pull from nodeDetail
    const incomingList = incoming.length > 0 ? incoming : (nodeDetail?.incoming_dependencies || []).map((dep) => ({
      id: dep.file_path,
      name: dep.file_path.split('/').pop() || dep.file_path,
      path: dep.file_path,
      type: 'file' as const,
      component_type: 'file',
      language: dep.language,
      line_count: 0,
      in_degree: 0,
      out_degree: 0,
      total_degree: 1,
      module: dep.file_path.split('/').slice(0, -1).join('/') || 'root',
      is_circular: dep.is_circular,
      has_unresolved: false,
    }));

    const outgoingList = outgoing.length > 0 ? outgoing : (nodeDetail?.outgoing_dependencies || []).map((dep) => ({
      id: dep.file_path,
      name: dep.file_path.split('/').pop() || dep.file_path,
      path: dep.file_path,
      type: 'file' as const,
      component_type: 'file',
      language: dep.language,
      line_count: 0,
      in_degree: 0,
      out_degree: 0,
      total_degree: 1,
      module: dep.file_path.split('/').slice(0, -1).join('/') || 'root',
      is_circular: dep.is_circular,
      has_unresolved: false,
    }));

    const cardWidth = 220;
    const cardHeight = 64;
    const gapY = 24;

    const maxCount = Math.max(1, incomingList.length, outgoingList.length);
    const canvasHeight = Math.max(550, maxCount * (cardHeight + gapY) + 120);

    const centerX = 450;
    const centerY = canvasHeight / 2 - cardHeight / 2;

    const incomingX = 80;
    const outgoingX = 740;

    const inTotalH = incomingList.length * (cardHeight + gapY) - gapY;
    const inStartY = Math.max(60, (canvasHeight - inTotalH) / 2);

    const outTotalH = outgoingList.length * (cardHeight + gapY) - gapY;
    const outStartY = Math.max(60, (canvasHeight - outTotalH) / 2);

    return {
      centerNode: {
        node: centerNode,
        x: centerX,
        y: centerY,
        width: 240,
        height: 80,
      },
      incomingNodes: incomingList.map((n, idx) => ({
        node: n,
        x: incomingX,
        y: inStartY + idx * (cardHeight + gapY),
        width: cardWidth,
        height: cardHeight,
      })),
      outgoingNodes: outgoingList.map((n, idx) => ({
        node: n,
        x: outgoingX,
        y: outStartY + idx * (cardHeight + gapY),
        width: cardWidth,
        height: cardHeight,
      })),
      width: 1040,
      height: canvasHeight,
    };
  }, [selectedFile, fileGraph, nodeDetail]);

  // ─── 8. SVG Interactive Canvas Pan & Zoom Handlers ─────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  const handleMouseUp = () => setIsPanning(false);

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

  // ─── 9. Selected Module Info ────────────────────────────────────────────────

  const currentModule = useMemo(() => {
    if (!moduleGraph || !selectedModulePath) return null;
    return moduleGraph.modules.find((m) => m.id === selectedModulePath) || null;
  }, [moduleGraph, selectedModulePath]);

  // ─── 10. Filtered Issues for Drawer ────────────────────────────────────────

  const filteredIssuesList = useMemo(() => {
    if (!findings) return [];
    const list: Array<{
      id: string;
      category: 'circular' | 'unresolved' | 'hub';
      severity: string;
      title: string;
      filePath?: string;
      description: string;
      recommendation: string;
    }> = [];

    if (issuesFilterTab === 'all' || issuesFilterTab === 'circular') {
      findings.circular_dependencies.forEach((c) => {
        list.push({
          id: c.id,
          category: 'circular',
          severity: c.severity,
          title: c.title,
          filePath: c.cycle[0],
          description: c.description,
          recommendation: c.recommendation,
        });
      });
    }

    if (issuesFilterTab === 'all' || issuesFilterTab === 'unresolved') {
      findings.unresolved_imports.forEach((u) => {
        list.push({
          id: u.id,
          category: 'unresolved',
          severity: u.severity,
          title: u.title,
          filePath: u.file_path,
          description: u.description,
          recommendation: u.recommendation,
        });
      });
    }

    if (issuesFilterTab === 'all' || issuesFilterTab === 'hubs') {
      (findings.highly_connected_files || []).forEach((h) => {
        list.push({
          id: h.id,
          category: 'hub',
          severity: h.severity,
          title: h.title,
          filePath: h.file_path,
          description: h.description,
          recommendation: h.recommendation,
        });
      });
    }

    return list;
  }, [findings, issuesFilterTab]);

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
              or the source files are not available locally.
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
          bgcolor: '#050507',
          minHeight: 'calc(100vh - 60px)',
          overflowX: 'hidden',
        }}
      >
        {/* ─── 1. TOP HEADER & METRIC CARDS ─────────────────────────────────── */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: '#09090d',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Header Title & Subtitle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #181824 0%, #101016 100%)',
                border: '1px solid rgba(255, 210, 31, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255, 210, 31, 0.18)',
                flexShrink: 0,
              }}
            >
              <AccountTreeIcon sx={{ color: '#ffd21f', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
                Architecture Intelligence
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                Explore your repository's structure and see how components connect.
              </Typography>
            </Box>
          </Box>

          {/* 4 Metric Cards in Horizontal Layout */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Metric 1: Files */}
            <Card
              sx={{
                px: 2,
                py: 1,
                bgcolor: '#101016',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                minWidth: 105,
                textAlign: 'left',
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Files
              </Typography>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {overview.total_files}
              </Typography>
            </Card>

            {/* Metric 2: Dependencies */}
            <Card
              sx={{
                px: 2,
                py: 1,
                bgcolor: '#101016',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '10px',
                minWidth: 115,
                textAlign: 'left',
              }}
            >
              <Typography variant="caption" sx={{ color: '#38bdf8', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Dependencies
              </Typography>
              <Typography variant="h6" sx={{ color: '#38bdf8', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {overview.total_dependencies}
              </Typography>
            </Card>

            {/* Metric 3: Modules */}
            <Card
              sx={{
                px: 2,
                py: 1,
                bgcolor: '#101016',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: '10px',
                minWidth: 105,
                textAlign: 'left',
              }}
            >
              <Typography variant="caption" sx={{ color: '#a855f7', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Modules
              </Typography>
              <Typography variant="h6" sx={{ color: '#a855f7', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                {moduleGraph?.total_modules || overview.total_directories}
              </Typography>
            </Card>

            {/* Metric 4: Architecture Issues */}
            <Card
              onClick={() => setIssuesDrawerOpen(true)}
              sx={{
                px: 2,
                py: 1,
                bgcolor: '#101016',
                border: findings && findings.total_findings > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '10px',
                minWidth: 130,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: '#ffd21f',
                  bgcolor: 'rgba(255, 210, 31, 0.05)',
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: findings && findings.total_findings > 0 ? '#f59e0b' : '#10b981',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Architecture Issues
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: findings && findings.total_findings > 0 ? '#f59e0b' : '#10b981',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    lineHeight: 1.2,
                  }}
                >
                  {findings?.total_findings || 0}
                </Typography>
                <Chip
                  label="View"
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.6rem',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                />
              </Box>
            </Card>
          </Box>
        </Box>

        {/* ─── 2. VIEW SWITCHER & WORKSPACE CONTROLS BAR ────────────────────── */}
        <Box
          sx={{
            px: 3,
            py: 1.2,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: '#0b0b12',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Dual View Switcher */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                bgcolor: 'rgba(18, 18, 24, 0.8)',
                p: 0.4,
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Button
                size="small"
                onClick={() => setViewMode('whole_repo')}
                startIcon={<LanIcon sx={{ fontSize: 16 }} />}
                sx={{
                  px: 1.8,
                  py: 0.6,
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: viewMode === 'whole_repo' ? 700 : 500,
                  color: viewMode === 'whole_repo' ? '#09090d' : '#94a3b8',
                  bgcolor: viewMode === 'whole_repo' ? '#ffd21f' : 'transparent',
                  boxShadow: viewMode === 'whole_repo' ? '0 0 14px rgba(255, 210, 31, 0.3)' : 'none',
                  textTransform: 'none',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: viewMode === 'whole_repo' ? '#e6bd19' : 'rgba(255, 255, 255, 0.05)',
                    color: viewMode === 'whole_repo' ? '#09090d' : '#ffffff',
                  },
                }}
              >
                Whole Repository
              </Button>

              <Button
                size="small"
                onClick={() => {
                  if (!selectedFile && treeData.length > 0) {
                    // pick a default file
                    const first = treeData[0].children?.[0]?.path || treeData[0].path;
                    if (first) setSelectedFile(first);
                  }
                  setViewMode('file_connections');
                }}
                startIcon={<RouteIcon sx={{ fontSize: 16 }} />}
                sx={{
                  px: 1.8,
                  py: 0.6,
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: viewMode === 'file_connections' ? 700 : 500,
                  color: viewMode === 'file_connections' ? '#09090d' : '#94a3b8',
                  bgcolor: viewMode === 'file_connections' ? '#ffd21f' : 'transparent',
                  boxShadow: viewMode === 'file_connections' ? '0 0 14px rgba(255, 210, 31, 0.3)' : 'none',
                  textTransform: 'none',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    bgcolor: viewMode === 'file_connections' ? '#e6bd19' : 'rgba(255, 255, 255, 0.05)',
                    color: viewMode === 'file_connections' ? '#09090d' : '#ffffff',
                  },
                }}
              >
                File Connections
              </Button>
            </Box>

            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem', ml: 1, display: { xs: 'none', lg: 'block' } }}>
              {viewMode === 'whole_repo'
                ? 'See the major parts of your project and how they connect.'
                : 'Explore the files that this component uses and the files that depend on it.'}
            </Typography>
          </Box>

          {/* Right Filter & Canvas Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <TextField
              size="small"
              placeholder={viewMode === 'whole_repo' ? 'Filter modules...' : 'Search components...'}
              value={graphSearch}
              onChange={(e) => setGraphSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#64748b', fontSize: 16 }} />
                    </InputAdornment>
                  ),
                  endAdornment: graphSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setGraphSearch('')}>
                        <ClearIcon sx={{ color: '#64748b', fontSize: 14 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{
                width: 190,
                '& .MuiInputBase-root': {
                  height: 30,
                  fontSize: '0.78rem',
                  bgcolor: 'rgba(255, 255, 255, 0.04)',
                  color: '#e2e8f0',
                  borderRadius: '8px',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 210, 31, 0.3)' },
                },
              }}
            />

            {viewMode === 'file_connections' && (
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <Select
                  value={componentTypeFilter}
                  onChange={(e) => setComponentTypeFilter(e.target.value)}
                  sx={{
                    height: 30,
                    fontSize: '0.76rem',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                  }}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="service">Services</MenuItem>
                  <MenuItem value="component">Components</MenuItem>
                  <MenuItem value="model">Models</MenuItem>
                  <MenuItem value="route">Routes / Views</MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Refresh */}
            <Tooltip title="Refresh Architecture">
              <IconButton
                size="small"
                onClick={loadData}
                sx={{
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  p: 0.6,
                  '&:hover': { color: '#ffd21f', borderColor: '#ffd21f' },
                }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ─── 3. MAIN 3-PANE WORKSPACE ─────────────────────────────────────── */}
        <Box sx={{ display: 'flex', height: '620px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {/* ─────────────────────────────────────────────────────────────────
              PANE 1 (LEFT): Repository Explorer Tree
          ───────────────────────────────────────────────────────────────── */}
          <Box
            sx={{
              width: 280,
              minWidth: 240,
              maxWidth: 320,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              bgcolor: '#09090d',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Tree Header */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.68rem' }}
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
                      <UnfoldMoreIcon sx={{ fontSize: 15 }} />
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
                      <UnfoldLessIcon sx={{ fontSize: 15 }} />
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
                        <SearchIcon sx={{ color: '#64748b', fontSize: 15 }} />
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
                    fontSize: '0.74rem',
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
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
                    selectedModulePath={selectedModulePath}
                    onSelectFile={(f) => {
                      setSelectedFile(f);
                      // In Whole Repo view, user can still inspect file in right panel
                    }}
                    onSelectModule={(m) => {
                      setSelectedModulePath(m);
                    }}
                    expandAll={expandAllTree}
                    collapseAll={collapseAllTree}
                  />
                ))
              )}
            </Box>
          </Box>

          {/* ─────────────────────────────────────────────────────────────────
              PANE 2 (CENTER): Interactive Architecture Diagram (Dual Views)
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
              bgcolor: '#07070a',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
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
                top: 14,
                left: 14,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                bgcolor: 'rgba(18, 18, 24, 0.85)',
                backdropFilter: 'blur(10px)',
                p: 0.5,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              <Tooltip title="Zoom In">
                <IconButton size="small" onClick={handleZoomIn} sx={{ color: '#cbd5e1', p: 0.5 }}>
                  <ZoomInIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton size="small" onClick={handleZoomOut} sx={{ color: '#cbd5e1', p: 0.5 }}>
                  <ZoomOutIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Tooltip title="Reset View">
                <IconButton size="small" onClick={handleResetCanvas} sx={{ color: '#cbd5e1', p: 0.5 }}>
                  <RestartAltIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" sx={{ color: '#94a3b8', px: 0.8, fontWeight: 600, fontSize: '0.72rem' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              {loadingGraph && <CircularProgress size={13} sx={{ color: '#ffd21f', ml: 0.5 }} />}
            </Box>

            {/* Back button when in File Connections View */}
            {viewMode === 'file_connections' && (
              <Box sx={{ position: 'absolute', top: 14, right: 14, zIndex: 10 }}>
                <Button
                  size="small"
                  onClick={() => setViewMode('whole_repo')}
                  startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
                  sx={{
                    bgcolor: 'rgba(18, 18, 24, 0.85)',
                    color: '#ffd21f',
                    border: '1px solid rgba(255, 210, 31, 0.3)',
                    backdropFilter: 'blur(10px)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: '8px',
                    px: 1.5,
                    '&:hover': { bgcolor: 'rgba(255, 210, 31, 0.12)' },
                  }}
                >
                  Whole Repository View
                </Button>
              </Box>
            )}

            {/* Canvas Legend */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                bgcolor: 'rgba(18, 18, 24, 0.85)',
                backdropFilter: 'blur(10px)',
                px: 1.5,
                py: 0.6,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {viewMode === 'whole_repo' ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#ffd21f' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      Selected Module
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 14, height: 2, bgcolor: '#38bdf8' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      Dependency Flow
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef4444' }} />
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                      Circular
                    </Typography>
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#ffd21f' }} />
                    <Typography variant="caption" sx={{ color: '#ffd21f', fontSize: '0.68rem', fontWeight: 600 }}>
                      Selected Component
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#8b5cf6' }} />
                    <Typography variant="caption" sx={{ color: '#8b5cf6', fontSize: '0.68rem' }}>
                      Incoming Dependents
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: '#06b6d4' }} />
                    <Typography variant="caption" sx={{ color: '#06b6d4', fontSize: '0.68rem' }}>
                      Outgoing Imports
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {/* Interactive SVG Diagram */}
            <svg width="100%" height="100%" style={{ width: '100%', height: '100%' }}>
              <defs>
                <marker id="arrow-normal" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#64748b" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#ffd21f" />
                </marker>
                <marker id="arrow-cyan" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#06b6d4" />
                </marker>
                <marker id="arrow-purple" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#8b5cf6" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* ─────────────────────────────────────────────────────────────
                    VIEW A: WHOLE REPOSITORY ARCHITECTURE
                ───────────────────────────────────────────────────────────── */}
                {viewMode === 'whole_repo' && (
                  <>
                    {/* Cross-Module Edges */}
                    {moduleLayout.edges.map((edge) => {
                      const srcPos = moduleLayout.positions[edge.source];
                      const tgtPos = moduleLayout.positions[edge.target];
                      if (!srcPos || !tgtPos) return null;

                      const isSourceSelected = selectedModulePath === edge.source;
                      const isTargetSelected = selectedModulePath === edge.target;
                      const isEdgeActive = isSourceSelected || isTargetSelected;

                      const x1 = srcPos.x + srcPos.width;
                      const y1 = srcPos.y + srcPos.height / 2;
                      const x2 = tgtPos.x;
                      const y2 = tgtPos.y + tgtPos.height / 2;

                      const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
                      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                      const strokeColor = edge.is_circular
                        ? '#ef4444'
                        : isEdgeActive
                        ? '#ffd21f'
                        : 'rgba(100, 116, 139, 0.45)';

                      const strokeWidth = isEdgeActive ? 2.5 : Math.min(3.5, 1.2 + edge.dependency_count * 0.2);

                      return (
                        <g key={edge.id}>
                          <path
                            d={pathData}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={edge.is_circular ? '4 3' : 'none'}
                            markerEnd={isEdgeActive ? 'url(#arrow-active)' : 'url(#arrow-normal)'}
                            style={{ transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
                          />
                          {/* Label badge for dependency count */}
                          <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                            <rect
                              x="-18"
                              y="-10"
                              width="36"
                              height="20"
                              rx="5"
                              fill="#101016"
                              stroke={strokeColor}
                              strokeWidth="1"
                            />
                            <text
                              x="0"
                              y="3"
                              textAnchor="middle"
                              fill={isEdgeActive ? '#ffd21f' : '#94a3b8'}
                              fontSize="9"
                              fontWeight="700"
                              fontFamily="sans-serif"
                            >
                              {edge.dependency_count}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* Module Nodes */}
                    {Object.values(moduleLayout.positions).map(({ x, y, width, height, module: mod }) => {
                      const isSelected = selectedModulePath === mod.id;
                      const isExpanded = expandedModules.has(mod.id);
                      const roleStyle = MODULE_ROLE_STYLES[mod.role] || MODULE_ROLE_STYLES.Module;

                      return (
                        <g
                          key={mod.id}
                          transform={`translate(${x}, ${y})`}
                          onClick={() => setSelectedModulePath(mod.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Background Card */}
                          <rect
                            width={width}
                            height={height}
                            rx="12"
                            fill="#101017"
                            stroke={isSelected ? '#ffd21f' : mod.is_circular ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}
                            strokeWidth={isSelected ? 2 : 1}
                            filter={isSelected ? 'drop-shadow(0 0 12px rgba(255, 210, 31, 0.25))' : 'none'}
                          />

                          {/* Header Bar */}
                          <rect width={width} height="36" rx="12" fill={roleStyle.bg} />

                          {/* Role Icon & Label */}
                          <text x="14" y="23" fill={roleStyle.color} fontSize="11" fontWeight="800" fontFamily="sans-serif">
                            {mod.role.toUpperCase()}
                          </text>

                          {/* Expand / Collapse Toggle on Card */}
                          <g
                            transform={`translate(${width - 32}, 9)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedModules((prev) => {
                                const next = new Set(prev);
                                if (next.has(mod.id)) next.delete(mod.id);
                                else next.add(mod.id);
                                return next;
                              });
                            }}
                          >
                            <rect width="20" height="18" rx="4" fill="rgba(255,255,255,0.12)" />
                            <text x="10" y="13" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                              {isExpanded ? '−' : '+'}
                            </text>
                          </g>

                          {/* Module Name */}
                          <text x="14" y="58" fill="#ffffff" fontSize="13.5" fontWeight="700" fontFamily="sans-serif">
                            {mod.name}
                          </text>

                          {/* Relative Path */}
                          <text x="14" y="74" fill="#64748b" fontSize="9.5" fontFamily="monospace">
                            {mod.path.length > 32 ? `${mod.path.slice(0, 30)}...` : mod.path}
                          </text>

                          {/* Stats Chips */}
                          <g transform="translate(14, 84)">
                            {/* Files Count Badge */}
                            <rect x="0" y="0" width="56" height="18" rx="4" fill="rgba(255,255,255,0.05)" />
                            <text x="28" y="12" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="600">
                              {mod.file_count} files
                            </text>

                            {/* Deps Badge */}
                            <rect x="62" y="0" width="70" height="18" rx="4" fill="rgba(56, 189, 248, 0.1)" />
                            <text x="97" y="12" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="600">
                              {mod.total_degree} connections
                            </text>

                            {mod.is_circular && (
                              <g transform="translate(138, 0)">
                                <rect x="0" y="0" width="48" height="18" rx="4" fill="rgba(239, 68, 68, 0.15)" />
                                <text x="24" y="12" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="700">
                                  CYCLE
                                </text>
                              </g>
                            )}
                          </g>

                          {/* Expanded Files View inside Module Container */}
                          {isExpanded && (
                            <g transform="translate(14, 114)">
                              <line x1="0" y1="0" x2={width - 28} y2="0" stroke="rgba(255, 255, 255, 0.08)" />
                              <text x="0" y="15" fill="#94a3b8" fontSize="9" fontWeight="700">
                                KEY FILES (CLICK TO FOCUS)
                              </text>
                              {mod.files.slice(0, 4).map((f, fIdx) => (
                                <g
                                  key={f}
                                  transform={`translate(0, ${24 + fIdx * 20})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenFileConnections(f);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <rect x="0" y="0" width={width - 28} height="18" rx="4" fill="rgba(255, 255, 255, 0.03)" />
                                  <text x="6" y="12" fill="#ffd21f" fontSize="9" fontFamily="monospace">
                                    → {f.split('/').pop()}
                                  </text>
                                </g>
                              ))}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    VIEW B: FILE-LEVEL DEPENDENCY VIEW
                ───────────────────────────────────────────────────────────── */}
                {viewMode === 'file_connections' && fileConnectionLayout.centerNode && (
                  <>
                    {/* Column Headers */}
                    <text x="80" y="36" fill="#8b5cf6" fontSize="12" fontWeight="800" fontFamily="sans-serif">
                      INCOMING DEPENDENTS (FILES IMPORTING THIS)
                    </text>
                    <text x="450" y="36" fill="#ffd21f" fontSize="12" fontWeight="800" fontFamily="sans-serif">
                      SELECTED COMPONENT
                    </text>
                    <text x="740" y="36" fill="#06b6d4" fontSize="12" fontWeight="800" fontFamily="sans-serif">
                      OUTGOING IMPORTS (FILES THIS USES)
                    </text>

                    {/* Incoming Edges (from Incoming Nodes -> Center Node) */}
                    {fileConnectionLayout.incomingNodes.map(({ node, x, y, width, height }) => {
                      const c = fileConnectionLayout.centerNode!;
                      const x1 = x + width;
                      const y1 = y + height / 2;
                      const x2 = c.x;
                      const y2 = c.y + c.height / 2;

                      const dx = (x2 - x1) * 0.45;
                      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                      return (
                        <path
                          key={`in-edge-${node.id}`}
                          d={pathData}
                          fill="none"
                          stroke="#8b5cf6"
                          strokeWidth="2"
                          markerEnd="url(#arrow-purple)"
                        />
                      );
                    })}

                    {/* Outgoing Edges (from Center Node -> Outgoing Nodes) */}
                    {fileConnectionLayout.outgoingNodes.map(({ node, x, y, height }) => {
                      const c = fileConnectionLayout.centerNode!;
                      const x1 = c.x + c.width;
                      const y1 = c.y + c.height / 2;
                      const x2 = x;
                      const y2 = y + height / 2;

                      const dx = (x2 - x1) * 0.45;
                      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                      return (
                        <path
                          key={`out-edge-${node.id}`}
                          d={pathData}
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2"
                          markerEnd="url(#arrow-cyan)"
                        />
                      );
                    })}

                    {/* Incoming Dependent Nodes (Left Column) */}
                    {fileConnectionLayout.incomingNodes.map(({ node, x, y, width, height }) => (
                      <g
                        key={`in-node-${node.id}`}
                        transform={`translate(${x}, ${y})`}
                        onClick={() => setSelectedFile(node.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          width={width}
                          height={height}
                          rx="8"
                          fill="#101016"
                          stroke="rgba(139, 92, 246, 0.4)"
                          strokeWidth="1.2"
                        />
                        <text x="12" y="24" fill="#ffffff" fontSize="12" fontWeight="700">
                          {node.name}
                        </text>
                        <text x="12" y="40" fill="#64748b" fontSize="9" fontFamily="monospace">
                          {node.path.length > 30 ? `...${node.path.slice(-28)}` : node.path}
                        </text>
                        <rect x="12" y="47" width="50" height="12" rx="3" fill="rgba(139, 92, 246, 0.15)" />
                        <text x="37" y="56" textAnchor="middle" fill="#8b5cf6" fontSize="7.5" fontWeight="700">
                          DEPENDENT
                        </text>
                      </g>
                    ))}

                    {/* Outgoing Import Nodes (Right Column) */}
                    {fileConnectionLayout.outgoingNodes.map(({ node, x, y, width, height }) => (
                      <g
                        key={`out-node-${node.id}`}
                        transform={`translate(${x}, ${y})`}
                        onClick={() => setSelectedFile(node.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          width={width}
                          height={height}
                          rx="8"
                          fill="#101016"
                          stroke="rgba(6, 182, 212, 0.4)"
                          strokeWidth="1.2"
                        />
                        <text x="12" y="24" fill="#ffffff" fontSize="12" fontWeight="700">
                          {node.name}
                        </text>
                        <text x="12" y="40" fill="#64748b" fontSize="9" fontFamily="monospace">
                          {node.path.length > 30 ? `...${node.path.slice(-28)}` : node.path}
                        </text>
                        <rect x="12" y="47" width="46" height="12" rx="3" fill="rgba(6, 182, 212, 0.15)" />
                        <text x="35" y="56" textAnchor="middle" fill="#06b6d4" fontSize="7.5" fontWeight="700">
                          IMPORTS
                        </text>
                      </g>
                    ))}

                    {/* Center Focus Node */}
                    {(() => {
                      const c = fileConnectionLayout.centerNode;
                      return (
                        <g transform={`translate(${c.x}, ${c.y})`}>
                          <rect
                            width={c.width}
                            height={c.height}
                            rx="10"
                            fill="#14141d"
                            stroke="#ffd21f"
                            strokeWidth="2.5"
                            filter="drop-shadow(0 0 16px rgba(255, 210, 31, 0.35))"
                          />
                          <text x="14" y="28" fill="#ffd21f" fontSize="14" fontWeight="800">
                            {c.node.name}
                          </text>
                          <text x="14" y="46" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                            {c.node.path.length > 32 ? `...${c.node.path.slice(-30)}` : c.node.path}
                          </text>
                          <g transform="translate(14, 55)">
                            <rect x="0" y="0" width="70" height="16" rx="4" fill="rgba(255, 210, 31, 0.15)" />
                            <text x="35" y="11" textAnchor="middle" fill="#ffd21f" fontSize="8" fontWeight="800">
                              FOCUS COMPONENT
                            </text>
                          </g>
                        </g>
                      );
                    })()}
                  </>
                )}
              </g>
            </svg>
          </Box>

          {/* ─────────────────────────────────────────────────────────────────
              PANE 3 (RIGHT): Component Details Panel
          ───────────────────────────────────────────────────────────────── */}
          <Box
            sx={{
              width: 330,
              minWidth: 280,
              maxWidth: 380,
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              bgcolor: '#09090d',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            {/* Details Panel Header */}
            <Box
              sx={{
                p: 1.8,
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                  {viewMode === 'whole_repo' && currentModule ? 'Module Details' : 'Component Details'}
                </Typography>
                {loadingDetail && <CircularProgress size={13} sx={{ color: '#ffd21f' }} />}
              </Box>

              {viewMode === 'whole_repo' && currentModule && (
                <Chip
                  label="Module"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    bgcolor: 'rgba(255, 210, 31, 0.12)',
                    color: '#ffd21f',
                    fontWeight: 700,
                  }}
                />
              )}
            </Box>

            {/* Details Body */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
              {/* If in Whole Repo mode and Module is selected, show Module Details */}
              {viewMode === 'whole_repo' && currentModule ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.05rem' }}>
                      {currentModule.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', display: 'block', mt: 0.2 }}>
                      {currentModule.path}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, mt: 1 }}>
                      <Chip
                        label={currentModule.role}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          bgcolor: (MODULE_ROLE_STYLES[currentModule.role] || MODULE_ROLE_STYLES.Module).bg,
                          color: (MODULE_ROLE_STYLES[currentModule.role] || MODULE_ROLE_STYLES.Module).color,
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        label={`${currentModule.file_count} files`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(255, 255, 255, 0.06)', color: '#cbd5e1' }}
                      />
                    </Box>
                  </Box>

                  {/* Primary CTA: Open in File Connections */}
                  {currentModule.files.length > 0 && (
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<RouteIcon />}
                      onClick={() => handleOpenFileConnections(currentModule.files[0])}
                      sx={{
                        bgcolor: '#ffd21f',
                        color: '#09090d',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        textTransform: 'none',
                        py: 0.8,
                        borderRadius: '8px',
                        '&:hover': { bgcolor: '#e6bd19' },
                      }}
                    >
                      Explore Files in File Connections
                    </Button>
                  )}

                  {/* Module Files List */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 1 }}>
                      Contained Files ({currentModule.files.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                      {currentModule.files.map((file) => (
                        <Box
                          key={file}
                          onClick={() => handleOpenFileConnections(file)}
                          sx={{
                            p: 0.8,
                            borderRadius: '6px',
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            '&:hover': {
                              bgcolor: 'rgba(255, 210, 31, 0.08)',
                              borderColor: 'rgba(255, 210, 31, 0.3)',
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#e2e8f0', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                            {file.split('/').pop()}
                          </Typography>
                          <ArrowForwardIcon sx={{ fontSize: 13, color: '#ffd21f' }} />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              ) : selectedFile && nodeDetail ? (
                /* Selected File Details */
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* File Heading */}
                  <Box>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.05rem', wordBreak: 'break-all' }}>
                      {nodeDetail.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', display: 'block', mt: 0.2 }}>
                      {nodeDetail.file_path}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={nodeDetail.language}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          bgcolor: getLanguageBadge(nodeDetail.language).bg,
                          color: getLanguageBadge(nodeDetail.language).color,
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        label={`${nodeDetail.line_count} lines`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(255, 255, 255, 0.06)', color: '#cbd5e1' }}
                      />
                      {nodeDetail.is_circular && (
                        <Chip
                          label="Circular"
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700 }}
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Actions: Open in GitHub & Run Impact Analysis */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {nodeDetail.github_url && (
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<GitHubIcon sx={{ fontSize: 15 }} />}
                        href={nodeDetail.github_url}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          borderColor: 'rgba(255, 255, 255, 0.15)',
                          color: '#e2e8f0',
                          fontSize: '0.74rem',
                          textTransform: 'none',
                          py: 0.6,
                          '&:hover': { borderColor: '#ffd21f', color: '#ffd21f' },
                        }}
                      >
                        GitHub
                      </Button>
                    )}

                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<FlashOnIcon sx={{ fontSize: 15 }} />}
                      onClick={() => navigate(`/repository/${id}/impact?file=${encodeURIComponent(nodeDetail.file_path)}`)}
                      sx={{
                        bgcolor: '#ffd21f',
                        color: '#09090d',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        textTransform: 'none',
                        py: 0.6,
                        '&:hover': { bgcolor: '#e6bd19' },
                      }}
                    >
                      Impact Analysis
                    </Button>
                  </Box>

                  {/* Switch to File Connections view button if currently in whole_repo */}
                  {viewMode === 'whole_repo' && (
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      startIcon={<RouteIcon sx={{ fontSize: 15 }} />}
                      onClick={() => handleOpenFileConnections(nodeDetail.file_path)}
                      sx={{
                        borderColor: 'rgba(255, 210, 31, 0.3)',
                        color: '#ffd21f',
                        fontSize: '0.74rem',
                        textTransform: 'none',
                        py: 0.6,
                        '&:hover': { bgcolor: 'rgba(255, 210, 31, 0.08)' },
                      }}
                    >
                      Inspect in File Connections View
                    </Button>
                  )}

                  {/* Incoming Dependencies */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 0.8 }}>
                      Incoming Dependencies ({nodeDetail.incoming_dependencies.length})
                    </Typography>
                    {nodeDetail.incoming_dependencies.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block' }}>
                        No incoming dependents.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {nodeDetail.incoming_dependencies.map((dep, idx) => (
                          <Box
                            key={idx}
                            onClick={() => setSelectedFile(dep.file_path)}
                            sx={{
                              p: 0.8,
                              borderRadius: '6px',
                              bgcolor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'rgba(139, 92, 246, 0.08)',
                                borderColor: 'rgba(139, 92, 246, 0.3)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 600, fontSize: '0.76rem' }}>
                                {dep.file_path.split('/').pop()}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
                                Line {dep.line_number}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>
                              {dep.file_path}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Outgoing Imports */}
                  <Box>
                    <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase', display: 'block', mb: 0.8 }}>
                      Outgoing Imports ({nodeDetail.outgoing_dependencies.length})
                    </Typography>
                    {nodeDetail.outgoing_dependencies.length === 0 ? (
                      <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block' }}>
                        No outgoing dependencies.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        {nodeDetail.outgoing_dependencies.map((dep, idx) => (
                          <Box
                            key={idx}
                            onClick={() => setSelectedFile(dep.file_path)}
                            sx={{
                              p: 0.8,
                              borderRadius: '6px',
                              bgcolor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: 'rgba(6, 182, 212, 0.08)',
                                borderColor: 'rgba(6, 182, 212, 0.3)',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 600, fontSize: '0.76rem' }}>
                                {dep.file_path.split('/').pop()}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem' }}>
                                Line {dep.line_number}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>
                              {dep.file_path}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 36, color: '#64748b', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                    Select a component or module
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                    Click any node in the diagram or file in the repository tree to view dependencies and metrics.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* ─── 4. ARCHITECTURE INSIGHTS SECTION (BELOW WORKSPACE) ───────────── */}
        <Box sx={{ p: 3, bgcolor: '#09090d' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                Architecture Insights
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Structural problems and coupling hotspots detected in your repository.
              </Typography>
            </Box>

            <Button
              size="small"
              onClick={() => setIssuesDrawerOpen(true)}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 600,
                textTransform: 'none',
                px: 1.5,
                '&:hover': { bgcolor: 'rgba(255, 210, 31, 0.1)', borderColor: '#ffd21f', color: '#ffd21f' },
              }}
            >
              View All Issues ({findings?.total_findings || 0})
            </Button>
          </Box>

          {/* 3 Summary Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            {/* Card 1: Circular Dependencies */}
            <Card
              sx={{
                p: 2,
                bgcolor: '#101016',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                    Circular Dependencies
                  </Typography>
                  <Chip
                    label={`${findings?.circular_count || 0} Cycles`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: (findings?.circular_count || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                      color: (findings?.circular_count || 0) > 0 ? '#ef4444' : '#10b981',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 2 }}>
                  Files with mutually recursive import loops that complicate refactoring, testing, and runtime behavior.
                </Typography>
              </Box>

              <Button
                size="small"
                onClick={() => {
                  setIssuesFilterTab('circular');
                  setIssuesDrawerOpen(true);
                }}
                sx={{
                  color: '#ffd21f',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  p: 0,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                Inspect Cycles →
              </Button>
            </Card>

            {/* Card 2: Unresolved Imports */}
            <Card
              sx={{
                p: 2,
                bgcolor: '#101016',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                    Unresolved Imports
                  </Typography>
                  <Chip
                    label={`${findings?.unresolved_count || 0} Issues`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: (findings?.unresolved_count || 0) > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                      color: (findings?.unresolved_count || 0) > 0 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 2 }}>
                  Import statements where target modules could not be found locally or require external dependencies.
                </Typography>
              </Box>

              <Button
                size="small"
                onClick={() => {
                  setIssuesFilterTab('unresolved');
                  setIssuesDrawerOpen(true);
                }}
                sx={{
                  color: '#ffd21f',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  p: 0,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                Inspect Imports →
              </Button>
            </Card>

            {/* Card 3: Highly Connected Files */}
            <Card
              sx={{
                p: 2,
                bgcolor: '#101016',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                    Highly Connected Files
                  </Typography>
                  <Chip
                    label={`${findings?.highly_connected_count || 0} Hubs`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(168, 85, 247, 0.15)',
                      color: '#a855f7',
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 2 }}>
                  Components with unusually high incoming and outgoing links that act as architectural bottlenecks.
                </Typography>
              </Box>

              <Button
                size="small"
                onClick={() => {
                  setIssuesFilterTab('hubs');
                  setIssuesDrawerOpen(true);
                }}
                sx={{
                  color: '#ffd21f',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  p: 0,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                Inspect Hubs →
              </Button>
            </Card>
          </Box>
        </Box>

        {/* ─── 5. ALL ISSUES SLIDING DRAWER ─────────────────────────────────── */}
        <Drawer
          anchor="right"
          open={issuesDrawerOpen}
          onClose={() => setIssuesDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: { xs: '100%', sm: 480 },
                bgcolor: '#0d0d14',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                p: 3,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem' }}>
                Architecture Findings
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {filteredIssuesList.length} issues detected across codebase
              </Typography>
            </Box>
            <IconButton onClick={() => setIssuesDrawerOpen(false)} sx={{ color: '#64748b' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Filter Tabs */}
          <Box sx={{ display: 'flex', gap: 0.8, mb: 2.5, flexWrap: 'wrap' }}>
            {(['all', 'circular', 'unresolved', 'hubs'] as const).map((tab) => (
              <Chip
                key={tab}
                label={tab === 'all' ? 'All Issues' : tab === 'circular' ? 'Circular' : tab === 'unresolved' ? 'Unresolved' : 'Hubs'}
                onClick={() => setIssuesFilterTab(tab)}
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: issuesFilterTab === tab ? 700 : 500,
                  bgcolor: issuesFilterTab === tab ? '#ffd21f' : 'rgba(255, 255, 255, 0.05)',
                  color: issuesFilterTab === tab ? '#09090d' : '#94a3b8',
                  cursor: 'pointer',
                }}
              />
            ))}
          </Box>

          {/* Issues List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflowY: 'auto' }}>
            {filteredIssuesList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#10b981', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  No structural issues in this category.
                </Typography>
              </Box>
            ) : (
              filteredIssuesList.map((issue) => (
                <Card
                  key={issue.id}
                  sx={{
                    p: 2,
                    bgcolor: '#14141d',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {issue.title}
                    </Typography>
                    <Chip
                      label={issue.severity}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: issue.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: issue.severity === 'HIGH' ? '#ef4444' : '#f59e0b',
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 1.5 }}>
                    {issue.description}
                  </Typography>

                  <Box sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', p: 1, borderRadius: '6px', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>
                      Recommendation:
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.72rem' }}>
                      {issue.recommendation}
                    </Typography>
                  </Box>

                  {issue.filePath && (
                    <Button
                      size="small"
                      startIcon={<RouteIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        handleOpenFileConnections(issue.filePath!);
                        setIssuesDrawerOpen(false);
                      }}
                      sx={{
                        color: '#ffd21f',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        p: 0,
                        '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                      }}
                    >
                      Focus in File Connections →
                    </Button>
                  )}
                </Card>
              ))
            )}
          </Box>
        </Drawer>
      </Box>
    </DashboardLayout>
  );
};

export default ArchitectureExplorer;
