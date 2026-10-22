import React, { useState, useEffect } from 'react';
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
  Tooltip,
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
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useAuth } from '../context/AuthContext';

const EXPANDED_DRAWER_WIDTH = 260;
const COLLAPSED_DRAWER_WIDTH = 72;

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

  // Persistent sidebar collapsed state on desktop
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('repomind_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('repomind_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut: Cmd+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    {
      text: 'Architecture',
      icon: <AccountTreeOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/architecture` : undefined,
      soon: !currentRepoId,
    },
    { text: 'Repository Memory', icon: <MemoryIcon fontSize="small" />, soon: true },
    {
      text: 'Impact Analysis',
      icon: <FlashOnOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/impact` : undefined,
      soon: !currentRepoId,
    },
    {
      text: 'Health Dashboard',
      icon: <HealthAndSafetyOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/health` : undefined,
      soon: !currentRepoId,
    },
    {
      text: 'Productivity Intelligence',
      icon: <TimelineOutlinedIcon fontSize="small" />,
      path: currentRepoId ? `/repository/${currentRepoId}/productivity` : undefined,
      soon: !currentRepoId,
    },
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

  const currentDrawerWidth = isMobile
    ? EXPANDED_DRAWER_WIDTH
    : collapsed
    ? COLLAPSED_DRAWER_WIDTH
    : EXPANDED_DRAWER_WIDTH;

  const sidebarContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#09090d',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#e2e8f0',
        overflowX: 'hidden',
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          height: 60,
          px: collapsed ? 1.5 : 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          transition: 'padding 0.2s ease',
        }}
      >
        <Box
          onClick={() => navigate('/dashboard')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <Tooltip title={collapsed ? 'RepoMind Dashboard' : ''} placement="right">
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
                flexShrink: 0,
              }}
            >
              <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
            </Box>
          </Tooltip>

          {!collapsed && (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
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
          )}
        </Box>

        {/* Header collapse button on desktop when expanded */}
        {!isMobile && !collapsed && (
          <Tooltip title="Collapse sidebar (⌘B)" placement="bottom">
            <IconButton
              size="small"
              onClick={toggleCollapsed}
              sx={{
                color: '#64748b',
                p: 0.6,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: '#ffd21f',
                  borderColor: 'rgba(255, 210, 31, 0.4)',
                  bgcolor: 'rgba(255, 210, 31, 0.08)',
                },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Navigation Header Label / Collapsed Expand Button */}
      <Box sx={{ px: collapsed ? 1.5 : 2.5, pt: 2, pb: 1, textAlign: collapsed ? 'center' : 'left' }}>
        {collapsed ? (
          <Tooltip title="Expand sidebar (⌘B)" placement="right">
            <IconButton
              size="small"
              onClick={toggleCollapsed}
              sx={{
                color: '#64748b',
                p: 0.6,
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                mx: 'auto',
                display: 'flex',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: '#ffd21f',
                  borderColor: 'rgba(255, 210, 31, 0.4)',
                  bgcolor: 'rgba(255, 210, 31, 0.08)',
                },
              }}
            >
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            PLATFORM
          </Typography>
        )}
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: collapsed ? 1 : 1.5, py: 0.5, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map((item) => {
          const isActive = item.path && location.pathname === item.path;

          const button = (
            <ListItemButton
              disabled={item.soon}
              onClick={() => item.path && navigate(item.path)}
              sx={{
                borderRadius: '10px',
                py: 1.1,
                px: collapsed ? 0 : 1.8,
                justifyContent: collapsed ? 'center' : 'flex-start',
                minWidth: collapsed ? 44 : 'auto',
                height: 42,
                mx: collapsed ? 'auto' : 0,
                width: collapsed ? 44 : '100%',
                background: isActive ? 'rgba(255, 210, 31, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(255, 210, 31, 0.35)' : '1px solid transparent',
                boxShadow: isActive && collapsed ? '0 0 12px rgba(255, 210, 31, 0.15)' : 'none',
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
                  minWidth: collapsed ? 'auto' : 32,
                  justifyContent: 'center',
                  color: isActive ? '#ffd21f' : '#64748b',
                  transition: 'color 0.15s ease',
                }}
              >
                {item.icon}
              </ListItemIcon>

              {!collapsed && (
                <>
                  <ListItemText
                    className="nav-text"
                    primary={item.text}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: '0.85rem',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#ffffff' : '#94a3b8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
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
                </>
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.6, justifyContent: 'center' }}>
              {collapsed ? (
                <Tooltip
                  title={
                    <Box sx={{ py: 0.2 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{item.text}</Typography>
                      {item.soon && (
                        <Typography sx={{ fontSize: '0.68rem', color: '#ffd21f' }}>Coming Soon</Typography>
                      )}
                    </Box>
                  }
                  placement="right"
                  arrow
                >
                  <Box component="span" sx={{ display: 'inline-flex', justifyContent: 'center', width: 44 }}>
                    {button}
                  </Box>
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Footer info inside sidebar */}
      <Box sx={{ p: collapsed ? 1.5 : 2, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {collapsed ? (
          <Tooltip title="Grounding Engine v3.5 (Active)" placement="right" arrow>
            <Box
              sx={{
                width: 42,
                height: 42,
                mx: 'auto',
                borderRadius: '10px',
                background: 'rgba(18, 18, 24, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: 'rgba(39, 201, 63, 0.4)' },
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
            </Box>
          </Tooltip>
        ) : (
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
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
        )}
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
          width: { md: `calc(100% - ${currentDrawerWidth}px)`, xs: '100%' },
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
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isMobile ? (
            <IconButton onClick={handleDrawerToggle} sx={{ color: '#94a3b8', '&:hover': { color: '#ffffff' } }}>
              <MenuIcon fontSize="small" />
            </IconButton>
          ) : (
            <Tooltip title={collapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}>
              <IconButton
                onClick={toggleCollapsed}
                size="small"
                sx={{
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  p: 0.7,
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: '#ffd21f',
                    borderColor: 'rgba(255, 210, 31, 0.4)',
                    bgcolor: 'rgba(255, 210, 31, 0.08)',
                  },
                }}
              >
                {collapsed ? <ChevronRightIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
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
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
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
              width: EXPANDED_DRAWER_WIDTH,
              background: '#09090d',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            },
          }}
        >
          {sidebarContent}
        </Drawer>

        {/* Desktop permanent drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              overflowX: 'hidden',
              background: '#09090d',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
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
          width: { md: `calc(100% - ${currentDrawerWidth}px)`, xs: '100%' },
          minHeight: '100vh',
          pt: '60px',
          background: '#050507',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(255, 210, 31, 0.04) 0%, transparent 60%)',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default DashboardLayout;
