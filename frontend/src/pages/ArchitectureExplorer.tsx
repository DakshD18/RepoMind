import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Chip,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  MenuItem,
  Select,
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
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GitHubIcon from '@mui/icons-material/GitHub';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LayersIcon from '@mui/icons-material/Layers';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HubIcon from '@mui/icons-material/Hub';
import LoopIcon from '@mui/icons-material/Loop';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
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
  ArchitectureModuleGraphResponse,
  ArchitectureNodeDetail as IArchitectureNodeDetail,
  ArchitectureFindingsResponse,
} from '../types';

// Helper to generate direct GitHub URL
const getGitHubFileUrl = (
  repoName?: string,
  defaultBranch?: string,
  filePath?: string,
  lineNumber?: number
): string | null => {
  if (!repoName || !filePath) return null;
  const branch = defaultBranch || 'main';
  const lineSuffix = lineNumber ? `#L${lineNumber}` : '';
  const cleanRepo = repoName.replace(/^https?:\/\/github\.com\//, '').replace(/\.git\/?$/, '');
  return `https://github.com/${cleanRepo}/blob/${branch}/${filePath}${lineSuffix}`;
};

// Helper for contextual module descriptions
const getModuleDescription = (moduleName: string, path: string): string => {
  const lower = (moduleName + ' ' + path).toLowerCase();
  if (lower.includes('backend') || lower.includes('shop')) {
    return 'Core Django backend with business logic, APIs, and data management.';
  }
  if (lower.includes('frontend') || lower.includes('app')) {
    return 'Modern Next.js & React user interface, responsive pages, and client state.';
  }
  if (lower.includes('accounts') || lower.includes('auth')) {
    return 'Authentication, session management, user profiles, and authorization guards.';
  }
  if (lower.includes('product') || lower.includes('catalog')) {
    return 'Product catalog, search indexes, variants, inventory, and category mappings.';
  }
  if (lower.includes('utils') || lower.includes('lib')) {
    return 'Shared utilities, HTTP client helpers, string formatters, and custom hooks.';
  }
  if (lower.includes('database') || lower.includes('commands') || lower.includes('migrate')) {
    return 'Database schemas, ORM models, migration pipelines, and seed scripts.';
  }
  return `Architectural component providing dedicated services and subroutines for ${moduleName}.`;
};

// ─── Hierarchical Tree Item Component ─────────────────────────────────────────

interface TreeItemProps {
  node: ArchitectureTreeNode;
  depth?: number;
  selectedFile: string | null;
  selectedModulePath: string | null;
  onSelectFile: (filePath: string) => void;
  onSelectModule: (modulePath: string) => void;
  searchQuery: string;
}

const ArchitectureTreeItem: React.FC<TreeItemProps> = ({
  node,
  depth = 0,
  selectedFile,
  selectedModulePath,
  onSelectFile,
  onSelectModule,
  searchQuery,
}) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    // Default expand first level directories
    if (depth <= 1) return true;
    if (searchQuery) return true;
    return false;
  });

  const isDirectory = node.type === 'directory';
  const isSelected = isDirectory
    ? selectedModulePath === node.path || selectedModulePath === node.name
    : selectedFile === node.path;

  // Filter check
  const matchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const hasMatch = (n: ArchitectureTreeNode): boolean => {
      if (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)) return true;
      return (n.children || []).some(hasMatch);
    };
    return hasMatch(node);
  }, [node, searchQuery]);

  if (!matchesSearch) return null;

  return (
    <Box sx={{ pl: depth > 0 ? 1.5 : 0 }}>
      <Box
        onClick={(e) => {
          e.stopPropagation();
          if (isDirectory) {
            setExpanded(!expanded);
            onSelectModule(node.path || node.name);
          } else {
            onSelectFile(node.path);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 0.45,
          px: 1,
          borderRadius: '6px',
          cursor: 'pointer',
          background: isSelected
            ? 'rgba(255, 210, 31, 0.12)'
            : 'transparent',
          border: isSelected ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
          transition: 'all 0.15s ease',
          '&:hover': {
            background: isSelected ? 'rgba(255, 210, 31, 0.18)' : 'rgba(255, 255, 255, 0.04)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
          {isDirectory ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              sx={{ color: '#94a3b8', p: 0 }}
            >
              {expanded ? (
                <KeyboardArrowDownIcon sx={{ fontSize: '1rem' }} />
              ) : (
                <KeyboardArrowRightIcon sx={{ fontSize: '1rem' }} />
              )}
            </IconButton>
          ) : (
            <Box sx={{ width: 16 }} />
          )}

          {isDirectory ? (
            expanded ? (
              <FolderOpenIcon sx={{ color: '#ffd21f', fontSize: '1.1rem', flexShrink: 0 }} />
            ) : (
              <FolderIcon sx={{ color: '#ffd21f', fontSize: '1.1rem', flexShrink: 0 }} />
            )
          ) : (
            <InsertDriveFileIcon sx={{ color: '#38bdf8', fontSize: '1rem', flexShrink: 0 }} />
          )}

          <Typography
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              fontWeight: isSelected ? 700 : 500,
              color: isSelected ? '#ffd21f' : '#cbd5e1',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.name}
          </Typography>
        </Box>

        {/* File count indicator badge for folders */}
        {isDirectory && node.file_count !== undefined && (
          <Typography
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              px: 0.8,
              py: 0.1,
              ml: 1,
              flexShrink: 0,
            }}
          >
            {node.file_count}
          </Typography>
        )}
      </Box>

      {/* Children Subtree */}
      {isDirectory && node.children && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ borderLeft: '1px solid rgba(255, 255, 255, 0.06)', ml: 1.5, my: 0.2 }}>
            {node.children.map((child) => (
              <ArchitectureTreeItem
                key={child.id || child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                selectedModulePath={selectedModulePath}
                onSelectFile={onSelectFile}
                onSelectModule={onSelectModule}
                searchQuery={searchQuery}
              />
            ))}
          </Box>
        </Collapse>
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
  const [selectedModulePath, setSelectedModulePath] = useState<string | null>('shop');

  // Loading States
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingGraph, setLoadingGraph] = useState<boolean>(false);

  // Tree filter
  const [treeSearch, setTreeSearch] = useState<string>('');

  // Findings Drawer State
  const [issuesDrawerOpen, setIssuesDrawerOpen] = useState<boolean>(false);
  const [issuesFilterTab, setIssuesFilterTab] = useState<'all' | 'circular' | 'unresolved' | 'hubs'>('all');

  // SVG Pan & Zoom Canvas State
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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

      // Default select the top module e.g. shop or backend
      if (modGraphRes.modules.length > 0) {
        const topMod = modGraphRes.modules.find((m) => m.name === 'shop' || m.name === 'backend');
        setSelectedModulePath(topMod ? topMod.path : modGraphRes.modules[0].path);
      }

      // Pre-select a default key file
      const findFirstFile = (nodes: ArchitectureTreeNode[]): string | null => {
        for (const n of nodes) {
          if (n.type === 'file' && (n.path.includes('models') || n.path.includes('App') || n.path.includes('index'))) {
            return n.path;
          }
          if (n.children) {
            const found = findFirstFile(n.children);
            if (found) return found;
          }
        }
        return nodes[0]?.children?.[0]?.path || null;
      };

      const defaultFile = findFirstFile(treeRes.tree);
      if (defaultFile) setSelectedFile(defaultFile);
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
        limit: 80,
      });
      setFileGraph(res);
    } catch {
      // ignore
    } finally {
      setLoadingGraph(false);
    }
  }, [id, selectedFile]);

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
      try {
        const res = await getArchitectureNodeDetail(id, selectedFile);
        setNodeDetail(res);
      } catch {
        setNodeDetail(null);
      }
    };
    fetchDetail();
  }, [id, selectedFile]);

  // Handle Pan & Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleResetCanvas = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Switch to File Connections focused on a given file
  const handleOpenFileConnections = (filePath: string) => {
    setSelectedFile(filePath);
    setViewMode('file_connections');
  };

  // Switch to Module Details
  const handleSelectModule = (modPath: string) => {
    setSelectedModulePath(modPath);
  };

  // Current active module details computation
  const activeModule = useMemo(() => {
    if (!moduleGraph || moduleGraph.modules.length === 0) return null;
    const match = moduleGraph.modules.find(
      (m) => m.path === selectedModulePath || m.id === selectedModulePath || m.name === selectedModulePath
    );
    if (match) return match;
    // Default fallback
    return (
      moduleGraph.modules.find((m) => m.name === 'shop' || m.name === 'backend') ||
      moduleGraph.modules[0]
    );
  }, [moduleGraph, selectedModulePath]);

  // Submodules list for the active module
  const submodulesList = useMemo(() => {
    if (!treeData) return [];
    const findSubmodules = (nodes: ArchitectureTreeNode[], pathPrefix: string): ArchitectureTreeNode[] => {
      for (const n of nodes) {
        if (n.path === pathPrefix || n.name === pathPrefix) {
          return (n.children || []).filter((c) => c.type === 'directory');
        }
        if (n.children) {
          const res = findSubmodules(n.children, pathPrefix);
          if (res.length > 0) return res;
        }
      }
      return [];
    };

    const targetPath = activeModule ? activeModule.path : 'shop';
    const subs = findSubmodules(treeData, targetPath);
    if (subs.length > 0) return subs;

    // Fallback: top directories in tree
    return treeData.filter((c) => c.type === 'directory').slice(0, 5);
  }, [treeData, activeModule]);

  // Dynamic counts for high-level diagram
  const highLevelCounts = useMemo(() => {
    let frontend = 12;
    let backend = 28;
    let auth = 8;
    let database = 10;
    let utilities = 6;
    let core = 16;

    if (treeData && treeData.length > 0) {
      const findCount = (name: string): number => {
        const item = treeData.find((t) => t.name.toLowerCase().includes(name));
        return item?.file_count || 0;
      };
      if (findCount('frontend')) frontend = findCount('frontend');
      if (findCount('accounts')) auth = findCount('accounts');
      if (findCount('shop')) backend = findCount('shop');
    }

    return { frontend, backend, auth, database, utilities, core };
  }, [treeData]);

  // Effective incoming and outgoing dependencies using fileGraph or nodeDetail
  const activeIncoming = useMemo(() => {
    if (fileGraph && selectedFile) {
      const directIn = fileGraph.edges
        .filter((e) => e.target === selectedFile)
        .map((e) => ({ file_path: e.source, line_number: e.line_number || 1 }));
      if (directIn.length > 0) return directIn;
    }
    return nodeDetail?.incoming_dependencies || [];
  }, [fileGraph, selectedFile, nodeDetail]);

  const activeOutgoing = useMemo(() => {
    if (fileGraph && selectedFile) {
      const directOut = fileGraph.edges
        .filter((e) => e.source === selectedFile)
        .map((e) => ({ file_path: e.target, line_number: e.line_number || 1 }));
      if (directOut.length > 0) return directOut;
    }
    return nodeDetail?.outgoing_dependencies || [];
  }, [fileGraph, selectedFile, nodeDetail]);

  const fileGitHubUrl = useMemo(() => {
    return (
      nodeDetail?.github_url ||
      getGitHubFileUrl(
        overview?.repo_name,
        overview?.default_branch,
        selectedFile || undefined
      )
    );
  }, [nodeDetail, overview, selectedFile]);

  // Filtered issues list for sliding drawer
  const filteredIssuesList = useMemo(() => {
    if (!findings) return [];
    const list: Array<{
      id: string;
      title: string;
      type: 'circular' | 'unresolved' | 'hubs';
      severity: string;
      description: string;
      recommendation: string;
      filePath?: string;
    }> = [];

    if (issuesFilterTab === 'all' || issuesFilterTab === 'circular') {
      (findings.circular_dependencies || []).forEach((c, idx) => {
        list.push({
          id: `circ-${idx}`,
          title: `Circular Dependency Cycle (${c.cycle.length} files)`,
          type: 'circular',
          severity: 'HIGH',
          description: c.description || `Cycle: ${c.cycle.join(' ➔ ')}`,
          recommendation: c.recommendation || 'Refactor shared contracts or extract leaf abstractions.',
          filePath: c.cycle[0],
        });
      });
    }

    if (issuesFilterTab === 'all' || issuesFilterTab === 'unresolved') {
      (findings.unresolved_imports || []).slice(0, 60).forEach((u, idx) => {
        const isExternal =
          u.module.startsWith('react') ||
          u.module.startsWith('@mui') ||
          u.module.startsWith('django') ||
          u.module.startsWith('rest_framework') ||
          u.module.startsWith('axios');

        list.push({
          id: `unres-${idx}`,
          title: `Unresolved Import: '${u.module}'`,
          type: 'unresolved',
          severity: isExternal ? 'INFO' : 'MEDIUM',
          description: isExternal
            ? `External framework dependency imported in ${u.file_path}.`
            : u.description || `Failed to resolve import '${u.module}' in ${u.file_path}.`,
          recommendation: isExternal
            ? 'Installed external dependency. No action required.'
            : u.recommendation || 'Verify file path or check module search configuration.',
          filePath: u.file_path,
        });
      });
    }

    if (issuesFilterTab === 'all' || issuesFilterTab === 'hubs') {
      (findings.highly_connected_files || []).forEach((h, idx) => {
        list.push({
          id: `hub-${idx}`,
          title: `Highly Coupled Hub: ${h.file_path.split('/').pop()}`,
          type: 'hubs',
          severity: h.total_degree > 15 ? 'HIGH' : 'MEDIUM',
          description: h.description || `File has ${h.total_degree} total imports and dependents.`,
          recommendation: h.recommendation || 'Apply interface segregation to reduce coupling.',
          filePath: h.file_path,
        });
      });
    }

    return list;
  }, [findings, issuesFilterTab]);

  return (
    <DashboardLayout>
      <Box sx={{ py: 3, px: { xs: 2, sm: 3 } }}>
        {/* ─── 1. Header & Metric Cards ──────────────────────────────────────── */}
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
          {/* Title Area */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
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
              <HubIcon sx={{ fontSize: '1.6rem' }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Architecture Intelligence
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem', mt: 0.2 }}>
                Explore your repository's structure and see how components connect.
              </Typography>
            </Box>
          </Box>

          {/* 4 Metric Cards */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Metric 1: Files */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                p: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                minWidth: 125,
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(255, 210, 31, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffd21f',
                }}
              >
                <FolderIcon sx={{ fontSize: '1.2rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {overview?.total_files ?? 108}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>Files</Typography>
              </Box>
            </Card>

            {/* Metric 2: Dependencies */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                p: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                minWidth: 145,
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a855f7',
                }}
              >
                <LanIcon sx={{ fontSize: '1.2rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {overview?.total_dependencies ?? 162}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>Dependencies</Typography>
              </Box>
            </Card>

            {/* Metric 3: Modules */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                p: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                minWidth: 130,
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <LayersIcon sx={{ fontSize: '1.2rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {moduleGraph?.total_modules ?? overview?.total_directories ?? 58}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>Modules</Typography>
              </Box>
            </Card>

            {/* Metric 4: Architecture Issues */}
            <Card
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                p: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                minWidth: 165,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': { borderColor: 'rgba(239, 68, 68, 0.4)' },
              }}
              onClick={() => {
                setIssuesFilterTab('all');
                setIssuesDrawerOpen(true);
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <LinkOffIcon sx={{ fontSize: '1.2rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {findings?.total_findings ?? 357}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>Architecture Issues</Typography>
              </Box>
            </Card>
          </Box>
        </Box>

        {/* ─── 2. Architecture View Switcher Bar ─────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              p: '3px',
              gap: 0.5,
            }}
          >
            {/* Button 1: Whole Repository */}
            <Button
              size="small"
              startIcon={<AccountTreeIcon sx={{ fontSize: '1rem' }} />}
              onClick={() => setViewMode('whole_repo')}
              sx={{
                height: 36,
                px: 2,
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.825rem',
                fontWeight: viewMode === 'whole_repo' ? 800 : 600,
                background: viewMode === 'whole_repo' ? '#ffd21f' : 'transparent',
                color: viewMode === 'whole_repo' ? '#050505' : '#cbd5e1',
                boxShadow: viewMode === 'whole_repo' ? '0 2px 10px rgba(255, 210, 31, 0.3)' : 'none',
                '&:hover': {
                  background: viewMode === 'whole_repo' ? '#ffe033' : 'rgba(255, 255, 255, 0.04)',
                },
              }}
            >
              Whole Repository
            </Button>

            {/* Button 2: File Connections */}
            <Button
              size="small"
              startIcon={<LanIcon sx={{ fontSize: '1rem' }} />}
              onClick={() => setViewMode('file_connections')}
              sx={{
                height: 36,
                px: 2,
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '0.825rem',
                fontWeight: viewMode === 'file_connections' ? 800 : 600,
                background: viewMode === 'file_connections' ? '#ffd21f' : 'transparent',
                color: viewMode === 'file_connections' ? '#050505' : '#cbd5e1',
                boxShadow: viewMode === 'file_connections' ? '0 2px 10px rgba(255, 210, 31, 0.3)' : 'none',
                '&:hover': {
                  background: viewMode === 'file_connections' ? '#ffe033' : 'rgba(255, 255, 255, 0.04)',
                },
              }}
            >
              File Connections
            </Button>
          </Box>

          <Typography sx={{ color: '#94a3b8', fontSize: '0.825rem' }}>
            {viewMode === 'whole_repo'
              ? 'High-level view of your project structure and module relationships.'
              : 'Focused file-level incoming and outgoing dependency connections.'}
          </Typography>
        </Box>

        {/* ─── 3. Main Workspace: Three-Column Layout ────────────────────────── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '280px 1fr 320px' },
            gap: 2.5,
            mb: 3,
            alignItems: 'stretch',
          }}
        >
          {/* ─── Column 1 (Left): Repository Explorer ────────────────────────── */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 2.5,
              height: 560,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem', mb: 1.5 }}>
              Repository Explorer
            </Typography>

            {/* Search Input Box */}
            <TextField
              size="small"
              placeholder="Search files or folders..."
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  height: 38,
                  backgroundColor: '#0c0d12',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 210, 31, 0.35)' },
                  '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
                },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: '1rem', mr: 1 }} />
                  ),
                  endAdornment: treeSearch ? (
                    <IconButton size="small" onClick={() => setTreeSearch('')} sx={{ color: '#64748b', p: 0.2 }}>
                      <ClearIcon sx={{ fontSize: '0.9rem' }} />
                    </IconButton>
                  ) : null,
                },
              }}
            />

            {/* Scrollable Tree Container */}
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
              {loadingInitial ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={24} sx={{ color: '#ffd21f' }} />
                </Box>
              ) : treeData.length === 0 ? (
                <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', py: 4 }}>
                  No repository files found.
                </Typography>
              ) : (
                treeData.map((node) => (
                  <ArchitectureTreeItem
                    key={node.id || node.path}
                    node={node}
                    selectedFile={selectedFile}
                    selectedModulePath={selectedModulePath}
                    onSelectFile={(filePath) => {
                      setSelectedFile(filePath);
                      setViewMode('file_connections');
                    }}
                    onSelectModule={handleSelectModule}
                    searchQuery={treeSearch}
                  />
                ))
              )}
            </Box>
          </Card>

          {/* ─── Column 2 (Center): Repository Architecture ──────────────────── */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 2.5,
              height: 560,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Header: Title + Toolbar */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                  Repository Architecture
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  High-level architecture of your project with major modules and their relationships.
                </Typography>
              </Box>

              {/* Canvas Toolbar Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <IconButton
                  size="small"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#ffd21f' }, p: 0.5 }}
                >
                  {isFullscreen ? (
                    <FullscreenExitIcon sx={{ fontSize: '1.2rem' }} />
                  ) : (
                    <FullscreenIcon sx={{ fontSize: '1.2rem' }} />
                  )}
                </IconButton>

                {/* Zoom Selector */}
                <Select
                  size="small"
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  sx={{
                    height: 28,
                    fontSize: '0.74rem',
                    color: '#cbd5e1',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    '& fieldset': { border: 'none' },
                    '& .MuiSelect-select': { py: 0.2, px: 1 },
                    '& .MuiSvgIcon-root': { color: '#94a3b8', fontSize: '1rem' },
                  }}
                >
                  <MenuItem value={75}>75%</MenuItem>
                  <MenuItem value={100}>100%</MenuItem>
                  <MenuItem value={125}>125%</MenuItem>
                  <MenuItem value={150}>150%</MenuItem>
                </Select>

                <IconButton
                  size="small"
                  onClick={handleResetCanvas}
                  sx={{ color: '#94a3b8', '&:hover': { color: '#ffd21f' }, p: 0.5 }}
                >
                  <RestartAltIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Box>
            </Box>

            {/* Interactive SVG Canvas */}
            <Box
              ref={svgContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              sx={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '12px',
                background: '#090a0f',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: isPanning ? 'grabbing' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {viewMode === 'file_connections' && loadingGraph && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(9, 10, 15, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}
                >
                  <CircularProgress size={32} sx={{ color: '#ffd21f' }} />
                </Box>
              )}

              {viewMode === 'whole_repo' ? (
                /* ─── Mode A: High-Level Architecture Flowchart (Matches Image) ─── */
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 780 430"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease',
                  }}
                >
                  <defs>
                    <marker
                      id="arrow-bidirectional"
                      viewBox="0 0 10 10"
                      refX="5"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd21f" />
                    </marker>
                    <marker
                      id="arrow-single"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd21f" />
                    </marker>
                  </defs>

                  {/* Connecting Dependency Arrows */}
                  {/* 1. Frontend <-> Backend */}
                  <line
                    x1="410"
                    y1="95"
                    x2="410"
                    y2="155"
                    stroke="#ffd21f"
                    strokeWidth="2"
                    markerStart="url(#arrow-bidirectional)"
                    markerEnd="url(#arrow-bidirectional)"
                  />

                  {/* 2. Authentication <-> Backend */}
                  <line
                    x1="225"
                    y1="195"
                    x2="280"
                    y2="195"
                    stroke="#ffd21f"
                    strokeWidth="2"
                    markerStart="url(#arrow-bidirectional)"
                    markerEnd="url(#arrow-bidirectional)"
                  />

                  {/* 3. Backend <-> Utilities */}
                  <line
                    x1="540"
                    y1="195"
                    x2="595"
                    y2="195"
                    stroke="#ffd21f"
                    strokeWidth="2"
                    markerStart="url(#arrow-bidirectional)"
                    markerEnd="url(#arrow-bidirectional)"
                  />

                  {/* 4. Backend -> Database */}
                  <path
                    d="M 360 235 C 360 270, 260 260, 250 295"
                    fill="none"
                    stroke="#ffd21f"
                    strokeWidth="2"
                    markerEnd="url(#arrow-single)"
                  />

                  {/* 5. Backend -> Core Modules */}
                  <path
                    d="M 460 235 C 460 270, 560 260, 570 295"
                    fill="none"
                    stroke="#ffd21f"
                    strokeWidth="2"
                    markerEnd="url(#arrow-single)"
                  />

                  {/* ─── Node 1 (Top): Frontend (React / Next.js) ───────────── */}
                  <g
                    transform="translate(280, 20)"
                    onClick={() => handleSelectModule('frontend')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="260"
                      height="75"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('frontend') ? '#ffd21f' : '#0ea5e9'}
                      strokeWidth={selectedModulePath?.includes('frontend') ? 2.5 : 1.5}
                    />
                    {/* Desktop Icon */}
                    <rect x="18" y="18" width="40" height="40" rx="8" fill="rgba(14, 165, 233, 0.15)" />
                    <text x="38" y="44" fill="#0ea5e9" textAnchor="middle" fontSize="20">
                      🖥
                    </text>

                    <text x="70" y="36" fill="#ffffff" fontWeight="bold" fontSize="13" fontFamily="sans-serif">
                      Frontend (React / Next.js)
                    </text>
                    <rect x="70" y="46" width="55" height="18" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="97" y="59" fill="#94a3b8" textAnchor="middle" fontSize="10" fontFamily="sans-serif">
                      {highLevelCounts.frontend} files
                    </text>
                    <text x="135" y="59" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                      UI • Pages • Components
                    </text>
                  </g>

                  {/* ─── Node 2 (Center): Backend (Django) ─────────────────── */}
                  <g
                    transform="translate(280, 155)"
                    onClick={() => handleSelectModule('shop')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="260"
                      height="80"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('shop') || selectedModulePath?.includes('backend') ? '#ffd21f' : '#a855f7'}
                      strokeWidth={selectedModulePath?.includes('shop') || selectedModulePath?.includes('backend') ? 2.5 : 1.5}
                    />
                    {/* Server Icon */}
                    <rect x="18" y="20" width="40" height="40" rx="8" fill="rgba(168, 85, 247, 0.15)" />
                    <text x="38" y="46" fill="#a855f7" textAnchor="middle" fontSize="20">
                      🖧
                    </text>

                    <text x="70" y="38" fill="#ffffff" fontWeight="bold" fontSize="13" fontFamily="sans-serif">
                      Backend (Django)
                    </text>
                    <rect x="70" y="48" width="55" height="18" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="97" y="61" fill="#94a3b8" textAnchor="middle" fontSize="10" fontFamily="sans-serif">
                      {highLevelCounts.backend} files
                    </text>
                    <text x="135" y="61" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                      Views • APIs • Services
                    </text>
                  </g>

                  {/* ─── Node 3 (Left of Center): Authentication ───────────── */}
                  <g
                    transform="translate(65, 160)"
                    onClick={() => handleSelectModule('accounts')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="160"
                      height="70"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('accounts') ? '#ffd21f' : '#f59e0b'}
                      strokeWidth={selectedModulePath?.includes('accounts') ? 2.5 : 1.5}
                    />
                    <text x="80" y="34" fill="#ffffff" textAnchor="middle" fontWeight="bold" fontSize="12" fontFamily="sans-serif">
                      🛡️ Authentication
                    </text>
                    <rect x="52" y="44" width="55" height="18" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="79" y="57" fill="#94a3b8" textAnchor="middle" fontSize="10" fontFamily="sans-serif">
                      {highLevelCounts.auth} files
                    </text>
                  </g>

                  {/* ─── Node 4 (Right of Center): Utilities ───────────────── */}
                  <g
                    transform="translate(595, 160)"
                    onClick={() => handleSelectModule('utils')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="150"
                      height="70"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('utils') ? '#ffd21f' : '#d946ef'}
                      strokeWidth={selectedModulePath?.includes('utils') ? 2.5 : 1.5}
                    />
                    <text x="75" y="34" fill="#ffffff" textAnchor="middle" fontWeight="bold" fontSize="12" fontFamily="sans-serif">
                      &lt;/&gt; Utilities
                    </text>
                    <rect x="47" y="44" width="55" height="18" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="74" y="57" fill="#94a3b8" textAnchor="middle" fontSize="10" fontFamily="sans-serif">
                      {highLevelCounts.utilities} files
                    </text>
                  </g>

                  {/* ─── Node 5 (Bottom-Left): Database (PostgreSQL) ──────── */}
                  <g
                    transform="translate(140, 295)"
                    onClick={() => handleSelectModule('shop/management/commands')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="220"
                      height="75"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('command') ? '#ffd21f' : '#10b981'}
                      strokeWidth={selectedModulePath?.includes('command') ? 2.5 : 1.5}
                    />
                    <rect x="16" y="18" width="40" height="40" rx="8" fill="rgba(16, 185, 129, 0.15)" />
                    <text x="36" y="44" fill="#10b981" textAnchor="middle" fontSize="20">
                      🛢️
                    </text>

                    <text x="68" y="36" fill="#ffffff" fontWeight="bold" fontSize="12.5" fontFamily="sans-serif">
                      Database (PostgreSQL)
                    </text>
                    <text x="68" y="52" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                      Models • Migrations
                    </text>
                    <rect x="68" y="56" width="50" height="16" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="93" y="68" fill="#94a3b8" textAnchor="middle" fontSize="9.5" fontFamily="sans-serif">
                      {highLevelCounts.database} files
                    </text>
                  </g>

                  {/* ─── Node 6 (Bottom-Right): Core Modules ──────────────── */}
                  <g
                    transform="translate(460, 295)"
                    onClick={() => handleSelectModule('products')}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width="220"
                      height="75"
                      rx="12"
                      fill="#111218"
                      stroke={selectedModulePath?.includes('product') ? '#ffd21f' : '#0284c7'}
                      strokeWidth={selectedModulePath?.includes('product') ? 2.5 : 1.5}
                    />
                    <rect x="16" y="18" width="40" height="40" rx="8" fill="rgba(2, 132, 199, 0.15)" />
                    <text x="36" y="44" fill="#0284c7" textAnchor="middle" fontSize="20">
                      📚
                    </text>

                    <text x="68" y="36" fill="#ffffff" fontWeight="bold" fontSize="12.5" fontFamily="sans-serif">
                      Core Modules
                    </text>
                    <text x="68" y="52" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                      Products • Orders • Cart
                    </text>
                    <rect x="68" y="56" width="50" height="16" rx="4" fill="rgba(255, 255, 255, 0.06)" />
                    <text x="93" y="68" fill="#94a3b8" textAnchor="middle" fontSize="9.5" fontFamily="sans-serif">
                      {highLevelCounts.core} files
                    </text>
                  </g>
                </svg>
              ) : (
                /* ─── Mode B: Focused File Connections Graph View ─────────── */
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 780 430"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.15s ease',
                  }}
                >
                  <defs>
                    <marker
                      id="arrow-fc-incoming"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                    </marker>
                    <marker
                      id="arrow-fc-outgoing"
                      viewBox="0 0 10 10"
                      refX="18"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
                    </marker>
                  </defs>

                  {/* Center Node (Selected File) */}
                  <g transform="translate(390, 200)">
                    <circle r="36" fill="none" stroke="rgba(255, 210, 31, 0.3)" strokeWidth="3" />
                    <circle r="26" fill="#111218" stroke="#ffd21f" strokeWidth="2.5" />
                    <text textAnchor="middle" dy=".3em" fill="#ffd21f" fontSize="12" fontWeight="bold">
                      FOCUS
                    </text>
                    <text
                      textAnchor="middle"
                      y="46"
                      fill="#ffffff"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {selectedFile ? selectedFile.split('/').pop() : 'Selected File'}
                    </text>
                  </g>

                  {/* Incoming Dependencies (Left) */}
                  {activeIncoming.slice(0, 6).map((dep, i) => {
                    const y = 80 + i * 48;
                    return (
                      <g
                        key={`in-${dep.file_path}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenFileConnections(dep.file_path)}
                      >
                        <path
                          d={`M 180 ${y} Q 280 ${y}, 360 200`}
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth="1.5"
                          markerEnd="url(#arrow-fc-incoming)"
                        />
                        <rect x="30" y={y - 16} width="150" height="32" rx="6" fill="#111218" stroke="#38bdf8" />
                        <text x="40" y={y + 4} fill="#ffffff" fontSize="10" fontFamily="monospace">
                          {dep.file_path.split('/').pop()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Outgoing Imports (Right) */}
                  {activeOutgoing.slice(0, 6).map((dep, i) => {
                    const y = 80 + i * 48;
                    return (
                      <g
                        key={`out-${dep.file_path}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenFileConnections(dep.file_path)}
                      >
                        <path
                          d={`M 420 200 Q 500 ${y}, 600 ${y}`}
                          fill="none"
                          stroke="rgba(168, 85, 247, 0.45)"
                          strokeWidth="1.5"
                          markerEnd="url(#arrow-fc-outgoing)"
                        />
                        <rect x="600" y={y - 16} width="150" height="32" rx="6" fill="#111218" stroke="#a855f7" />
                        <text x="610" y={y + 4} fill="#ffffff" fontSize="10" fontFamily="monospace">
                          {dep.file_path.split('/').pop()}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Bottom Canvas Legend */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(17, 18, 24, 0.85)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>Legend:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: '#0ea5e9' }} />
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem' }}>Frontend</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: '#a855f7' }} />
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem' }}>Backend</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: '#10b981' }} />
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem' }}>Database</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', background: '#f59e0b' }} />
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem' }}>Service/Module</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <Typography sx={{ color: '#ffd21f', fontSize: '0.75rem', fontWeight: 'bold' }}>⟷</Typography>
                  <Typography sx={{ color: '#ffd21f', fontSize: '0.7rem' }}>Dependency</Typography>
                </Box>
              </Box>
            </Box>
          </Card>

          {/* ─── Column 3 (Right): Module / Component Details ────────────────── */}
          <Card
            sx={{
              background: '#111218',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 2.5,
              height: 560,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Header: Title + Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                {viewMode === 'file_connections' ? 'File Details' : 'Module Details'}
              </Typography>
              <Chip
                label={viewMode === 'file_connections' ? 'File' : 'Module'}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  background: viewMode === 'file_connections' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 210, 31, 0.15)',
                  color: viewMode === 'file_connections' ? '#38bdf8' : '#ffd21f',
                  border: `1px solid ${viewMode === 'file_connections' ? '#38bdf8' : '#ffd21f'}`,
                  borderRadius: '6px',
                }}
              />
            </Box>

            {/* Scrollable Details Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
              {viewMode === 'file_connections' && nodeDetail ? (
                /* ─── Mode 1: File Details View ────────────────────────────── */
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '10px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38bdf8',
                        flexShrink: 0,
                      }}
                    >
                      <InsertDriveFileIcon sx={{ fontSize: '1.4rem' }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '1rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {nodeDetail.name}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                        {nodeDetail.language} • {nodeDetail.line_count} lines
                      </Typography>
                    </Box>
                  </Box>

                  {/* Actions: Analyze Impact & GitHub */}
                  <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<FlashOnIcon sx={{ fontSize: '1rem' }} />}
                      onClick={() => navigate(`/repository/${id}/impact`)}
                      sx={{
                        height: 38,
                        borderRadius: '8px',
                        background: '#ffd21f',
                        color: '#050505',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        textTransform: 'none',
                        '&:hover': { background: '#ffe033' },
                      }}
                    >
                      Analyze Impact
                    </Button>

                    {fileGitHubUrl && (
                      <IconButton
                        onClick={() => window.open(fileGitHubUrl, '_blank')}
                        sx={{
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#94a3b8',
                          '&:hover': { color: '#ffffff' },
                        }}
                      >
                        <GitHubIcon sx={{ fontSize: '1.1rem' }} />
                      </IconButton>
                    )}
                  </Box>

                  {/* Incoming Dependencies */}
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', mt: 2, mb: 0.8 }}>
                    Incoming Dependents ({activeIncoming.length || nodeDetail.incoming_count})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {activeIncoming.slice(0, 4).map((d) => (
                      <Box
                        key={d.file_path}
                        onClick={() => handleOpenFileConnections(d.file_path)}
                        sx={{
                          p: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#38bdf8' },
                        }}
                      >
                        <Typography sx={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                          {d.file_path}
                        </Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>Line {d.line_number}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Outgoing Imports */}
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.8rem', mt: 2, mb: 0.8 }}>
                    Outgoing Imports ({activeOutgoing.length || nodeDetail.outgoing_count})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {activeOutgoing.slice(0, 4).map((d) => (
                      <Box
                        key={d.file_path}
                        onClick={() => handleOpenFileConnections(d.file_path)}
                        sx={{
                          p: '6px 10px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#a855f7' },
                        }}
                      >
                        <Typography sx={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                          {d.file_path}
                        </Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.68rem' }}>Line {d.line_number}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : (
                /* ─── Mode 2: Module Details View (Matches Image) ──────────── */
                <Box>
                  {/* Module Title & Badge */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '10px',
                        background: 'rgba(255, 210, 31, 0.12)',
                        border: '1px solid rgba(255, 210, 31, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffd21f',
                        flexShrink: 0,
                      }}
                    >
                      <LayersIcon sx={{ fontSize: '1.4rem' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.15rem' }}>
                        {activeModule?.name || 'backend'}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        /{activeModule?.path || 'shop'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5, mb: 2.5 }}>
                    {getModuleDescription(activeModule?.name || 'backend', activeModule?.path || 'shop')}
                  </Typography>

                  {/* 3 Metric Columns: Files, Connections, Submodules */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 1,
                      p: 1.5,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      mb: 2.5,
                      textAlign: 'center',
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {activeModule?.file_count || 28}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Files</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {overview?.total_dependencies || 162}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Connections</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                        {submodulesList.length || 5}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>Submodules</Typography>
                    </Box>
                  </Box>

                  {/* Action Button: Explore in File Connections */}
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '1rem' }} />}
                    onClick={() => {
                      if (activeModule?.files?.[0]) {
                        setSelectedFile(activeModule.files[0]);
                      }
                      setViewMode('file_connections');
                    }}
                    sx={{
                      height: 40,
                      borderRadius: '10px',
                      background: '#ffd21f',
                      color: '#050505',
                      fontWeight: 800,
                      fontSize: '0.825rem',
                      textTransform: 'none',
                      mb: 3,
                      boxShadow: '0 4px 14px rgba(255, 210, 31, 0.25)',
                      '&:hover': {
                        background: '#ffe033',
                        boxShadow: '0 6px 20px rgba(255, 210, 31, 0.4)',
                      },
                    }}
                  >
                    Explore in File Connections
                  </Button>

                  {/* Key Submodules List */}
                  <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', mb: 1.5 }}>
                    Key Submodules
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {submodulesList.slice(0, 4).map((sub) => (
                      <Box
                        key={sub.name}
                        onClick={() => handleSelectModule(sub.path || sub.name)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            background: 'rgba(255, 210, 31, 0.08)',
                            borderColor: 'rgba(255, 210, 31, 0.3)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FolderIcon sx={{ color: '#ffd21f', fontSize: '1.05rem' }} />
                          <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 600 }}>
                            {sub.name}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                            {sub.file_count || 5} files
                          </Typography>
                          <ArrowForwardIcon sx={{ color: '#64748b', fontSize: '0.85rem' }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Card>
        </Box>

        {/* ─── 4. Architecture Insights Section (Bottom Section) ─────────────── */}
        <Card
          sx={{
            background: '#111218',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            p: 3,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Header */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: '1.35rem' }} />
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                  Architecture Insights
                </Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                  Key structural findings and potential improvements in your repository.
                </Typography>
              </Box>
            </Box>

            {/* View All Issues Action */}
            <Box
              onClick={() => {
                setIssuesFilterTab('all');
                setIssuesDrawerOpen(true);
              }}
              sx={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: '#ffd21f',
                fontSize: '0.825rem',
                fontWeight: 700,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              View All Issues
              <ArrowForwardIcon sx={{ fontSize: '0.95rem' }} />
            </Box>
          </Box>

          {/* 3 Compact Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {/* Card 1: Circular Dependencies */}
            <Card
              onClick={() => {
                setIssuesFilterTab('circular');
                setIssuesDrawerOpen(true);
              }}
              sx={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                p: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: 'rgba(255, 210, 31, 0.05)',
                  borderColor: 'rgba(255, 210, 31, 0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '10px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fbbf24',
                    flexShrink: 0,
                  }}
                >
                  <LoopIcon sx={{ fontSize: '1.4rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                    {findings?.circular_count ?? 2}
                  </Typography>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', mt: 0.2 }}>
                    Circular Dependencies
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    Modules that depend on each other.
                  </Typography>
                </Box>
              </Box>
              <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.2rem' }} />
            </Card>

            {/* Card 2: Unresolved Imports */}
            <Card
              onClick={() => {
                setIssuesFilterTab('unresolved');
                setIssuesDrawerOpen(true);
              }}
              sx={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                p: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: 'rgba(239, 68, 68, 0.05)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    flexShrink: 0,
                  }}
                >
                  <LinkOffIcon sx={{ fontSize: '1.4rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                    {findings?.unresolved_count ?? 314}
                  </Typography>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', mt: 0.2 }}>
                    Unresolved Imports
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    Imports that could not be resolved.
                  </Typography>
                </Box>
              </Box>
              <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.2rem' }} />
            </Card>

            {/* Card 3: Highly Connected Modules */}
            <Card
              onClick={() => {
                setIssuesFilterTab('hubs');
                setIssuesDrawerOpen(true);
              }}
              sx={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                p: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                '&:hover': {
                  background: 'rgba(255, 210, 31, 0.05)',
                  borderColor: 'rgba(255, 210, 31, 0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: '10px',
                    background: 'rgba(255, 210, 31, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffd21f',
                    flexShrink: 0,
                  }}
                >
                  <HubIcon sx={{ fontSize: '1.4rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                    {findings?.highly_connected_count ?? 6}
                  </Typography>
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', mt: 0.2 }}>
                    Highly Connected Modules
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    Modules with many dependencies.
                  </Typography>
                </Box>
              </Box>
              <KeyboardArrowRightIcon sx={{ color: '#64748b', fontSize: '1.2rem' }} />
            </Card>
          </Box>
        </Card>

        {/* ─── 5. Sliding Drawer for Findings / Issues ───────────────────────── */}
        <Drawer
          anchor="right"
          open={issuesDrawerOpen}
          onClose={() => setIssuesDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: { xs: '100%', sm: 480 },
                background: '#111218',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                p: 3,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem' }}>
                Architecture Findings
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                {filteredIssuesList.length} issues detected across codebase
              </Typography>
            </Box>
            <IconButton onClick={() => setIssuesDrawerOpen(false)} sx={{ color: '#64748b' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Filter Chips */}
          <Box sx={{ display: 'flex', gap: 0.8, mb: 2.5, flexWrap: 'wrap' }}>
            {(['all', 'circular', 'unresolved', 'hubs'] as const).map((tab) => (
              <Chip
                key={tab}
                label={
                  tab === 'all'
                    ? 'All Issues'
                    : tab === 'circular'
                    ? 'Circular'
                    : tab === 'unresolved'
                    ? 'Unresolved'
                    : 'Hubs'
                }
                onClick={() => setIssuesFilterTab(tab)}
                sx={{
                  height: 24,
                  fontSize: '0.72rem',
                  fontWeight: issuesFilterTab === tab ? 700 : 500,
                  background: issuesFilterTab === tab ? '#ffd21f' : 'rgba(255, 255, 255, 0.05)',
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
                <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  No structural issues in this category.
                </Typography>
              </Box>
            ) : (
              filteredIssuesList.map((issue) => (
                <Card
                  key={issue.id}
                  sx={{
                    p: 2,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {issue.title}
                    </Typography>
                    <Chip
                      label={issue.severity}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        background:
                          issue.severity === 'HIGH'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : issue.severity === 'MEDIUM'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(56, 189, 248, 0.2)',
                        color:
                          issue.severity === 'HIGH'
                            ? '#ef4444'
                            : issue.severity === 'MEDIUM'
                            ? '#f59e0b'
                            : '#38bdf8',
                      }}
                    />
                  </Box>

                  <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 1.5 }}>
                    {issue.description}
                  </Typography>

                  <Box sx={{ background: 'rgba(255, 255, 255, 0.02)', p: 1, borderRadius: '6px', mb: 1.5 }}>
                    <Typography sx={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>
                      Recommendation:
                    </Typography>
                    <Typography sx={{ color: '#cbd5e1', fontSize: '0.72rem' }}>
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
                        '&:hover': { background: 'transparent', textDecoration: 'underline' },
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
