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

const NAV_ITEMS: NavItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/dashboard' },
  { text: 'Repository Chat', icon: <ChatOutlinedIcon fontSize="small" />, soon: true },
  { text: 'Architecture', icon: <AccountTreeOutlinedIcon fontSize="small" />, soon: true },
  { text: 'Repository Memory', icon: <MemoryIcon fontSize="small" />, soon: true },
  { text: 'Impact Analysis', icon: <FlashOnOutlinedIcon fontSize="small" />, soon: true },
  { text: 'Health Dashboard', icon: <HealthAndSafetyOutlinedIcon fontSize="small" />, soon: true },
  { text: 'Technical Debt', icon: <WarningAmberOutlinedIcon fontSize="small" />, soon: true },
  { text: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" />, soon: true },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
        background: '#0a0a0a',
        borderRight: '1px solid #262626',
        color: '#e5e5e5',
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
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            background: '#151515',
            border: '1px solid rgba(255, 210, 31, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(255, 210, 31, 0.15)',
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#ffd21f', fontSize: 18 }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: '1.15rem',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            RepoMind
          </Typography>
          <Box
            component="span"
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#ffd21f',
              boxShadow: '0 0 6px #ffd21f',
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
            color: '#737373',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          PLATFORM
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ px: 1.5, py: 0.5, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.path && location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                disabled={item.soon}
                onClick={() => item.path && navigate(item.path)}
                sx={{
                  borderRadius: '8px',
                  py: 1,
                  px: 1.75,
                  background: isActive ? 'rgba(255, 210, 31, 0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(255, 210, 31, 0.25)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    background: isActive ? 'rgba(255, 210, 31, 0.12)' : '#151515',
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
                    color: isActive ? '#ffd21f' : '#737373',
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
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#ffffff' : '#a3a3a3',
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
                      background: '#151515',
                      color: '#737373',
                      border: '1px solid #262626',
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
      <Box sx={{ p: 2, borderTop: '1px solid #1a1a1a' }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: '8px',
            background: '#111111',
            border: '1px solid #262626',
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
              background: '#ffd21f',
              boxShadow: '0 0 8px rgba(255, 210, 31, 0.7)',
            }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: '#a3a3a3', fontWeight: 500 }}>
            Active Engine
          </Typography>
          <Chip
            label="v1.0"
            size="small"
            sx={{
              ml: 'auto',
              height: 16,
              fontSize: '0.625rem',
              color: '#ffd21f',
              background: 'rgba(255, 210, 31, 0.1)',
              border: '1px solid rgba(255, 210, 31, 0.25)',
              borderRadius: '3px',
              '& .MuiChip-label': { px: 0.5 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#050505' }}>
      {/* Top App Bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)`, xs: '100%' },
          height: 60,
          zIndex: 1100,
          background: 'rgba(10, 10, 10, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #262626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isMobile && (
            <IconButton onClick={handleDrawerToggle} sx={{ color: '#a3a3a3', '&:hover': { color: '#ffffff' } }}>
              <MenuIcon fontSize="small" />
            </IconButton>
          )}

          {/* Search Input Bar */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              background: '#0f0f0f',
              border: '1px solid #262626',
              borderRadius: '8px',
              px: 1.5,
              py: 0.4,
              width: 280,
              transition: 'all 0.2s ease',
              '&:focus-within': {
                border: '1px solid #ffd21f',
                boxShadow: '0 0 12px rgba(255, 210, 31, 0.15)',
              },
            }}
          >
            <SearchIcon sx={{ color: '#737373', fontSize: 18, mr: 1 }} />
            <InputBase
              placeholder="Quick search..."
              sx={{
                color: '#ffffff',
                fontSize: '0.825rem',
                flex: 1,
                '& input::placeholder': { color: '#737373', opacity: 1 },
              }}
            />
            <Chip
              label="⌘K"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                color: '#737373',
                background: '#1a1a1a',
                border: '1px solid #262626',
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
              color: '#a3a3a3',
              background: '#111111',
              border: '1px solid #262626',
              p: 0.8,
              borderRadius: '8px',
              transition: 'all 0.15s ease',
              '&:hover': { color: '#ffffff', background: '#151515', borderColor: '#333333' },
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
              background: '#111111',
              border: '1px solid #262626',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: '#151515',
                borderColor: 'rgba(255, 210, 31, 0.4)',
              },
            }}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                background: '#1a1a1a',
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
                  background: '#111111',
                  border: '1px solid #262626',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(255, 210, 31, 0.05)',
                  borderRadius: '10px',
                  mt: 1,
                  minWidth: 180,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.2 }}>
              <Typography sx={{ fontSize: '0.825rem', fontWeight: 600, color: '#ffffff' }}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#737373' }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: '#262626' }} />
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
              background: '#0a0a0a',
              borderRight: '1px solid #262626',
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
              background: '#0a0a0a',
              borderRight: '1px solid #262626',
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
          background: '#050505',
          backgroundImage: 'radial-gradient(ellipse at top left, rgba(255, 210, 31, 0.03) 0%, transparent 60%)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
