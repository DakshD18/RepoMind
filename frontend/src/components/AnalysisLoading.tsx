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
        background: '#09090d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background floating translucent code snippets matching screenshot #5 */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(108, 99, 255, 0.12)',
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
          color: 'rgba(255, 255, 255, 0.08)',
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
          color: 'rgba(0, 200, 150, 0.12)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        // Calculating cyclomatic complexity
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          right: '10%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(108, 99, 255, 0.1)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        useMemo(() =&gt; generateAST(), [src]);
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: '35%',
          right: '25%',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.06)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        function buildGraph(nodes: ASTNode[])
      </Box>

      {/* Central glowing radial aura */}
      <Box
        sx={{
          position: 'absolute',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'pulseAura 3s infinite ease-in-out',
          '@keyframes pulseAura': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.8 },
            '50%': { transform: 'scale(1.1)', opacity: 1 },
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
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(108,99,255,0.5)',
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
            RepoMind
          </Typography>
        </Box>

        {/* PROCESSING REPOSITORY LABEL */}
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#6c63ff',
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
            fontSize: { xs: '1.75rem', sm: '2.2rem' },
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
                  <CheckCircleIcon sx={{ color: '#00c896', fontSize: 20 }} />
                ) : isCurrent ? (
                  <CircularProgress size={18} sx={{ color: '#6c63ff' }} />
                ) : (
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.15)',
                    }}
                  />
                )}
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isDone ? '#00c896' : isCurrent ? '#ffffff' : '#555577',
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
