import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Container } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface AnalysisLoadingProps {
  repoUrl: string;
}

const STEPS = [
  'Validating repository',
  'Cloning repository',
  'Parsing file structure & languages',
  'Generating repository metadata',
];

export const AnalysisLoading: React.FC<AnalysisLoadingProps> = ({ repoUrl }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Extract owner/repo from URL
  const repoName = repoUrl.replace('https://github.com/', '').replace('.git', '') || 'repository';

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStepIndex(1), 1200);
    const timer2 = setTimeout(() => setCurrentStepIndex(2), 2500);
    const timer3 = setTimeout(() => setCurrentStepIndex(3), 4000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#050505',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background floating translucent code snippets */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 210, 31, 0.08)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        import &#123; ASTNode &#125; from '@babel/types';
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          right: '12%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.05)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        git rev-parse HEAD
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: '25%',
          left: '15%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 210, 31, 0.06)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        // Calculating cyclomatic complexity & knowledge vectors
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 210, 31, 0.08)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        useMemo(() =&gt; generateKnowledgeGraph(), [src]);
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: '35%',
          right: '25%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.04)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        function buildDependencyTree(nodes: ASTNode[])
      </Box>

      {/* Central glowing radial aura */}
      <Box
        sx={{
          position: 'absolute',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 210, 31, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'pulseAura 3s infinite ease-in-out',
          '@keyframes pulseAura': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.7 },
            '50%': { transform: 'scale(1.15)', opacity: 1 },
          },
        }}
      />

      {/* Loading content container */}
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        {/* Glowing Logo Icon */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              background: '#111111',
              border: '1px solid rgba(255, 210, 31, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(255, 210, 31, 0.2)',
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 22 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
            RepoMind
          </Typography>
        </Box>

        {/* PROCESSING REPOSITORY LABEL */}
        <Typography
          sx={{
            fontSize: '0.725rem',
            fontWeight: 700,
            color: '#ffd21f',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            mb: 1,
          }}
        >
          PROCESSING REPOSITORY
        </Typography>

        {/* Repository Name */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: '#ffffff',
            mb: 4,
            fontSize: { xs: '1.75rem', sm: '2.1rem' },
            letterSpacing: '-0.02em',
          }}
        >
          {repoName}
        </Typography>

        {/* Step Checklist */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: 'flex-start',
            mx: 'auto',
            maxWidth: 300,
          }}
        >
          {STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {isDone ? (
                  <CheckCircleIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
                ) : isCurrent ? (
                  <CircularProgress size={16} sx={{ color: '#ffd21f' }} />
                ) : (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid #333333',
                    }}
                  />
                )}
                <Typography
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isDone ? '#ffd21f' : isCurrent ? '#ffffff' : '#555555',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {step}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};
