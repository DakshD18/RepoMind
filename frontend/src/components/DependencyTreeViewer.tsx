import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Button,
  Collapse,
} from '@mui/material';

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import RadarIcon from '@mui/icons-material/Radar';
import toast from 'react-hot-toast';

import type { DependencyTreeNode } from '../types';

interface DependencyTreeViewerProps {
  rootNode: DependencyTreeNode;
  totalAffected: number;
  directCount: number;
  transitiveCount: number;
  targetMetadata?: {
    language: string;
    line_count: number;
    defined_symbols: string[];
  };
  repoUrl?: string;
  defaultBranch?: string;
  onSelectFile?: (filePath: string) => void;
}

// Get file language and color based on extension
const getFileLanguageDetails = (filePath: string) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return { lang: 'Python', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' };
    case 'ts':
    case 'tsx':
      return { lang: 'TypeScript', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' };
    case 'js':
    case 'jsx':
      return { lang: 'JavaScript', color: '#ffd21f', bg: 'rgba(255, 210, 31, 0.1)' };
    default:
      return { lang: 'Code', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
  }
};

// Relationship style formatting
const getRelationshipBadge = (type?: string) => {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized.includes('call')) {
    return {
      label: 'CALLS FUNCTION',
      color: '#ffd21f',
      border: 'rgba(255, 210, 31, 0.35)',
      bg: 'rgba(255, 210, 31, 0.08)',
    };
  }
  if (normalized.includes('symbol')) {
    return {
      label: 'IMPORTS SYMBOL',
      color: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.35)',
      bg: 'rgba(56, 189, 248, 0.08)',
    };
  }
  return {
    label: 'IMPORTS MODULE',
    color: '#cbd5e1',
    border: 'rgba(203, 213, 225, 0.25)',
    bg: 'rgba(255, 255, 255, 0.05)',
  };
};

// Generate direct GitHub link to file and optional line number
const getGitHubFileUrl = (
  repoUrl?: string,
  defaultBranch?: string,
  filePath?: string,
  lineNumber?: number
): string | null => {
  if (!repoUrl || !filePath) return null;
  const cleanUrl = repoUrl.replace(/\.git\/?$/, '').replace(/\/+$/, '');
  const branch = defaultBranch || 'main';
  let url = `${cleanUrl}/blob/${branch}/${filePath.replace(/^\/+/, '')}`;
  if (lineNumber && lineNumber > 0) {
    url += `#L${lineNumber}`;
  }
  return url;
};

export const DependencyTreeViewer: React.FC<DependencyTreeViewerProps> = ({
  rootNode,
  totalAffected,
  directCount,
  transitiveCount,
  targetMetadata,
  repoUrl,
  defaultBranch,
  onSelectFile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Expand root and depth-1 direct children by default
    const initial = new Set<string>();
    initial.add(`${rootNode.file_path}-0`);
    rootNode.children.forEach((child) => {
      initial.add(`${child.file_path}-1`);
    });
    return initial;
  });
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Collect all unique node keys for Expand All
  const allNodeKeys = useMemo(() => {
    const keys = new Set<string>();
    const traverse = (node: DependencyTreeNode, depth: number) => {
      keys.add(`${node.file_path}-${depth}`);
      node.children.forEach((child) => traverse(child, depth + 1));
    };
    traverse(rootNode, 0);
    return keys;
  }, [rootNode]);

  // Handle Copy Path
  const handleCopy = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    toast.success('Path copied');
    setTimeout(() => setCopiedPath(null), 1800);
  };

  // Toggle node expansion
  const toggleNode = useCallback((nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  // Expand all / Collapse all
  const handleExpandAll = () => setExpandedNodes(new Set(allNodeKeys));
  const handleCollapseAll = () => setExpandedNodes(new Set([`${rootNode.file_path}-0`]));

  // Toggle Symbol Details drawer
  const toggleSymbols = (nodeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // Search Filter Matching Logic: preserves ancestor path
  const searchFilter = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchingKeys = new Set<string>();
    const pathKeysToKeep = new Set<string>();

    const checkNode = (node: DependencyTreeNode, depth: number, currentPath: string[]): boolean => {
      const nodeKey = `${node.file_path}-${depth}`;
      const pathWithCurrent = [...currentPath, nodeKey];

      const matchesFile = node.file_path.toLowerCase().includes(q);
      const matchesSymbols = node.imported_symbols?.some((s) => s.toLowerCase().includes(q));
      const selfMatches = matchesFile || Boolean(matchesSymbols);

      let descendantMatches = false;
      for (const child of node.children) {
        if (checkNode(child, depth + 1, pathWithCurrent)) {
          descendantMatches = true;
        }
      }

      if (selfMatches) {
        matchingKeys.add(nodeKey);
      }

      if (selfMatches || descendantMatches) {
        pathWithCurrent.forEach((k) => pathKeysToKeep.add(k));
        return true;
      }
      return false;
    };

    checkNode(rootNode, 0, []);
    return { matchingKeys, pathKeysToKeep, query: q };
  }, [searchQuery, rootNode]);

  // Target file visual details
  const rootLang = getFileLanguageDetails(rootNode.file_path);
  const targetGhUrl = getGitHubFileUrl(repoUrl, defaultBranch, rootNode.file_path);

  // Helper to split file path into directory and file name with GitHub deep link
  const renderPath = (filePath: string, lineNumber?: number) => {
    const parts = filePath.split('/');
    const fileName = parts.pop() || filePath;
    const dir = parts.length > 0 ? parts.join('/') + '/' : '';
    const ghUrl = getGitHubFileUrl(repoUrl, defaultBranch, filePath, lineNumber);

    return (
      <Tooltip
        title={ghUrl ? (lineNumber ? `Open on GitHub at line ${lineNumber}` : 'Open on GitHub') : ''}
        placement="top"
        arrow
      >
        <Box
          onClick={(e) => {
            if (ghUrl) {
              e.stopPropagation();
              window.open(ghUrl, '_blank', 'noopener,noreferrer');
            }
          }}
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            minWidth: 0,
            overflow: 'hidden',
            cursor: ghUrl ? 'pointer' : 'default',
            borderRadius: '4px',
            transition: 'all 0.15s ease',
            '&:hover': ghUrl
              ? {
                  '& .file-name-text': {
                    color: '#ffd21f',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  },
                }
              : {},
          }}
        >
          {dir && (
            <Typography
              component="span"
              sx={{
                fontFamily: 'monospace',
                fontSize: viewMode === 'compact' ? '0.78rem' : '0.82rem',
                color: '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dir}
            </Typography>
          )}
          <Typography
            component="span"
            className="file-name-text"
            sx={{
              fontFamily: 'monospace',
              fontSize: viewMode === 'compact' ? '0.82rem' : '0.88rem',
              fontWeight: 700,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s ease',
            }}
          >
            {fileName}
          </Typography>
        </Box>
      </Tooltip>
    );
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (
    node: DependencyTreeNode,
    depth: number,
    isLastChild: boolean,
    parentExpanded: boolean
  ): React.ReactNode => {
    if (!parentExpanded && depth > 0) return null;

    const nodeKey = `${node.file_path}-${depth}`;

    // Apply search filter if active
    if (searchFilter && depth > 0 && !searchFilter.pathKeysToKeep.has(nodeKey)) {
      return null;
    }

    const hasChildren = node.children && node.children.length > 0;
    // Auto-expand if search active and node is an ancestor of a match
    const isExpanded = searchFilter ? true : expandedNodes.has(nodeKey);
    const symbolsExpanded = expandedSymbols.has(nodeKey);

    const relBadge = getRelationshipBadge(node.relationship_type);
    const langDetails = getFileLanguageDetails(node.file_path);
    const symbolList = node.imported_symbols || [];
    const nodeGhUrl = getGitHubFileUrl(repoUrl, defaultBranch, node.file_path, node.line_number);

    return (
      <Box key={nodeKey} sx={{ position: 'relative' }}>
        {/* Row Container with clean connector lines */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            position: 'relative',
            mb: viewMode === 'compact' ? 0.6 : 1,
          }}
        >
          {/* Tree Guide Line & Branch Connector */}
          <Box
            sx={{
              width: 20,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* Subtle vertical connector rail (low intensity) */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: isLastChild ? undefined : (viewMode === 'compact' ? -5 : -8),
                height: isLastChild ? (viewMode === 'compact' ? 19 : 23) : undefined,
                width: '1px',
                backgroundColor: 'rgba(255, 210, 31, 0.2)',
              }}
            />
            {/* One small bold and strong yellow line towards each file */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: viewMode === 'compact' ? 18 : 22,
                height: '2px',
                backgroundColor: '#ffd21f',
                boxShadow: '0 0 6px rgba(255, 210, 31, 0.45)',
                borderRadius: '1px',
              }}
            />
          </Box>

          {/* Node Card */}
          <Box
            onClick={() => {
              if (hasChildren) {
                toggleNode(nodeKey);
              } else if (nodeGhUrl) {
                window.open(nodeGhUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(16, 16, 22, 0.75)',
              backdropFilter: 'blur(8px)',
              border: searchFilter?.matchingKeys.has(nodeKey)
                ? '1px solid #ffd21f'
                : '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              p: viewMode === 'compact' ? '6px 12px' : '9px 14px',
              cursor: hasChildren || Boolean(nodeGhUrl) ? 'pointer' : 'default',
              transition: 'all 0.18s ease',
              '&:hover': {
                background: 'rgba(22, 22, 32, 0.95)',
                borderColor: 'rgba(255, 210, 31, 0.4)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
              },
            }}
          >
            {/* Main Single Row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
              {/* Expand / Collapse Button or Leaf Dot */}
              <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {hasChildren ? (
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isExpanded ? '#ffd21f' : '#94a3b8',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        background: 'rgba(255, 210, 31, 0.15)',
                        color: '#ffd21f',
                      },
                    }}
                  >
                    {isExpanded ? (
                      <ExpandMoreIcon sx={{ fontSize: '1.1rem' }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: '1.1rem' }} />
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      }}
                    />
                  </Box>
                )}
              </Box>

              {/* Language Icon */}
              <CodeIcon sx={{ fontSize: '1.05rem', color: langDetails.color, flexShrink: 0 }} />

              {/* File Path */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {renderPath(node.file_path, node.line_number)}
              </Box>

              {/* Right Side Badges */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                {/* Transitive Depth Badge if depth > 1 */}
                {depth > 1 && (
                  <Chip
                    label={`TRANSITIVE • DEPTH ${depth}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      background: 'rgba(148, 163, 184, 0.12)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                  />
                )}

                {/* Relationship Badge */}
                {relBadge && (
                  <Chip
                    label={relBadge.label}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      background: relBadge.bg,
                      color: relBadge.color,
                      border: `1px solid ${relBadge.border}`,
                    }}
                  />
                )}

                {/* Line Number */}
                {node.line_number && (
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      color: '#64748b',
                      px: 0.5,
                    }}
                  >
                    L{node.line_number}
                  </Typography>
                )}

                {/* Symbols Preview / Expand Toggle */}
                {symbolList.length > 0 && viewMode === 'detailed' && (
                  <Box
                    onClick={(e) => toggleSymbols(nodeKey, e)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      px: 0.8,
                      py: 0.2,
                      borderRadius: '6px',
                      background: symbolsExpanded ? 'rgba(255, 210, 31, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: symbolsExpanded ? '1px solid rgba(255, 210, 31, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: '#ffd21f',
                        background: 'rgba(255, 210, 31, 0.1)',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        fontFamily: 'monospace',
                        color: symbolsExpanded ? '#ffd21f' : '#cbd5e1',
                        fontWeight: 600,
                      }}
                    >
                      {symbolList.length === 1 ? symbolList[0] : `${symbolList[0]} +${symbolList.length - 1} more`}
                    </Typography>
                    <ExpandMoreIcon
                      sx={{
                        fontSize: '0.85rem',
                        color: symbolsExpanded ? '#ffd21f' : '#94a3b8',
                        transform: symbolsExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </Box>
                )}

                {/* Transitive Children Count Badge */}
                {hasChildren && (
                  <Chip
                    label={`${node.children.length} dependent${node.children.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      background: 'rgba(255, 210, 31, 0.1)',
                      color: '#ffd21f',
                    }}
                  />
                )}

                {/* Actions: GitHub Open, Copy Path & Impact Analysis */}
                {nodeGhUrl && (
                  <Tooltip title={node.line_number ? `Open on GitHub (Line ${node.line_number})` : 'Open on GitHub'}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(nodeGhUrl, '_blank', 'noopener,noreferrer');
                      }}
                      sx={{
                        p: 0.4,
                        color: '#94a3b8',
                        '&:hover': { color: '#ffd21f', background: 'rgba(255, 210, 31, 0.1)' },
                      }}
                    >
                      <GitHubIcon sx={{ fontSize: '0.88rem' }} />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title={copiedPath === node.file_path ? 'Copied' : 'Copy path'}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopy(node.file_path, e)}
                    sx={{
                      p: 0.4,
                      color: copiedPath === node.file_path ? '#ffd21f' : '#64748b',
                      '&:hover': { color: '#ffffff' },
                    }}
                  >
                    {copiedPath === node.file_path ? (
                      <CheckIcon sx={{ fontSize: '0.85rem' }} />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: '0.85rem' }} />
                    )}
                  </IconButton>
                </Tooltip>

                {onSelectFile && (
                  <Tooltip title="Calculate blast radius for this file">
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<RadarIcon sx={{ fontSize: '0.82rem' }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFile(node.file_path);
                      }}
                      sx={{
                        minWidth: 0,
                        py: 0.2,
                        px: 0.8,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#ffd21f',
                        borderRadius: '6px',
                        background: 'rgba(255, 210, 31, 0.06)',
                        border: '1px solid rgba(255, 210, 31, 0.2)',
                        '&:hover': {
                          background: 'rgba(255, 210, 31, 0.15)',
                          borderColor: '#ffd21f',
                        },
                      }}
                    >
                      Impact
                    </Button>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Expandable Symbols Details Drawer */}
            <Collapse in={symbolsExpanded} timeout="auto" unmountOnExit>
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  mt: 1,
                  pt: 1,
                  borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>
                  REFERENCED SYMBOLS:
                </Typography>
                {symbolList.map((sym) => (
                  <Chip
                    key={sym}
                    label={sym}
                    size="small"
                    sx={{
                      height: 19,
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      background: 'rgba(255, 210, 31, 0.1)',
                      color: '#fef08a',
                      border: '1px solid rgba(255, 210, 31, 0.25)',
                    }}
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        </Box>

        {/* Children Sub-Tree Container */}
        {hasChildren && isExpanded && (
          <Box sx={{ pl: '24px', position: 'relative' }}>
            {node.children.map((child, idx) =>
              renderTreeNode(child, depth + 1, idx === node.children.length - 1, isExpanded)
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      {/* ─── Interactive Tree Toolbar ────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2.5,
          p: 1.5,
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Search Field */}
        <TextField
          size="small"
          placeholder="Filter tree by filename or symbol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            width: { xs: '100%', sm: 300, md: 340 },
            '& .MuiOutlinedInput-root': {
              height: 36,
              fontSize: '0.82rem',
              backgroundColor: 'rgba(10, 10, 14, 0.8)',
              borderRadius: '8px',
              color: '#ffffff',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 210, 31, 0.35)' },
              '&.Mui-focused fieldset': { borderColor: '#ffd21f' },
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.2, color: '#94a3b8' }}>
                    <ClearIcon sx={{ fontSize: '0.9rem' }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        {/* Tree Control Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {searchFilter && (
            <Chip
              label={`Found ${searchFilter.matchingKeys.size} matching file${searchFilter.matchingKeys.size !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(255, 210, 31, 0.12)',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.3)',
              }}
            />
          )}

          <Button
            size="small"
            variant="outlined"
            startIcon={<UnfoldMoreIcon sx={{ fontSize: '0.95rem' }} />}
            onClick={handleExpandAll}
            sx={{
              height: 32,
              fontSize: '0.75rem',
              color: '#cbd5e1',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              '&:hover': { borderColor: '#ffd21f', color: '#ffd21f' },
            }}
          >
            Expand all
          </Button>

          <Button
            size="small"
            variant="outlined"
            startIcon={<UnfoldLessIcon sx={{ fontSize: '0.95rem' }} />}
            onClick={handleCollapseAll}
            sx={{
              height: 32,
              fontSize: '0.75rem',
              color: '#cbd5e1',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              '&:hover': { borderColor: '#ffd21f', color: '#ffd21f' },
            }}
          >
            Collapse all
          </Button>

          <Tooltip title={viewMode === 'detailed' ? 'Switch to Compact view' : 'Switch to Detailed view'}>
            <IconButton
              size="small"
              onClick={() => setViewMode(viewMode === 'detailed' ? 'compact' : 'detailed')}
              sx={{
                height: 32,
                width: 32,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#ffd21f',
                '&:hover': { background: 'rgba(255, 210, 31, 0.08)' },
              }}
            >
              {viewMode === 'detailed' ? (
                <ViewCompactIcon sx={{ fontSize: '1.1rem' }} />
              ) : (
                <ViewHeadlineIcon sx={{ fontSize: '1.1rem' }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ─── Root Node (Target File Card) ──────────────────────────────────── */}
      <Box
        sx={{
          p: 2.2,
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgba(255, 210, 31, 0.08) 0%, rgba(18, 18, 24, 0.95) 100%)',
          border: '1.5px solid rgba(255, 210, 31, 0.55)',
          boxShadow: '0 6px 24px rgba(255, 210, 31, 0.08)',
          position: 'relative',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 0.8,
                borderRadius: '8px',
                background: 'rgba(255, 210, 31, 0.15)',
                color: '#ffd21f',
                display: 'flex',
              }}
            >
              <CodeIcon sx={{ fontSize: '1.3rem' }} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={targetGhUrl ? 'Open target file on GitHub' : ''} arrow>
                  <Typography
                    onClick={() => targetGhUrl && window.open(targetGhUrl, '_blank', 'noopener,noreferrer')}
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: '#ffd21f',
                      letterSpacing: '-0.2px',
                      cursor: targetGhUrl ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      '&:hover': targetGhUrl ? { textDecoration: 'underline', textUnderlineOffset: '3px' } : {},
                    }}
                  >
                    {rootNode.file_path}
                  </Typography>
                </Tooltip>

                {targetGhUrl && (
                  <Tooltip title="Open target file on GitHub">
                    <IconButton
                      size="small"
                      onClick={() => window.open(targetGhUrl, '_blank', 'noopener,noreferrer')}
                      sx={{
                        p: 0.3,
                        color: '#94a3b8',
                        '&:hover': { color: '#ffd21f', background: 'rgba(255, 210, 31, 0.1)' },
                      }}
                    >
                      <GitHubIcon sx={{ fontSize: '0.9rem' }} />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title={copiedPath === rootNode.file_path ? 'Copied' : 'Copy target path'}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopy(rootNode.file_path, e)}
                    sx={{
                      p: 0.3,
                      color: copiedPath === rootNode.file_path ? '#ffd21f' : '#94a3b8',
                      '&:hover': { color: '#ffffff' },
                    }}
                  >
                    {copiedPath === rootNode.file_path ? (
                      <CheckIcon sx={{ fontSize: '0.9rem' }} />
                    ) : (
                      <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 0.4 }}>
                <Chip
                  label={rootLang.lang.toUpperCase()}
                  size="small"
                  sx={{
                    height: 19,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    background: rootLang.bg,
                    color: rootLang.color,
                    border: `1px solid ${rootLang.color}40`,
                  }}
                />

                {targetMetadata && (
                  <Typography sx={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {targetMetadata.line_count} lines • {targetMetadata.defined_symbols.length} defined symbols
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="TARGET FILE"
              sx={{
                height: 26,
                fontSize: '0.72rem',
                fontWeight: 900,
                background: '#ffd21f',
                color: '#050505',
                letterSpacing: '0.8px',
                px: 0.5,
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ─── Vertical Stem linking Target to Direct Dependents ──────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', pl: '12px' }}>
        <Box
          sx={{
            width: '1px',
            height: 18,
            backgroundColor: 'rgba(255, 210, 31, 0.25)',
          }}
        />

        {/* Section Header: Direct Dependents */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            py: 0.5,
            px: 1.4,
            borderRadius: '8px',
            background: 'rgba(255, 210, 31, 0.08)',
            border: '1px solid rgba(255, 210, 31, 0.25)',
            transform: 'translateX(-12px)',
          }}
        >
          <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: '#ffd21f', letterSpacing: '0.8px' }}>
            DIRECT DEPENDENTS ({directCount})
          </Typography>
          {transitiveCount > 0 && (
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              • {transitiveCount} Transitive Cascading
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            width: '1px',
            height: 14,
            backgroundColor: 'rgba(255, 210, 31, 0.25)',
          }}
        />
      </Box>

      {/* ─── Tree Dependents Container ──────────────────────────────────────── */}
      {totalAffected === 0 ? (
        <Box
          sx={{
            p: 3,
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#ffd21f', fontWeight: 700, mb: 0.5 }}>
            Isolated Leaf Module
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.84rem' }}>
            No files in this repository import or depend on <strong>{rootNode.file_path}</strong>. Changes here will not cascade.
          </Typography>
        </Box>
      ) : searchFilter && searchFilter.pathKeysToKeep.size === 0 ? (
        <Box
          sx={{
            p: 3,
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#ffffff', fontWeight: 600, mb: 0.5 }}>
            No matching dependents found
          </Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem', mb: 1.5 }}>
            No dependent files or symbols matched &ldquo;{searchQuery}&rdquo;.
          </Typography>
          <Button size="small" variant="outlined" color="primary" onClick={() => setSearchQuery('')}>
            Clear search filter
          </Button>
        </Box>
      ) : (
        <Box sx={{ position: 'relative', pl: '12px' }}>
          {rootNode.children.map((child, idx) =>
            renderTreeNode(child, 1, idx === rootNode.children.length - 1, true)
          )}
        </Box>
      )}
    </Box>
  );
};

export default DependencyTreeViewer;
