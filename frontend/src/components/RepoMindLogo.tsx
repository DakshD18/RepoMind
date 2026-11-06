import React from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';

export interface RepoMindLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: boolean;
  variant?: 'full' | 'mark' | 'image';
  withBox?: boolean;
  sx?: SxProps<Theme>;
  onClick?: () => void;
}

export const RepoMindLogo: React.FC<RepoMindLogoProps> = ({
  size = 32,
  showText = true,
  subtitle = false,
  variant = 'full',
  withBox = false,
  sx,
  onClick,
}) => {
  // If user requested the full pre-rendered logo graphic
  if (variant === 'image') {
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          userSelect: 'none',
          ...sx,
        }}
      >
        <Box
          component="img"
          src="/repomind-logo-transparent.png"
          alt="RepoMind — AI Intelligence for your Codebase"
          sx={{
            width: size * 2.8,
            height: 'auto',
            maxHeight: size * 1.8,
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 16px rgba(255, 210, 31, 0.3))',
          }}
        />
      </Box>
    );
  }

  const markElement = withBox ? (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.max(6, Math.round(size * 0.28))}px`,
        background: 'linear-gradient(135deg, #181824 0%, #0d0d12 100%)',
        border: '1px solid rgba(255, 210, 31, 0.45)',
        boxShadow: '0 0 16px rgba(255, 210, 31, 0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        p: '3px',
      }}
    >
      <Box
        component="img"
        src="/repomind-mark-transparent.png"
        alt="RepoMind"
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 4px rgba(255, 210, 31, 0.6))',
        }}
      />
    </Box>
  ) : (
    <Box
      component="img"
      src="/repomind-mark-transparent.png"
      alt="RepoMind"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        filter: 'drop-shadow(0 0 10px rgba(255, 210, 31, 0.4))',
      }}
    />
  );

  if (variant === 'mark' || !showText) {
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          userSelect: 'none',
          ...sx,
        }}
      >
        {markElement}
      </Box>
    );
  }

  const fontSize = Math.max(15, Math.round(size * 0.52));

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.25,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...sx,
      }}
    >
      {markElement}

      <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 800,
            fontSize: `${fontSize}px`,
            letterSpacing: '-0.025em',
            display: 'flex',
            alignItems: 'baseline',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: '#ffffff' }}>Repo</span>
          <span style={{ color: '#FFD21F' }}>Mind</span>
          <Box
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#FFD21F',
              boxShadow: '0 0 6px #FFD21F',
              display: 'inline-block',
              ml: 0.6,
            }}
          />
        </Typography>

        {subtitle && (
          <Typography
            sx={{
              fontSize: '0.62rem',
              color: '#94a3b8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              mt: 0.4,
              fontWeight: 600,
            }}
          >
            AI Intelligence for your Codebase
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default RepoMindLogo;

