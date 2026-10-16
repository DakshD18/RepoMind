import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  IconButton,
  InputBase,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import FlashOnOutlinedIcon from '@mui/icons-material/FlashOnOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useAuth } from '../context/AuthContext';

const DRAWER_WIDTH = 260;

interface NavItem {
  text: string;
  icon: React.ReactNode;
  path?: string;
  soon?: boolean;
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Detect active repository context from current URL
  const repoMatch = location.pathname.match(/\/repository\/(\d+)/);
  const currentRepoId = repoMatch ? repoMatch[1] : null;

  const navItems: NavItem[] = [
    { text: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/dashboard' },
    {
      text: 'Repository Chat',
      icon: <ChatOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/chat` : undefined,
      soon: !currentRepoId,
    },
    { text: 'Architecture', icon: <AccountTreeOutlinedIcon fontSize="small" />, soon: true },
    { text: 'Repository Memory', icon: <MemoryIcon fontSize="small" />, soon: true },
    {
      text: 'Impact Analysis',
      icon: <FlashOnOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/impact` : undefined,
      soon: !currentRepoId,
    },
    { text: 'Health Dashboard', icon: <HealthAndSafetyOutlinedIcon fontSize="small" />, soon: true },
    { text: 'Technical Debt', icon: <WarningAmberOutlinedIcon fontSize="small" />, soon: true },
    { text: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" />, soon: true },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileClose();
    logout();
    navigate('/');
  };

  const sidebarContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#09090d',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#e2e8f0',
      }}
    >
      {/* Brand Header */}
      <Box
        onClick={() => navigate('/dashboard')}
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #181824 0%, #101016 100%)',
            border: '1px solid rgba(255, 210, 31, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255, 210, 31, 0.18)',
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: '1.2rem',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            RepoMind
          </Typography>
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ffd21f',
              boxShadow: '0 0 8px #ffd21f',
              display: 'inline-block',
            }}
          />
        </Box>
      </Box>

      {/* Navigation Header Label */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
        <Typography
          sx={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          PLATFORM
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 1.5, py: 0.5, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = item.path && location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.6 }}>
              <ListItemButton
                disabled={item.soon}
                onClick={() => item.path && navigate(item.path)}
                sx={{
                  borderRadius: '10px',
                  py: 1.1,
                  px: 1.8,
                  background: isActive ? 'rgba(255, 210, 31, 0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
                  transition: 'all 0.18s ease',
                  '&:hover': {
                    background: isActive ? 'rgba(255, 210, 31, 0.14)' : 'rgba(255, 255, 255, 0.05)',
                    '& .nav-icon': {
                      color: isActive ? '#ffd21f' : '#ffffff',
                    },
                    '& .nav-text': {
                      color: '#ffffff',
                    },
                  },
                  '&.Mui-disabled': {
                    opacity: 0.45,
                  },
                }}
              >
                <ListItemIcon
                  className="nav-icon"
                  sx={{
                    minWidth: 32,
                    color: isActive ? '#ffd21f' : '#64748b',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  className="nav-text"
                  primary={item.text}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#ffffff' : '#94a3b8',
                        transition: 'color 0.15s ease',
                      },
                    },
                  }}
                />
                {item.soon && (
                  <Chip
                    label="SOON"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: '#64748b',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      '& .MuiChip-label': { px: 0.7 },
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer info inside sidebar */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: '10px',
            background: 'rgba(18, 18, 24, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#27c93f',
              boxShadow: '0 0 8px #27c93f',
            }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
            Grounding Engine
          </Typography>
          <Chip
            label="v3.5"
            size="small"
            sx={{
              ml: 'auto',
              height: 18,
              fontSize: '0.625rem',
              color: '#ffd21f',
              background: 'rgba(255, 210, 31, 0.12)',
              border: '1px solid rgba(255, 210, 31, 0.3)',
              borderRadius: '4px',
              fontWeight: 700,
              '& .MuiChip-label': { px: 0.6 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#050507' }}>
      {/* Top App Bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)`, xs: '100%' },
          height: 60,
          zIndex: 1100,
          background: 'rgba(9, 9, 13, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isMobile && (
            <IconButton onClick={handleDrawerToggle} sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}>
              <MenuIcon fontSize="small" />
            </IconButton>
          )}

          {/* Search Input Bar */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              background: 'rgba(16, 16, 22, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              px: 1.8,
              py: 0.4,
              width: 280,
              transition: 'all 0.2s ease',
              '&:focus-within': {
                border: '1px solid #ffd21f',
                boxShadow: '0 0 14px rgba(255, 210, 31, 0.15)',
              },
            }}
          >
            <SearchIcon sx={{ color: '#64748b', fontSize: 18, mr: 1 }} />
            <InputBase
              placeholder="Quick search..."
              sx={{
                color: '#ffffff',
                fontSize: '0.825rem',
                flex: 1,
                '& input::placeholder': { color: '#64748b', opacity: 1 },
              }}
            />
            <Chip
              label="⌘K"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                color: '#64748b',
                background: '#161622',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                '& .MuiChip-label': { px: 0.6 },
              }}
            />
          </Box>
        </Box>

        {/* User Right Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            sx={{
              color: '#94a3b8',
              background: 'rgba(18, 18, 24, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              p: 0.8,
              borderRadius: '8px',
              transition: 'all 0.15s ease',
              '&:hover': { color: '#ffffff', background: '#1c1c28', borderColor: 'rgba(255, 255, 255, 0.15)' },
            }}
          >
            <NotificationsNoneIcon fontSize="small" />
          </IconButton>

          <Box
            onClick={handleProfileClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              cursor: 'pointer',
              p: 0.5,
              pr: 1.5,
              borderRadius: '20px',
              background: 'rgba(18, 18, 24, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: '#181824',
                borderColor: 'rgba(255, 210, 31, 0.4)',
              },
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                background: '#181824',
                color: '#ffd21f',
                border: '1px solid rgba(255, 210, 31, 0.4)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Typography sx={{ fontSize: '0.825rem', fontWeight: 600, color: '#ffffff' }}>
              {user?.first_name || user?.email?.split('@')[0] || 'User'}
            </Typography>
          </Box>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileClose}
            slotProps={{
              paper: {
                sx: {
                  background: '#121218',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.85), 0 0 15px rgba(255, 210, 31, 0.05)',
                  borderRadius: '12px',
                  mt: 1,
                  minWidth: 190,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.2 }}>
              <Typography sx={{ fontSize: '0.825rem', fontWeight: 600, color: '#ffffff' }}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.07)' }} />
            <MenuItem
              onClick={handleLogout}
              sx={{
                fontSize: '0.825rem',
                color: '#ef5350',
                gap: 1.5,
                '&:hover': { background: 'rgba(239, 83, 80, 0.1)' },
              }}
            >
              <LogoutIcon fontSize="small" />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Responsive Sidebar Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              background: '#09090d',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          {sidebarContent}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              background: '#09090d',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            },
          }}
          open
        >
          {sidebarContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)`, xs: '100%' },
          minHeight: '100vh',
          pt: '60px',
          background: '#050507',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(255, 210, 31, 0.04) 0%, transparent 60%)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
