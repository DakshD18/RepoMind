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

import type { Repository, ChatSession, ChatMessage, SourceReference, ChatResponse } from '../types';
import {
  getRepository,
  getChatSessions,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
  indexRepository,
} from '../services/api';

// ─── Markdown Code Block with Syntax Highlighting ──────────────────────────

const CodeBlock = ({ children, className }: { children?: React.ReactNode; className?: string }) => {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');
  if (match) {
    return (
      <SyntaxHighlighter
        style={vscDarkPlus as Record<string, React.CSSProperties>}
        language={match[1]}
        PreTag="div"
        customStyle={{
          margin: '10px 0',
          borderRadius: 8,
          fontSize: '0.8rem',
          backgroundColor: '#080808',
          border: '1px solid #262626',
        }}
      >
        {code}
      </SyntaxHighlighter>
    );
  }
  return (
    <code
      style={{
        background: '#161616',
        color: '#ffd21f',
        border: '1px solid #262626',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: '0.82em',
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

// ─── Source Reference Card ────────────────────────────────────────────────

const SourceCard = ({ source }: { source: SourceReference }) => {
  const fileName = source.file_path.split('/').pop() || source.file_path;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: '6px',
        background: '#151515',
        border: '1px solid #262626',
        cursor: 'default',
        transition: 'all 0.15s ease',
        '&:hover': {
          borderColor: 'rgba(255, 210, 31, 0.45)',
          background: '#1a1a1a',
        },
      }}
    >
      <CodeIcon sx={{ fontSize: 13, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.72rem', color: '#e5e5e5', fontFamily: 'monospace' }}>
        {fileName}
        {source.symbol_name && (
          <span style={{ color: '#ffd21f', marginLeft: 4 }}>— {source.symbol_name}()</span>
        )}
        {source.start_line > 0 && (
          <span style={{ color: '#737373', marginLeft: 4 }}>
            L{source.start_line}–{source.end_line}
          </span>
        )}
      </Typography>
    </Box>
  );
};

// ─── Message Bubble ────────────────────────────────────────────────────────

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', mb: 3 }}>
      {/* Role label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5, px: 0.5 }}>
        {!isUser && <AutoAwesomeIcon sx={{ fontSize: 12, color: '#ffd21f' }} />}
        <Typography
          sx={{
            fontSize: '0.68rem',
            color: isUser ? '#737373' : '#ffd21f',
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          {isUser ? 'YOU' : 'REPOMIND AI'}
        </Typography>
      </Box>

      {/* Bubble */}
      <Box
        sx={{
          maxWidth: '82%',
          px: 2.25,
          py: 1.75,
          borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
          background: isUser ? '#161616' : '#111111',
          border: isUser
            ? '1px solid #333333'
            : '1px solid rgba(255, 210, 31, 0.2)',
          color: '#e5e5e5',
          fontSize: '0.885rem',
          lineHeight: 1.65,
          boxShadow: isUser
            ? '0 4px 15px rgba(0, 0, 0, 0.4)'
            : '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 210, 31, 0.04)',
          '& p': { margin: '4px 0' },
          '& h1, & h2, & h3': { color: '#ffffff', marginTop: '12px', marginBottom: '4px' },
          '& ul, & ol': { paddingLeft: '20px', margin: '6px 0' },
          '& li': { marginBottom: '2px' },
          '& a': { color: '#ffd21f', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
          '& blockquote': {
            borderLeft: '3px solid #ffd21f',
            margin: '8px 0',
            paddingLeft: '12px',
            color: '#a3a3a3',
            background: '#0a0a0a',
            py: 0.5,
            borderRadius: '0 4px 4px 0',
          },
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: '0.885rem', lineHeight: 1.65, color: '#ffffff', whiteSpace: 'pre-wrap' }}>
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
        <Box sx={{ mt: 1.2, display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '82%' }}>
          <Typography sx={{ fontSize: '0.65rem', color: '#737373', width: '100%', mb: 0.25, fontWeight: 700, letterSpacing: '0.05em' }}>
            VERIFIED SOURCE REFERENCES
          </Typography>
          {message.sources.map((src, idx) => (
            <SourceCard key={idx} source={src} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Loading indicator ─────────────────────────────────────────────────────

const LoadingMessage = ({ stage }: { stage: string }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.5, px: 0.5 }}>
      <AutoAwesomeIcon sx={{ fontSize: 12, color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f', fontWeight: 700, letterSpacing: '0.08em' }}>
        REPOMIND AI
      </Typography>
    </Box>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderRadius: '14px 14px 14px 2px',
        background: '#111111',
        border: '1px solid rgba(255, 210, 31, 0.25)',
        boxShadow: '0 0 15px rgba(255, 210, 31, 0.05)',
      }}
    >
      <CircularProgress size={14} sx={{ color: '#ffd21f' }} />
      <Typography sx={{ fontSize: '0.825rem', color: '#a3a3a3' }}>{stage}</Typography>
    </Box>
  </Box>
);

// ─── Loading stages helper ─────────────────────────────────────────────────

const LOADING_STAGES = [
  'Searching repository knowledge graph...',
  'Analyzing relevant AST and symbols...',
  'Synthesizing contextual developer response...',
];

// ─── Main Page ─────────────────────────────────────────────────────────────

const RepositoryChat: React.FC = () => {
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
        // sync URL
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

  const handleSend = async () => {
    const text = input.trim();
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
      // Remove the optimistic user message
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
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
      // Poll for indexed status
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

  // ─── Layout ───────────────────────────────────────────────────────────────

  if (loadingRepo) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050505' }}>
        <CircularProgress sx={{ color: '#ffd21f' }} />
      </Box>
    );
  }

  const isIndexed = repository?.is_indexed;
  const isIndexing = repository?.index_status === 'indexing' || indexing;

  return (
    <Box sx={{ display: 'flex', height: '100vh', background: '#050505', overflow: 'hidden' }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid #262626',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Back + Repo name */}
        <Box sx={{ p: 2, borderBottom: '1px solid #1a1a1a' }}>
          <Box
            onClick={() => navigate(`/repository/${repoId}`)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              color: '#737373',
              mb: 1.5,
              '&:hover': { color: '#ffd21f' },
              transition: 'color 0.15s',
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>Back to Repository</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpenIcon sx={{ fontSize: 16, color: '#ffd21f' }} />
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }} noWrap>
              {repository?.name || 'Repository'}
            </Typography>
          </Box>
        </Box>

        {/* New Chat Button */}
        <Box sx={{ p: 1.5 }}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            onClick={handleNewChat}
            sx={{
              background: '#151515',
              border: '1px solid rgba(255, 210, 31, 0.35)',
              color: '#ffd21f',
              borderRadius: '8px',
              py: 0.9,
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                background: 'rgba(255, 210, 31, 0.1)',
                borderColor: '#ffd21f',
                boxShadow: '0 0 12px rgba(255, 210, 31, 0.15)',
              },
            }}
          >
            New Chat
          </Button>
        </Box>

        {/* Sessions List */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
          {sessions.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.78rem', color: '#555555', lineHeight: 1.6 }}>
                No conversations yet. Start by asking a question about this repository.
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
                  px: 1.5,
                  py: 1,
                  mb: 0.25,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background:
                    activeSessionId === session.id
                      ? 'rgba(255, 210, 31, 0.08)'
                      : 'transparent',
                  border:
                    activeSessionId === session.id
                      ? '1px solid rgba(255, 210, 31, 0.25)'
                      : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    background: activeSessionId === session.id ? 'rgba(255, 210, 31, 0.12)' : '#151515',
                  },
                }}
              >
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: '0.8rem',
                    color: activeSessionId === session.id ? '#ffffff' : '#a3a3a3',
                    fontWeight: activeSessionId === session.id ? 600 : 400,
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
                      color: '#737373',
                      p: 0.25,
                      '.MuiBox-root:hover &': { opacity: 1 },
                      '&:hover': { color: '#ef5350' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
        </Box>

        {/* Indexed status badge */}
        <Box sx={{ p: 2, borderTop: '1px solid #1a1a1a' }}>
          <Chip
            size="small"
            label={
              isIndexing
                ? 'Indexing...'
                : isIndexed
                  ? 'Knowledge Indexed'
                  : 'Not Indexed'
            }
            sx={{
              width: '100%',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: isIndexed
                ? 'rgba(255, 210, 31, 0.08)'
                : isIndexing
                  ? 'rgba(255, 210, 31, 0.15)'
                  : 'rgba(239, 83, 80, 0.08)',
              color: isIndexed ? '#ffd21f' : isIndexing ? '#ffe033' : '#ef5350',
              border: `1px solid ${isIndexed ? 'rgba(255, 210, 31, 0.3)' : isIndexing ? 'rgba(255, 210, 31, 0.4)' : 'rgba(239, 83, 80, 0.25)'}`,
            }}
          />
        </Box>
      </Box>

      {/* ── Main Chat Area ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505' }}>
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 1.75,
            borderBottom: '1px solid #262626',
            background: 'rgba(10, 10, 10, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: '#151515',
              border: '1px solid rgba(255, 210, 31, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 16 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              Repository Intelligence
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#737373' }}>
              {repository ? `${repository.owner}/${repository.name}` : '...'}
            </Typography>
          </Box>
        </Box>

        {/* Messages feed */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, md: 4 },
            py: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', py: 8 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '16px',
                  background: '#111111',
                  border: '1px solid rgba(255, 210, 31, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2.5,
                  boxShadow: '0 0 30px rgba(255, 210, 31, 0.12)',
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 26, color: '#ffd21f' }} />
              </Box>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', mb: 1 }}>
                Ask anything about this repository
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: '#737373', maxWidth: 420, mb: 3 }}>
                {isIndexed
                  ? 'Questions are answered using the actual source code and knowledge graph. No guessing.'
                  : 'Index this repository first to enable AI-powered code analysis and Q&A.'}
              </Typography>
              {!isIndexed && !isIndexing && (
                <Button
                  variant="outlined"
                  onClick={handleIndex}
                  disabled={indexing}
                  sx={{
                    borderColor: 'rgba(255, 210, 31, 0.4)',
                    color: '#ffd21f',
                    background: '#111111',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '8px',
                    px: 2.5,
                    '&:hover': {
                      borderColor: '#ffd21f',
                      background: 'rgba(255, 210, 31, 0.08)',
                    },
                  }}
                >
                  Index Repository
                </Button>
              )}
              {isIndexing && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={14} sx={{ color: '#ffd21f' }} />
                  <Typography sx={{ fontSize: '0.82rem', color: '#ffd21f' }}>Indexing in progress...</Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Error banner */}
          {error && (
            <Alert
              severity={error.includes('indexed') ? 'warning' : 'error'}
              sx={{
                mb: 2,
                background: '#161616',
                border: '1px solid #262626',
                color: '#e5e5e5',
                '& .MuiAlert-icon': { color: error.includes('indexed') ? '#ffd21f' : '#ef5350' },
              }}
              action={
                error.includes('indexed') && !isIndexed && !isIndexing ? (
                  <Button size="small" onClick={handleIndex} sx={{ color: '#ffd21f', textTransform: 'none', fontWeight: 700 }}>
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
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {loading && <LoadingMessage stage={loadingStage} />}
          <div ref={messagesEndRef} />
        </Box>

        <Divider sx={{ borderColor: '#262626' }} />

        {/* Input area */}
        <Box sx={{ p: 2, flexShrink: 0, background: '#050505' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
              background: '#0a0a0a',
              border: '1px solid #262626',
              borderRadius: '12px',
              px: 1.5,
              py: 0.8,
              transition: 'all 0.2s',
              '&:focus-within': {
                border: '1px solid #ffd21f',
                boxShadow: '0 0 15px rgba(255, 210, 31, 0.15)',
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
                  ? 'Ask anything about this repository...'
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
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                  },
                },
              }}
              sx={{
                '& .MuiInputBase-input::placeholder': {
                  color: '#737373',
                  opacity: 1,
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={loading || !input.trim() || !isIndexed}
              sx={{
                width: 36,
                height: 36,
                flexShrink: 0,
                background:
                  loading || !input.trim() || !isIndexed
                    ? '#151515'
                    : '#ffd21f',
                color: loading || !input.trim() || !isIndexed ? '#555555' : '#050505',
                borderRadius: '8px',
                transition: 'all 0.15s',
                '&:hover': {
                  background:
                    loading || !input.trim() || !isIndexed
                      ? '#151515'
                      : '#ffe033',
                  boxShadow:
                    loading || !input.trim() || !isIndexed
                      ? 'none'
                      : '0 0 12px rgba(255, 210, 31, 0.35)',
                },
              }}
            >
              {loading ? <CircularProgress size={16} sx={{ color: '#050505' }} /> : <SendIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Box>
          <Typography sx={{ fontSize: '0.68rem', color: '#555555', textAlign: 'center', mt: 0.75 }}>
            Enter to send · Shift+Enter for newline · Answers are grounded in repository source code
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default RepositoryChat;
