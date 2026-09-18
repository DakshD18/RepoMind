import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Divider,
  Tooltip,
  Alert,
  Button,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import CodeIcon from '@mui/icons-material/Code';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import HistoryIcon from '@mui/icons-material/History';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import toast from 'react-hot-toast';

import type { Repository, ChatSession, ChatMessage, SourceReference, ChatResponse } from '../types';
import {
  getRepository,
  getChatSessions,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
  indexRepository,
} from '../services/api';

// ─── Markdown Code Block with Syntax Highlighting & Copy Button ────────────

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
        {/* Code Header with language pill and copy button */}
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
          <Typography sx={{ fontSize: '0.7rem', color: '#ffd21f', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
            {match[1]}
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy Code'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                color: copied ? '#27c93f' : '#94a3b8',
                p: 0.4,
                '&:hover': { color: '#ffffff' },
              }}
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
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </code>
  );
};

const markdownComponents = {
  code: CodeBlock,
};

// ─── Source Reference Card ────────────────────────────────────────────────

const SourceCard = ({ source, repository }: { source: SourceReference; repository?: Repository | null }) => {
  // Commit-style card
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
          background: 'rgba(18, 18, 24, 0.8)',
          border: '1px solid rgba(255, 210, 31, 0.35)',
          cursor: commitUrl ? 'pointer' : 'default',
          transition: 'all 0.18s ease',
          textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          '&:hover': {
            borderColor: '#ffd21f',
            background: 'rgba(24, 24, 34, 0.95)',
            boxShadow: '0 0 14px rgba(255, 210, 31, 0.15)',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <HistoryIcon sx={{ fontSize: 14, color: '#ffd21f' }} />
        <Typography sx={{ fontSize: '0.725rem', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#ffd21f', fontWeight: 700 }}>{shortSha}</span>
          {source.author_name && (
            <span style={{ color: '#94a3b8', marginLeft: 6 }}>by {source.author_name}</span>
          )}
          {date && (
            <span style={{ color: '#64748b', marginLeft: 6 }}>{date}</span>
          )}
        </Typography>
      </Box>
    );
  }

  // Code-file card
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
        background: 'rgba(18, 18, 24, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        cursor: 'default',
        transition: 'all 0.18s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        '&:hover': {
          borderColor: 'rgba(255, 210, 31, 0.45)',
          background: 'rgba(24, 24, 34, 0.95)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CodeIcon sx={{ fontSize: 14, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.725rem', color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
        {fileName}
        {source.symbol_name && (
          <span style={{ color: '#ffd21f', marginLeft: 4 }}>— {source.symbol_name}()</span>
        )}
        {source.start_line > 0 && (
          <span style={{ color: '#64748b', marginLeft: 4 }}>
            L{source.start_line}–{source.end_line}
          </span>
        )}
      </Typography>
    </Box>
  );
};

// ─── Message Bubble ────────────────────────────────────────────────────────

const MessageBubble = ({ message, repository }: { message: ChatMessage; repository?: Repository | null }) => {
  const isUser = message.role === 'user';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', mb: 3 }}>
      {/* Role label */}
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

      {/* Bubble */}
      <Box
        sx={{
          maxWidth: { xs: '90%', md: '82%' },
          px: 2.8,
          py: 2,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? '#181822' : 'rgba(18, 18, 24, 0.75)',
          backdropFilter: isUser ? 'none' : 'blur(16px)',
          border: isUser
            ? '1px solid rgba(255, 255, 255, 0.12)'
            : '1px solid rgba(255, 210, 31, 0.22)',
          color: '#e2e8f0',
          fontSize: '0.9rem',
          lineHeight: 1.7,
          boxShadow: isUser
            ? '0 6px 20px rgba(0, 0, 0, 0.5)'
            : '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 210, 31, 0.05)',
          '& p': { margin: '6px 0' },
          '& h1, & h2, & h3': { color: '#ffffff', marginTop: '14px', marginBottom: '6px', fontWeight: 700 },
          '& ul, & ol': { paddingLeft: '22px', margin: '8px 0' },
          '& li': { marginBottom: '3px' },
          '& a': { color: '#ffd21f', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
          '& blockquote': {
            borderLeft: '3px solid #ffd21f',
            margin: '10px 0',
            paddingLeft: '14px',
            color: '#94a3b8',
            background: 'rgba(10, 10, 14, 0.6)',
            py: 0.6,
            borderRadius: '0 6px 6px 0',
          },
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

      {/* Sources — shown below assistant messages only */}
      {!isUser && message.sources && message.sources.length > 0 && (
        <Box sx={{ mt: 1.4, display: 'flex', flexWrap: 'wrap', gap: 0.8, maxWidth: { xs: '90%', md: '82%' } }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#64748b', width: '100%', mb: 0.2, fontWeight: 700, letterSpacing: '0.06em' }}>
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

// ─── Loading indicator ─────────────────────────────────────────────────────

const LoadingMessage = ({ stage }: { stage: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.6, px: 0.5 }}>
      <AutoAwesomeIcon sx={{ fontSize: 13, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f', fontWeight: 800, letterSpacing: '0.08em' }}>
        REPOMIND AI
      </Typography>
    </Box>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.6,
        px: 2.5,
        py: 1.8,
        borderRadius: '16px 16px 16px 4px',
        background: 'rgba(18, 18, 24, 0.8)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 210, 31, 0.3)',
        boxShadow: '0 0 20px rgba(255, 210, 31, 0.08)',
      }}
    >
      <CircularProgress size={16} sx={{ color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>{stage}</Typography>
    </Box>
  </Box>
);

// ─── Loading stages helper ─────────────────────────────────────────────────

const LOADING_STAGES = [
  'Searching repository knowledge graph...',
  'Analyzing relevant AST and symbols...',
  'Synthesizing contextual developer response...',
];

// ─── Starter Prompt Suggestions ───────────────────────────────────────────

const STARTER_PROMPTS = [
  'What is this repo about?',
  'Where is the main logic code present?',
  'Where is authentication implemented?',
  'When was the last commit and what was it?',
];

// ─── Main Page ─────────────────────────────────────────────────────────────

export const RepositoryChat: React.FC = () => {
  const { id, sessionId: sessionIdParam } = useParams<{ id: string; sessionId?: string }>();
  const navigate = useNavigate();
  const repoId = parseInt(id || '0', 10);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State
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

  // Load repository info
  useEffect(() => {
    if (!repoId) return;
    setLoadingRepo(true);
    getRepository(repoId)
      .then(setRepository)
      .catch(() => setError('Repository not found.'))
      .finally(() => setLoadingRepo(false));
  }, [repoId]);

  // Load sessions list
  const loadSessions = useCallback(() => {
    if (!repoId) return;
    getChatSessions(repoId).then(setSessions).catch(() => {});
  }, [repoId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load session messages when active session changes
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Animate loading stage
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

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation();
    await deleteChatSession(repoId, sessionId).catch(() => {});
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      navigate(`/repository/${repoId}/chat`, { replace: true });
    }
    loadSessions();
  };

  const executeSend = async (queryText: string) => {
    const text = queryText.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');

    // Optimistically add user message to UI
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

      // If new session was created, update active session
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
      loadSessions(); // refresh sidebar titles
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string; code?: string } } };
      const status = axiosErr?.response?.status;
      const errData = axiosErr?.response?.data;

      if (status === 409 && errData?.code === 'not_indexed') {
        setError('This repository hasn\'t been indexed yet. Use the "Index Repository" button below to start indexing.');
      } else if (status === 503) {
        setError(errData?.error || 'AI service is temporarily unavailable. Please try again.');
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
      setRepository((prev) => prev ? { ...prev, index_status: 'indexing' } : prev);
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

  if (loadingRepo) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050507' }}>
        <CircularProgress sx={{ color: '#ffd21f' }} />
      </Box>
    );
  }

  const isIndexed = repository?.is_indexed;
  const isIndexing = repository?.index_status === 'indexing' || indexing;

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#050507', overflow: 'hidden' }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          width: 270,
          flexShrink: 0,
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#09090d',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Back + Repo name */}
        <Box sx={{ p: 2.2, borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Box
            onClick={() => navigate(`/repository/${repoId}`)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              color: '#94a3b8',
              mb: 1.5,
              '&:hover': { color: '#ffd21f' },
              transition: 'color 0.15s',
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Back to Repository</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpenIcon sx={{ fontSize: 18, color: '#ffd21f' }} />
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }} noWrap>
              {repository?.name || 'Repository'}
            </Typography>
          </Box>
        </Box>

        {/* New Chat Button */}
        <Box sx={{ p: 1.8 }}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            onClick={handleNewChat}
            sx={{
              background: 'rgba(255, 210, 31, 0.08)',
              border: '1px solid rgba(255, 210, 31, 0.35)',
              color: '#ffd21f',
              borderRadius: '10px',
              py: 1,
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                background: 'rgba(255, 210, 31, 0.15)',
                borderColor: '#ffd21f',
                boxShadow: '0 0 16px rgba(255, 210, 31, 0.2)',
              },
            }}
          >
            New Chat Session
          </Button>
        </Box>

        {/* Sessions List */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1.2 }}>
          {sessions.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                No conversations yet. Ask a question to start reasoning.
              </Typography>
            </Box>
          ) : (
            sessions.map((session) => (
              <Box
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.6,
                  py: 1.1,
                  mb: 0.4,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background:
                    activeSessionId === session.id
                      ? 'rgba(255, 210, 31, 0.1)'
                      : 'transparent',
                  border:
                    activeSessionId === session.id
                      ? '1px solid rgba(255, 210, 31, 0.3)'
                      : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    background: activeSessionId === session.id ? 'rgba(255, 210, 31, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  },
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: '0.82rem',
                    color: activeSessionId === session.id ? '#ffffff' : '#94a3b8',
                    fontWeight: activeSessionId === session.id ? 700 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.title || 'New Chat'}
                </Typography>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    sx={{
                      opacity: 0,
                      color: '#64748b',
                      p: 0.3,
                      '.MuiBox-root:hover &': { opacity: 1 },
                      '&:hover': { color: '#ef5350' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Box>

        {/* Indexed status badge */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Chip
            size="small"
            label={
              isIndexing
                ? 'Indexing repository...'
                : isIndexed
                  ? 'Knowledge Indexed'
                  : 'Not Indexed'
            }
            sx={{
              width: '100%',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: isIndexed
                ? 'rgba(255, 210, 31, 0.1)'
                : isIndexing
                  ? 'rgba(255, 210, 31, 0.15)'
                  : 'rgba(239, 83, 80, 0.1)',
              color: isIndexed ? '#ffd21f' : isIndexing ? '#ffe033' : '#ef5350',
              border: `1px solid ${isIndexed ? 'rgba(255, 210, 31, 0.35)' : isIndexing ? 'rgba(255, 210, 31, 0.45)' : 'rgba(239, 83, 80, 0.3)'}`,
            }}
          />
        </Box>
      </Box>

      {/* ── Main Chat Area ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050507' }}>
        {/* Header */}
        <Box
          sx={{
            px: 3.5,
            py: 1.8,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(9, 9, 13, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: '#12121a',
                border: '1px solid rgba(255, 210, 31, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(255, 210, 31, 0.15)',
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                Repository Intelligence
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {repository ? `${repository.owner}/${repository.name}` : '...'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#27c93f', boxShadow: '0 0 8px #27c93f' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
              Grounding Active
            </Typography>
          </Box>
        </Box>

        {/* Messages feed */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, md: 5 },
            py: 3.5,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 6 }}>
              <Box
                sx={{
                  width: 68,
                  height: 68,
                  borderRadius: '18px',
                  background: 'rgba(18, 18, 24, 0.85)',
                  border: '1px solid rgba(255, 210, 31, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2.8,
                  boxShadow: '0 0 35px rgba(255, 210, 31, 0.15)',
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 32, color: '#ffd21f' }} />
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', mb: 1, letterSpacing: '-0.02em' }}>
                Ask anything about this repository
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: 460, mb: 4, lineHeight: 1.6 }}>
                {isIndexed
                  ? 'Responses are strictly verified and grounded against repository AST symbols, code chunks, and commit memory.'
                  : 'Index this repository first to enable AI-powered code analysis and Q&A.'}
              </Typography>

              {/* Starter Query Recommendation Chips */}
              {isIndexed && (
                <Box sx={{ maxWidth: 600, mb: 4 }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1.5 }}>
                    SUGGESTED EXPLORATIONS
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
                    {STARTER_PROMPTS.map((prompt) => (
                      <Chip
                        key={prompt}
                        label={prompt}
                        onClick={() => executeSend(prompt)}
                        sx={{
                          py: 1,
                          px: 0.8,
                          fontSize: '0.8rem',
                          background: 'rgba(18, 18, 24, 0.7)',
                          color: '#e2e8f0',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          '&:hover': {
                            background: 'rgba(255, 210, 31, 0.12)',
                            borderColor: '#ffd21f',
                            color: '#ffd21f',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {!isIndexed && !isIndexing && (
                <Button
                  variant="outlined"
                  onClick={handleIndex}
                  disabled={indexing}
                  sx={{
                    borderColor: 'rgba(255, 210, 31, 0.45)',
                    color: '#ffd21f',
                    background: 'rgba(18, 18, 24, 0.6)',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '10px',
                    px: 3,
                    py: 1,
                    '&:hover': {
                      borderColor: '#ffd21f',
                      background: 'rgba(255, 210, 31, 0.12)',
                    },
                  }}
                >
                  Index Repository Now
                </Button>
              )}
              {isIndexing && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <CircularProgress size={16} sx={{ color: '#ffd21f' }} />
                  <Typography sx={{ fontSize: '0.85rem', color: '#ffd21f', fontWeight: 600 }}>Indexing in progress...</Typography>
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
                background: 'rgba(18, 18, 24, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                borderRadius: '12px',
                '& .MuiAlert-icon': { color: error.includes('indexed') ? '#ffd21f' : '#ef5350' },
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

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

        {/* Input area */}
        <Box sx={{ p: 2.5, flexShrink: 0, background: '#050507' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1.2,
              background: 'rgba(12, 12, 18, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              px: 2,
              py: 1,
              transition: 'all 0.2s',
              '&:focus-within': {
                border: '1px solid #ffd21f',
                boxShadow: '0 0 20px rgba(255, 210, 31, 0.2)',
              },
            }}
          >
            <TextField
              inputRef={inputRef}
              multiline
              maxRows={6}
              fullWidth
              placeholder={
                isIndexed
                  ? 'Ask anything about this repository (e.g. "Where is authentication handled?")...'
                  : 'Index the repository first to start chatting...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !isIndexed}
              variant="standard"
              slotProps={{
                input: {
                  disableUnderline: true,
                  style: {
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                  },
                },
              }}
              sx={{
                '& .MuiInputBase-input::placeholder': {
                  color: '#64748b',
                  opacity: 1,
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={loading || !input.trim() || !isIndexed}
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                background:
                  loading || !input.trim() || !isIndexed
                    ? '#161622'
                    : 'linear-gradient(135deg, #ffd21f 0%, #f59e0b 100%)',
                color: loading || !input.trim() || !isIndexed ? '#64748b' : '#050507',
                borderRadius: '10px',
                transition: 'all 0.18s',
                '&:hover': {
                  background:
                    loading || !input.trim() || !isIndexed
                      ? '#161622'
                      : 'linear-gradient(135deg, #ffe033 0%, #fbbf24 100%)',
                  boxShadow:
                    loading || !input.trim() || !isIndexed
                      ? 'none'
                      : '0 0 16px rgba(255, 210, 31, 0.4)',
                },
              }}
            >
              {loading ? <CircularProgress size={16} sx={{ color: '#050507' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', mt: 1 }}>
            Enter to send · Shift+Enter for newline · Strict RAG grounding active
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default RepositoryChat;
