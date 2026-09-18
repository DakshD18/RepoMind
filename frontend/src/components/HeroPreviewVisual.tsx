import React, { useState } from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CodeIcon from '@mui/icons-material/Code';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import BoltIcon from '@mui/icons-material/Bolt';

interface NodeItem {
  id: string;
  name: string;
  type: string;
  color: string;
  lines: string;
}

const NODES: NodeItem[] = [
  { id: 'auth', name: 'AuthRouter.ts', type: 'Entry Controller', color: '#ffd21f', lines: 'L12-84' },
  { id: 'jwt', name: 'jwt_verifier.py', type: 'Security Token', color: '#f59e0b', lines: 'L45-120' },
  { id: 'session', name: 'SessionStore.go', type: 'State Cache', color: '#38bdf8', lines: 'L28-96' },
  { id: 'db', name: 'UserSchema.sql', type: 'Persistent Model', color: '#a78bfa', lines: 'L1-52' },
];

export const HeroPreviewVisual: React.FC = () => {
  const [activeNode, setActiveNode] = useState<string>('auth');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('Where is session authentication validated and who committed it?');

  const prompts = [
    'Where is authentication implemented?',
    'What are the primary entry points?',
    'When was the last commit and what was it?',
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      {/* Ambient background glow behind mockup */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '15%',
          right: '15%',
          bottom: '15%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.16) 0%, rgba(245, 158, 11, 0.05) 45%, transparent 70%)',
          filter: 'blur(50px)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Floating Pill Top Right */}
      <Box
        sx={{
          position: 'absolute',
          top: -18,
          right: 24,
          zIndex: 10,
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 1.8,
          py: 0.6,
          borderRadius: '24px',
          background: 'rgba(18, 18, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 210, 31, 0.4)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 16px rgba(255, 210, 31, 0.15)',
          animation: 'floatSoft 5s ease-in-out infinite',
        }}
      >
        <BoltIcon sx={{ color: '#ffd21f', fontSize: 16 }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
          pgvector Hybrid RAG <span style={{ color: '#ffd21f' }}>&lt; 320ms</span>
        </Typography>
      </Box>

      {/* Main Glassmorphic Window Mockup */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(14, 14, 18, 0.88)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.85), 0 0 40px rgba(255, 210, 31, 0.06)',
          overflow: 'hidden',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            borderColor: 'rgba(255, 210, 31, 0.35)',
            boxShadow: '0 30px 90px rgba(0, 0, 0, 0.95), 0 0 50px rgba(255, 210, 31, 0.12)',
          },
        }}
      >
        {/* macOS Style Window Chrome */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.2,
            py: 1.4,
            background: 'rgba(10, 10, 14, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          }}
        >
          {/* Traffic light dots */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box sx={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f56' }} />
            <Box sx={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
            <Box sx={{ width: 11, height: 11, borderRadius: '50%', background: '#27c93f' }} />
          </Box>

          {/* Repo Breadcrumb */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.3,
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              repomind // <span style={{ color: '#ffffff', fontWeight: 600 }}>ride_share_campus</span>
            </Typography>
            <Chip
              label="main"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                background: 'rgba(255, 210, 31, 0.12)',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.3)',
                fontWeight: 700,
                '& .MuiChip-label': { px: 0.7 },
              }}
            />
          </Box>

          {/* Status Dot */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#27c93f',
                boxShadow: '0 0 8px #27c93f',
              }}
            />
            <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
              Grounding: 100%
            </Typography>
          </Box>
        </Box>

        {/* Interior Container: Dual Pane */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 1.15fr' },
            minHeight: 380,
          }}
        >
          {/* Left Pane: Architecture & AST Node Graph */}
          <Box
            sx={{
              p: 2.5,
              borderRight: { xs: 'none', md: '1px solid rgba(255, 255, 255, 0.07)' },
              borderBottom: { xs: '1px solid rgba(255, 255, 255, 0.07)', md: 'none' },
              background: 'rgba(9, 9, 12, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountTreeIcon sx={{ fontSize: 16, color: '#ffd21f' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Architecture Map
                  </Typography>
                </Box>
                <Chip
                  label="AST Parsed"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    background: '#161622',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '& .MuiChip-label': { px: 0.6 },
                  }}
                />
              </Box>

              {/* Simulated Interactive Graph Nodes */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                {NODES.map((node) => {
                  const isActive = activeNode === node.id;
                  return (
                    <Box
                      key={node.id}
                      onClick={() => setActiveNode(node.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.3,
                        borderRadius: '10px',
                        background: isActive ? 'rgba(255, 210, 31, 0.08)' : 'rgba(20, 20, 28, 0.5)',
                        border: isActive ? '1px solid rgba(255, 210, 31, 0.45)' : '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? '0 0 16px rgba(255, 210, 31, 0.12)' : 'none',
                        '&:hover': {
                          background: 'rgba(255, 210, 31, 0.05)',
                          borderColor: 'rgba(255, 210, 31, 0.3)',
                          transform: 'translateX(2px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: '6px',
                            background: '#121218',
                            border: `1px solid ${isActive ? '#ffd21f' : 'rgba(255, 255, 255, 0.1)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CodeIcon sx={{ fontSize: 14, color: node.color }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                            {node.name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {node.type}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {node.lines}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Bottom mini metric */}
            <Box
              sx={{
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                48 modules • 320 symbols
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <SecurityIcon sx={{ fontSize: 13, color: '#ffd21f' }} />
                <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f', fontWeight: 600 }}>
                  Grounded Graph Active
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right Pane: AI Intelligence & Grounded Chat Stream */}
          <Box
            sx={{
              p: 2.5,
              background: 'rgba(12, 12, 16, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 16, color: '#ffd21f' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Repository Intelligence
                  </Typography>
                </Box>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: '11px !important', color: '#ffd21f !important' }} />}
                  label="Zero Hallucination"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    background: 'rgba(255, 210, 31, 0.1)',
                    color: '#ffd21f',
                    border: '1px solid rgba(255, 210, 31, 0.25)',
                    fontWeight: 700,
                    '& .MuiChip-label': { px: 0.6 },
                  }}
                />
              </Box>

              {/* User Question */}
              <Box
                sx={{
                  p: 1.4,
                  borderRadius: '10px',
                  background: 'rgba(255, 210, 31, 0.06)',
                  border: '1px solid rgba(255, 210, 31, 0.25)',
                  mb: 1.8,
                }}
              >
                <Typography sx={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 600 }}>
                  "{selectedPrompt}"
                </Typography>
              </Box>

              {/* AI Response Bubble */}
              <Box
                sx={{
                  p: 1.6,
                  borderRadius: '10px',
                  background: 'rgba(20, 20, 28, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  mb: 2,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.55, mb: 1.5 }}>
                  Authentication is handled in <span style={{ color: '#ffd21f', fontFamily: 'var(--font-mono)' }}>backend/server.js</span> via JWT token verification middleware. Commit history confirms initial authentication infrastructure was established by <strong>@alex</strong>.
                </Typography>

                {/* Verified Citations List */}
                <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.8 }}>
                  VERIFIED REPOSITORY REFERENCES (2)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  <Tooltip title="View AST Code Reference">
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1,
                        py: 0.4,
                        borderRadius: '6px',
                        background: '#181824',
                        border: '1px solid rgba(255, 210, 31, 0.35)',
                        cursor: 'pointer',
                        '&:hover': { background: '#222232', borderColor: '#ffd21f' },
                      }}
                    >
                      <CodeIcon sx={{ fontSize: 12, color: '#ffd21f' }} />
                      <Typography sx={{ fontSize: '0.68rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        server.js <span style={{ color: '#ffd21f' }}>:L42-88</span>
                      </Typography>
                    </Box>
                  </Tooltip>

                  <Tooltip title="View Commit Memory in GitHub">
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1,
                        py: 0.4,
                        borderRadius: '6px',
                        background: '#181824',
                        border: '1px solid rgba(255, 210, 31, 0.35)',
                        cursor: 'pointer',
                        '&:hover': { background: '#222232', borderColor: '#ffd21f' },
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: 12, color: '#ffd21f' }} />
                      <Typography sx={{ fontSize: '0.68rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#ffd21f', fontWeight: 700 }}>c94a102</span> by @alex
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            {/* Quick Interactive Prompt Chips */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: '#64748b', mb: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TRY ASKING REPOMIND:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                {prompts.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    size="small"
                    onClick={() => setSelectedPrompt(p)}
                    sx={{
                      height: 22,
                      fontSize: '0.65rem',
                      background: selectedPrompt === p ? 'rgba(255, 210, 31, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedPrompt === p ? '#ffd21f' : '#94a3b8',
                      border: selectedPrompt === p ? '1px solid rgba(255, 210, 31, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        background: 'rgba(255, 210, 31, 0.1)',
                        color: '#ffd21f',
                        borderColor: '#ffd21f',
                      },
                      '& .MuiChip-label': { px: 0.8 },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Floating Pill Bottom Left */}
      <Box
        sx={{
          position: 'absolute',
          bottom: -18,
          left: 24,
          zIndex: 10,
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 1.8,
          py: 0.6,
          borderRadius: '24px',
          background: 'rgba(18, 18, 24, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 210, 31, 0.4)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 16px rgba(255, 210, 31, 0.15)',
          animation: 'floatSoft 5s ease-in-out infinite 2.5s',
        }}
      >
        <CheckCircleIcon sx={{ color: '#ffd21f', fontSize: 16 }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>
          Grounding Verification: <span style={{ color: '#ffd21f' }}>100% Guaranteed</span>
        </Typography>
      </Box>
    </Box>
  );
};
