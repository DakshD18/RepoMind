import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  Typography,
  Card,
  InputBase,
  IconButton,
  CircularProgress,
  Tooltip,
  Alert,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';

import GitHubIcon from '@mui/icons-material/GitHub';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import AddIcon from '@mui/icons-material/Add';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import LayersIcon from '@mui/icons-material/Layers';
import toast from 'react-hot-toast';

import { DashboardLayout } from '../layouts/DashboardLayout';
import type { Repository, ChatSession, ChatMessage, SourceReference, ChatResponse } from '../types';
import {
  getRepository,
  getChatSessions,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
  indexRepository,
} from '../services/api';

// ─── Format Relative Time Helper ─────────────────────────────────────────────

const formatRelativeTime = (dateStr?: string | null): string => {
  if (!dateStr) return '21d ago';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  } catch {
    return 'Recently';
  }
};

// ─── Markdown Code Block with Syntax Highlighting & Copy Button ──────────────

const CodeBlock = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (match) {
    return (
      <Box sx={{ position: 'relative', my: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 0.8,
            background: '#0e0e14',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottom: 'none',
            borderRadius: '10px 10px 0 0',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: '#ffd21f',
              fontFamily: 'monospace',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {match[1]}
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy Code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{ color: copied ? '#10b981' : '#94a3b8', p: 0.4, '&:hover': { color: '#ffffff' } }}
            >
              {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        <SyntaxHighlighter
          style={vscDarkPlus as Record<string, React.CSSProperties>}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: '0 0 10px 10px',
            fontSize: '0.82rem',
            backgroundColor: '#07070b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            lineHeight: 1.6,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </Box>
    );
  }
  return (
    <code
      style={{
        background: 'rgba(255, 210, 31, 0.08)',
        color: '#ffd21f',
        border: '1px solid rgba(255, 210, 31, 0.25)',
        padding: '2px 6px',
        borderRadius: 5,
        fontSize: '0.85em',
        fontFamily: 'monospace',
      }}
    >
      {children}
    </code>
  );
};

const markdownComponents = {
  code: CodeBlock,
};

// ─── Source Reference Card ───────────────────────────────────────────────────

const SourceCard = ({ source, repository }: { source: SourceReference; repository?: Repository | null }) => {
  if (source.symbol_type === 'commit' && source.commit_sha) {
    const shortSha = source.commit_sha.slice(0, 7);
    const date = source.committed_date ? source.committed_date.slice(0, 10) : '';
    const commitUrl = repository
      ? `https://github.com/${repository.owner}/${repository.name}/commit/${source.commit_sha}`
      : '';

    return (
      <Box
        component={commitUrl ? 'a' : 'div'}
        href={commitUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.8,
          px: 1.4,
          py: 0.5,
          borderRadius: '8px',
          background: 'rgba(18, 18, 24, 0.85)',
          border: '1px solid rgba(255, 210, 31, 0.35)',
          cursor: commitUrl ? 'pointer' : 'default',
          textDecoration: 'none',
          transition: 'all 0.18s ease',
          '&:hover': {
            borderColor: '#ffd21f',
            background: 'rgba(24, 24, 34, 0.95)',
          },
        }}
      >
        <HistoryIcon sx={{ fontSize: 14, color: '#ffd21f' }} />
        <Typography sx={{ fontSize: '0.725rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
          <span style={{ color: '#ffd21f', fontWeight: 700 }}>{shortSha}</span>
          {source.author_name && <span style={{ color: '#94a3b8', marginLeft: 6 }}>by {source.author_name}</span>}
          {date && <span style={{ color: '#64748b', marginLeft: 6 }}>{date}</span>}
        </Typography>
      </Box>
    );
  }

  const fileName = source.file_path.split('/').pop() || source.file_path;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.8,
        px: 1.4,
        py: 0.5,
        borderRadius: '8px',
        background: 'rgba(18, 18, 24, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.18s ease',
        '&:hover': {
          borderColor: 'rgba(255, 210, 31, 0.45)',
          background: 'rgba(24, 24, 34, 0.95)',
        },
      }}
    >
      <CodeIcon sx={{ fontSize: 14, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.725rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
        {fileName}
        {source.symbol_name && <span style={{ color: '#ffd21f', marginLeft: 4 }}>— {source.symbol_name}()</span>}
        {source.start_line > 0 && (
          <span style={{ color: '#64748b', marginLeft: 4 }}>
            L{source.start_line}–{source.end_line}
          </span>
        )}
      </Typography>
    </Box>
  );
};

// ─── Message Bubble ──────────────────────────────────────────────────────────

const MessageBubble = ({ message, repository }: { message: ChatMessage; repository?: Repository | null }) => {
  const isUser = message.role === 'user';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6, px: 0.5 }}>
        {!isUser && <AutoAwesomeIcon sx={{ fontSize: 13, color: '#ffd21f' }} />}
        <Typography
          sx={{
            fontSize: '0.68rem',
            color: isUser ? '#64748b' : '#ffd21f',
            fontWeight: 800,
            letterSpacing: '0.08em',
          }}
        >
          {isUser ? 'YOU' : 'REPOMIND AI'}
        </Typography>
      </Box>

      <Box
        sx={{
          maxWidth: { xs: '90%', md: '84%' },
          px: 2.8,
          py: 2,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? '#181822' : '#111218',
          border: isUser ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 210, 31, 0.22)',
          color: '#e2e8f0',
          fontSize: '0.9rem',
          lineHeight: 1.7,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          '& p': { margin: '6px 0' },
          '& h1, & h2, & h3': { color: '#ffffff', marginTop: '14px', marginBottom: '6px', fontWeight: 700 },
          '& ul, & ol': { paddingLeft: '22px', margin: '8px 0' },
          '& li': { marginBottom: '3px' },
          '& a': { color: '#ffd21f', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#ffffff', whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        )}
      </Box>

      {!isUser && message.sources && message.sources.length > 0 && (
        <Box sx={{ mt: 1.4, display: 'flex', flexWrap: 'wrap', gap: 0.8, maxWidth: { xs: '90%', md: '84%' } }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#64748b', width: '100%', mb: 0.2, fontWeight: 700 }}>
            VERIFIED REPOSITORY CITATIONS ({message.sources.length})
          </Typography>
          {message.sources.map((src, idx) => (
            <SourceCard key={idx} source={src} repository={repository} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Loading Message ─────────────────────────────────────────────────────────

const LoadingMessage = ({ stage }: { stage: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6, px: 0.5 }}>
      <AutoAwesomeIcon sx={{ fontSize: 13, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f', fontWeight: 800 }}>REPOMIND AI</Typography>
    </Box>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.6,
        px: 2.5,
        py: 1.8,
        borderRadius: '16px 16px 16px 4px',
        background: '#111218',
        border: '1px solid rgba(255, 210, 31, 0.3)',
      }}
    >
      <CircularProgress size={16} sx={{ color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>{stage}</Typography>
    </Box>
  </Box>
);

const LOADING_STAGES = [
  'Searching repository knowledge graph...',
  'Analyzing relevant AST and symbols...',
  'Synthesizing grounded developer response...',
];

// ─── 4 Suggested Exploration Cards (Matches Reference Image) ─────────────────

const SUGGESTED_PROMPTS = [
  {
    title: 'Understand Code',
    desc: 'How does the authentication flow work?',
    icon: CodeIcon,
  },
  {
    title: 'Explore Structure',
    desc: 'What are the main modules and how do they connect?',
    icon: AccountTreeOutlinedIcon,
  },
  {
    title: 'Find Issues',
    desc: 'Are there any potential code quality issues?',
    icon: ShieldOutlinedIcon,
  },
  {
    title: 'Analyze Changes',
    desc: 'What will be the impact of changing this file?',
    icon: FlashOnIcon,
  },
];

// ─── Main RepositoryChat Component ───────────────────────────────────────────

export const RepositoryChat: React.FC = () => {
  const { id, sessionId: sessionIdParam } = useParams<{ id: string; sessionId?: string }>();
  const navigate = useNavigate();
  const repoId = parseInt(id || '0', 10);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Core State
  const [repository, setRepository] = useState<Repository | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    sessionIdParam ? parseInt(sessionIdParam, 10) : null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(LOADING_STAGES[0]);
  const [loadingRepo, setLoadingRepo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);

  // Session Action Menu
  const [sessionMenuAnchor, setSessionMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTargetSessionId, setMenuTargetSessionId] = useState<number | null>(null);

  // 1. Load repository info
  useEffect(() => {
    if (!repoId) return;
    setLoadingRepo(true);
    getRepository(repoId)
      .then(setRepository)
      .catch(() => setError('Repository not found.'))
      .finally(() => setLoadingRepo(false));
  }, [repoId]);

  // 2. Load sessions list
  const loadSessions = useCallback(() => {
    if (!repoId) return;
    getChatSessions(repoId).then(setSessions).catch(() => {});
  }, [repoId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 3. Load active session messages
  useEffect(() => {
    if (!activeSessionId || !repoId) {
      setMessages([]);
      return;
    }
    getChatSession(repoId, activeSessionId)
      .then((session) => {
        setMessages(session.messages || []);
        navigate(`/repository/${repoId}/chat/${activeSessionId}`, { replace: true });
      })
      .catch(() => {
        setActiveSessionId(null);
        setMessages([]);
      });
  }, [activeSessionId, repoId, navigate]);

  // 4. Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 5. Stage rotation
  useEffect(() => {
    if (!loading) return;
    let idx = 0;
    setLoadingStage(LOADING_STAGES[0]);
    const timer = setInterval(() => {
      idx = (idx + 1) % LOADING_STAGES.length;
      setLoadingStage(LOADING_STAGES[idx]);
    }, 1800);
    return () => clearInterval(timer);
  }, [loading]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    navigate(`/repository/${repoId}/chat`, { replace: true });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSelectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId: number) => {
    await deleteChatSession(repoId, sessionId).catch(() => {});
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      navigate(`/repository/${repoId}/chat`, { replace: true });
    }
    loadSessions();
    setSessionMenuAnchor(null);
  };

  const executeSend = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session: activeSessionId || 0,
      role: 'user',
      content: text,
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response: ChatResponse = await sendChatMessage(repoId, text, activeSessionId);

      if (!activeSessionId || activeSessionId !== response.session_id) {
        setActiveSessionId(response.session_id);
        navigate(`/repository/${repoId}/chat/${response.session_id}`, { replace: true });
      }

      const assistantMsg: ChatMessage = {
        id: response.message_id,
        session: response.session_id,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      loadSessions();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; code?: string } } };
      const status = axiosErr?.response?.status;
      const errData = axiosErr?.response?.data;

      if (status === 409 && errData?.code === 'not_indexed') {
        setError("This repository hasn't been indexed yet. Click 'Index Repository' to enable AI analysis.");
      } else {
        setError(errData?.error || 'Something went wrong. Please try again.');
      }
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    executeSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleIndex = async () => {
    setIndexing(true);
    try {
      await indexRepository(repoId);
      setRepository((prev) => (prev ? { ...prev, index_status: 'indexing' } : prev));
      const poll = setInterval(async () => {
        const updated = await getRepository(repoId);
        setRepository(updated);
        if (updated.is_indexed) {
          clearInterval(poll);
          setIndexing(false);
          setError(null);
        } else if (updated.index_status === 'failed') {
          clearInterval(poll);
          setIndexing(false);
          setError(`Indexing failed: ${updated.index_error}`);
        }
      }, 3000);
    } catch {
      setIndexing(false);
      setError('Failed to start indexing.');
    }
  };

  // Group conversations by date
  const groupedSessions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = today - 6 * 86400000;

    const todayList: ChatSession[] = [];
    const thisWeekList: ChatSession[] = [];
    const olderList: ChatSession[] = [];

    sessions.forEach((s) => {
      const time = new Date(s.updated_at || s.created_at).getTime();
      if (time >= today) {
        todayList.push(s);
      } else if (time >= oneWeekAgo) {
        thisWeekList.push(s);
      } else {
        olderList.push(s);
      }
    });

    return { today: todayList, thisWeek: thisWeekList, older: olderList };
  }, [sessions]);

  if (loadingRepo) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '65vh' }}>
          <CircularProgress sx={{ color: '#FFD21F' }} />
        </Box>
      </DashboardLayout>
    );
  }

  const isIndexed = repository?.is_indexed;
  const isIndexing = repository?.index_status === 'indexing' || indexing;

  return (
    <DashboardLayout>
      <Box
        sx={{
          display: 'flex',
          height: 'calc(100vh - 60px)',
          overflow: 'hidden',
          background: '#090a0f',
        }}
      >
        {/* ─── 1. Left Panel — Conversations Sidebar ─────────────────────────── */}
        <Box
          sx={{
            width: { xs: 240, md: 260 },
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#0c0d12',
            display: { xs: 'none', sm: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2.2, pb: 1.5 }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
              Repository Chat
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mt: 0.4 }}>
              Ask questions about your codebase with grounded, repo-aware answers.
            </Typography>
          </Box>

          {/* New Chat Button */}
          <Box sx={{ px: 2, pb: 2 }}>
            <Button
              fullWidth
              startIcon={<AddIcon />}
              onClick={handleNewChat}
              sx={{
                background: '#FFD21F',
                color: '#050505',
                borderRadius: '8px',
                height: 38,
                fontSize: '0.825rem',
                fontWeight: 800,
                textTransform: 'none',
                boxShadow: '0 2px 10px rgba(255, 210, 31, 0.25)',
                '&:hover': { background: '#FFE033' },
              }}
            >
              New Chat
            </Button>
          </Box>

          {/* Conversations Section Header */}
          <Box sx={{ px: 2, py: 0.5 }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.825rem' }}>
              Conversations
            </Typography>
          </Box>

          {/* Scrollable Grouped Conversations List */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
            {sessions.length === 0 ? (
              <Box sx={{ px: 1.5, py: 3, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                  No previous conversations. Ask a question to get started.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Group 1: Today */}
                {groupedSessions.today.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, px: 1, mb: 0.8 }}>
                      Today
                    </Typography>
                    {groupedSessions.today.map((s) => (
                      <Box
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.2,
                          py: 0.8,
                          mb: 0.4,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                          border: activeSessionId === s.id ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
                          '&:hover': {
                            background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                          <ChatBubbleOutlinedIcon
                            sx={{
                              fontSize: '0.95rem',
                              color: activeSessionId === s.id ? '#FFD21F' : '#64748b',
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            noWrap
                            sx={{
                              fontSize: '0.78rem',
                              color: activeSessionId === s.id ? '#ffffff' : '#cbd5e1',
                              fontWeight: activeSessionId === s.id ? 700 : 500,
                            }}
                          >
                            {s.title || 'New Chat'}
                          </Typography>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTargetSessionId(s.id);
                            setSessionMenuAnchor(e.currentTarget);
                          }}
                          sx={{ color: '#64748b', p: 0.2 }}
                        >
                          <MoreHorizIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Group 2: This Week */}
                {groupedSessions.thisWeek.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, px: 1, mb: 0.8 }}>
                      This Week
                    </Typography>
                    {groupedSessions.thisWeek.map((s) => (
                      <Box
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.2,
                          py: 0.8,
                          mb: 0.4,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                          border: activeSessionId === s.id ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
                          '&:hover': {
                            background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                          <ChatBubbleOutlinedIcon
                            sx={{
                              fontSize: '0.95rem',
                              color: activeSessionId === s.id ? '#FFD21F' : '#64748b',
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            noWrap
                            sx={{
                              fontSize: '0.78rem',
                              color: activeSessionId === s.id ? '#ffffff' : '#cbd5e1',
                              fontWeight: activeSessionId === s.id ? 700 : 500,
                            }}
                          >
                            {s.title || 'New Chat'}
                          </Typography>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTargetSessionId(s.id);
                            setSessionMenuAnchor(e.currentTarget);
                          }}
                          sx={{ color: '#64748b', p: 0.2 }}
                        >
                          <MoreHorizIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Group 3: Older */}
                {groupedSessions.older.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, px: 1, mb: 0.8 }}>
                      Older
                    </Typography>
                    {groupedSessions.older.map((s) => (
                      <Box
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 1.2,
                          py: 0.8,
                          mb: 0.4,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                          border: activeSessionId === s.id ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
                          '&:hover': {
                            background: activeSessionId === s.id ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                          <ChatBubbleOutlinedIcon
                            sx={{
                              fontSize: '0.95rem',
                              color: activeSessionId === s.id ? '#FFD21F' : '#64748b',
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            noWrap
                            sx={{
                              fontSize: '0.78rem',
                              color: activeSessionId === s.id ? '#ffffff' : '#cbd5e1',
                              fontWeight: activeSessionId === s.id ? 700 : 500,
                            }}
                          >
                            {s.title || 'New Chat'}
                          </Typography>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTargetSessionId(s.id);
                            setSessionMenuAnchor(e.currentTarget);
                          }}
                          sx={{ color: '#64748b', p: 0.2 }}
                        >
                          <MoreHorizIcon sx={{ fontSize: '0.95rem' }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Bottom Footer: Indexing Status + Repo Info */}
          <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Box
              sx={{
                p: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isIndexed ? '#10b981' : '#ef4444',
                      boxShadow: isIndexed ? '0 0 8px #10b981' : 'none',
                    }}
                  />
                  <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '0.78rem' }}>
                    {isIndexed ? 'Repository Indexed' : isIndexing ? 'Indexing...' : 'Not Indexed'}
                  </Typography>
                </Box>
                {isIndexed && <CheckCircleIcon sx={{ color: '#10b981', fontSize: '0.95rem' }} />}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <GitHubIcon sx={{ fontSize: '0.85rem', color: '#94a3b8' }} />
                <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }} noWrap>
                  {repository ? `${repository.owner}/${repository.name}` : 'Repository'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ─── 2. Center Panel — Main Chat Workspace ─────────────────────────── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {/* Top Breadcrumb Bar */}
          <Box
            sx={{
              px: 3.5,
              py: 1.4,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <GitHubIcon sx={{ fontSize: '0.9rem', color: '#94a3b8' }} />
            <Typography sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              {repository ? `${repository.owner}/${repository.name}` : ''}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>›</Typography>
            <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 600 }}>
              Repository Chat
            </Typography>
          </Box>

          {/* Messages Feed / Empty State */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: { xs: 2.5, md: 4.5 },
              py: 3,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Empty State with 4 Suggested Prompts (Matches Screenshot) */}
            {messages.length === 0 && !loading && (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: 720,
                  mx: 'auto',
                  width: '100%',
                  py: 4,
                }}
              >
                {/* Center Glowing Sparkle Badge */}
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    borderRadius: '14px',
                    background: 'rgba(255, 210, 31, 0.12)',
                    border: '1px solid rgba(255, 210, 31, 0.4)',
                    boxShadow: '0 0 25px rgba(255, 210, 31, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFD21F',
                    mb: 2.2,
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: '1.8rem' }} />
                </Box>

                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.4rem', sm: '1.75rem' },
                    color: '#ffffff',
                    mb: 0.8,
                    textAlign: 'center',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Chat with your <span style={{ color: '#FFD21F' }}>Repository</span>
                </Typography>

                <Typography
                  sx={{
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                    maxWidth: 480,
                    mb: 3.5,
                    lineHeight: 1.5,
                  }}
                >
                  Ask questions about your code, architecture, logic, and get grounded answers from your repository.
                </Typography>

                {/* 4 Suggested Prompt Cards (2x2 Grid) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.8,
                    width: '100%',
                  }}
                >
                  {SUGGESTED_PROMPTS.map((p) => {
                    const IconComp = p.icon;
                    return (
                      <Card
                        key={p.title}
                        onClick={() => executeSend(p.desc)}
                        sx={{
                          background: '#111218',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          p: 2.2,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          transition: 'all 0.18s ease',
                          '&:hover': {
                            borderColor: 'rgba(255, 210, 31, 0.45)',
                            background: 'rgba(255, 255, 255, 0.03)',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '8px',
                              background: 'rgba(255, 210, 31, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#FFD21F',
                              flexShrink: 0,
                              mt: 0.2,
                            }}
                          >
                            <IconComp sx={{ fontSize: '1.1rem' }} />
                          </Box>
                          <Box>
                            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>
                              {p.title}
                            </Typography>
                            <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mt: 0.3, lineHeight: 1.4 }}>
                              {p.desc}
                            </Typography>
                          </Box>
                        </Box>
                        <ArrowForwardIcon sx={{ color: '#64748b', fontSize: '1.05rem', flexShrink: 0 }} />
                      </Card>
                    );
                  })}
                </Box>

                {/* Index CTA if repository not indexed */}
                {!isIndexed && !isIndexing && (
                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      onClick={handleIndex}
                      sx={{
                        borderColor: 'rgba(255, 210, 31, 0.45)',
                        color: '#FFD21F',
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        '&:hover': {
                          borderColor: '#FFD21F',
                          background: 'rgba(255, 210, 31, 0.1)',
                        },
                      }}
                    >
                      Index Repository Now
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {/* Error banner */}
            {error && (
              <Alert
                severity={error.includes('indexed') ? 'warning' : 'error'}
                sx={{
                  mb: 2.5,
                  background: '#111218',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e2e8f0',
                  borderRadius: '12px',
                  '& .MuiAlert-icon': { color: error.includes('indexed') ? '#ffd21f' : '#ef4444' },
                }}
                action={
                  error.includes('indexed') && !isIndexed && !isIndexing ? (
                    <Button size="small" onClick={handleIndex} sx={{ color: '#ffd21f', textTransform: 'none', fontWeight: 800 }}>
                      Index Now
                    </Button>
                  ) : undefined
                }
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} repository={repository} />
            ))}

            {loading && <LoadingMessage stage={loadingStage} />}
            <div ref={messagesEndRef} />
          </Box>

          {/* ─── Chat Input Area (Matches Screenshot) ────────────────────────── */}
          <Box sx={{ px: { xs: 2.5, md: 4.5 }, pb: 2.5, pt: 1, background: '#090a0f' }}>
            <Box
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                borderRadius: '14px',
                p: '12px 16px',
                transition: 'all 0.2s ease',
                '&:focus-within': {
                  borderColor: '#FFD21F',
                  boxShadow: '0 0 20px rgba(255, 210, 31, 0.15)',
                },
              }}
            >
              {/* Question Text Input */}
              <InputBase
                inputRef={inputRef}
                multiline
                maxRows={5}
                fullWidth
                placeholder="Ask a question about this repository..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                sx={{
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  '& input::placeholder': { color: '#64748b', opacity: 1 },
                }}
              />

              {/* Bottom Input Actions Toolbar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1.5,
                  pt: 0.5,
                }}
              >
                {/* Left Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    size="small"
                    sx={{
                      color: '#94a3b8',
                      p: 0.5,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                    }}
                  >
                    <AddIcon sx={{ fontSize: '1.05rem' }} />
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      color: '#94a3b8',
                      p: 0.5,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                    }}
                  >
                    <TuneIcon sx={{ fontSize: '1.05rem' }} />
                  </IconButton>

                  {/* Grounded Badge Dropdown */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.8,
                      px: 1.2,
                      py: 0.4,
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 6px #10b981',
                      }}
                    />
                    <Typography sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 600 }}>
                      Grounded (Repository)
                    </Typography>
                    <KeyboardArrowDownIcon sx={{ color: '#94a3b8', fontSize: '0.9rem' }} />
                  </Box>
                </Box>

                {/* Right Send Action Button */}
                <IconButton
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: loading || !input.trim() ? '#1f2029' : '#FFD21F',
                    color: loading || !input.trim() ? '#64748b' : '#050505',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: loading || !input.trim() ? '#1f2029' : '#FFE033',
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={14} sx={{ color: '#050505' }} />
                  ) : (
                    <ArrowForwardIcon sx={{ fontSize: '1.1rem' }} />
                  )}
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ─── 3. Right Panel — Repository Context & Sources ─────────────────── */}
        <Box
          sx={{
            width: { xs: 260, lg: 280 },
            flexShrink: 0,
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#0c0d12',
            p: 2.2,
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            gap: 2.5,
            overflowY: 'auto',
          }}
        >
          {/* Card 1: Repository Context */}
          <Box>
            <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.925rem', mb: 1.5 }}>
              Repository Context
            </Typography>

            <Box
              sx={{
                background: '#111218',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                p: 2,
              }}
            >
              {/* Repo Title & Description */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, mb: 1.8 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <GitHubIcon sx={{ fontSize: '1.2rem' }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }} noWrap>
                    {repository ? `${repository.owner}/${repository.name}` : 'Repository'}
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', mt: 0.2 }}>
                    {repository?.description || 'A Python-based nursery management repository.'}
                  </Typography>
                </Box>
              </Box>

              {/* Key Metrics List */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionOutlinedIcon sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {repository?.file_count ? repository.file_count.toLocaleString() : '634'} files
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FolderOutlinedIcon sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {repository?.folder_count ? repository.folder_count.toLocaleString() : '83'} folders
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeIcon sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {repository?.languages?.length || 7} languages
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountTreeOutlinedIcon sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {repository?.default_branch || 'main'} ({repository?.branches?.length || 1} branch)
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: '0.95rem', color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                    Last commit {formatRelativeTime(repository?.last_commit_date)}
                  </Typography>
                </Box>
              </Box>

              {/* Status Pill */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.8,
                  py: 0.8,
                  borderRadius: '8px',
                  background: isIndexed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${isIndexed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: isIndexed ? '#10b981' : '#ef4444',
                }}
              >
                <CheckCircleIcon sx={{ fontSize: '1rem' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.78rem' }}>
                  {isIndexed ? 'Indexed & Ready' : isIndexing ? 'Indexing...' : 'Not Indexed'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Card 2: Sources */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5 }}>
              <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '0.925rem' }}>
                Sources
              </Typography>
              <InfoOutlinedIcon sx={{ fontSize: '0.9rem', color: '#64748b' }} />
            </Box>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.74rem', mb: 1.5 }}>
              Answers are grounded in your repository code, structure, and analysis.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'Code Files', icon: CodeIcon },
                { label: 'Architecture', icon: AccountTreeOutlinedIcon },
                { label: 'Dependencies', icon: LayersIcon },
                { label: 'Documentation', icon: DescriptionOutlinedIcon },
              ].map((src) => {
                const IconComp = src.icon;
                return (
                  <Box
                    key={src.label}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconComp sx={{ fontSize: '1rem', color: '#FFD21F' }} />
                      <Typography sx={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: 600 }}>
                        {src.label}
                      </Typography>
                    </Box>
                    <CheckCircleIcon sx={{ fontSize: '0.95rem', color: '#10b981' }} />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* ─── Session Context Menu (Delete) ─────────────────────────────────── */}
        <Menu
          anchorEl={sessionMenuAnchor}
          open={Boolean(sessionMenuAnchor)}
          onClose={() => setSessionMenuAnchor(null)}
          slotProps={{
            paper: {
              sx: {
                background: '#121218',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              if (menuTargetSessionId) handleDeleteSession(menuTargetSessionId);
            }}
            sx={{ color: '#ef4444', fontSize: '0.8rem', gap: 1 }}
          >
            <DeleteIcon sx={{ fontSize: '0.95rem' }} />
            Delete Conversation
          </MenuItem>
        </Menu>
      </Box>
    </DashboardLayout>
  );
};

export default RepositoryChat;