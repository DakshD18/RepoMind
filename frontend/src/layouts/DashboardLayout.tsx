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
        background: '#0c0c12',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        color: '#e0e0ff',
      }}
    >
      {/* Brand Header */}
      <Box
        onClick={() => navigate('/dashboard')}
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6c63ff 0%, #00c896 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(108, 99, 255, 0.4)',
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 40%, #a0a0cc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          RepoMind
        </Typography>
      </Box>

      {/* Navigation Header Label */}
      <Box sx={{ px: 3, pt: 1, pb: 1 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#555577',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
          }}
        >
          NAVIGATION
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
                  borderRadius: '10px',
                  py: 1,
                  px: 2,
                  background: isActive ? 'rgba(108, 99, 255, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(108, 99, 255, 0.25)' : '1px solid transparent',
                  '&:hover': {
                    background: isActive ? 'rgba(108, 99, 255, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 34,
                    color: isActive ? '#6c63ff' : '#8888aa',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#ffffff' : '#a0a0c0',
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
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      background: 'rgba(108, 99, 255, 0.15)',
                      color: '#8b84ff',
                      border: '1px solid rgba(108, 99, 255, 0.2)',
                      borderRadius: '4px',
                      '& .MuiChip-label': { px: 0.8 },
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer info inside sidebar */}
      <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
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
              background: '#00c896',
              boxShadow: '0 0 10px #00c896',
            }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: '#8888aa', fontWeight: 500 }}>
            Phase 1 Active Engine
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: '#09090d' }}>
      {/* Top App Bar */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)`, xs: '100%' },
          height: 64,
          zIndex: 1100,
          background: 'rgba(9, 9, 13, 0.8)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isMobile && (
            <IconButton onClick={handleDrawerToggle} sx={{ color: '#8888aa' }}>
              <MenuIcon />
            </IconButton>
          )}

          {/* Search Input Bar */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              px: 1.5,
              py: 0.5,
              width: 280,
              transition: 'all 0.2s ease',
              '&:focus-within': {
                border: '1px solid rgba(108, 99, 255, 0.5)',
                background: 'rgba(108, 99, 255, 0.05)',
              },
            }}
          >
            <SearchIcon sx={{ color: '#555577', fontSize: 18, mr: 1 }} />
            <InputBase
              placeholder="Search..."
              sx={{
                color: '#e0e0ff',
                fontSize: '0.85rem',
                flex: 1,
                '& input::placeholder': { color: '#555577', opacity: 1 },
              }}
            />
            <Chip
              label="⌘K"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                color: '#666688',
                background: 'rgba(255, 255, 255, 0.05)',
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
              color: '#8888aa',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              p: 1,
              '&:hover': { color: '#e0e0ff', background: 'rgba(255, 255, 255, 0.05)' },
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
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.2s ease',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
              },
            }}
          >
            <Avatar
              sx={{
                width: 30,
                height: 30,
                background: 'linear-gradient(135deg, #6c63ff, #00c896)',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#e0e0ff' }}>
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
                  background: '#12121c',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  borderRadius: '12px',
                  mt: 1,
                  minWidth: 160,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e0e0ff' }}>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#777799' }}>
                {user?.email}
              </Typography>
            </Box>
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />
            <MenuItem
              onClick={handleLogout}
              sx={{
                fontSize: '0.85rem',
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
              background: '#0c0c12',
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
              background: '#0c0c12',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
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
          pt: '64px',
          background: 'radial-gradient(ellipse at top left, rgba(108, 99, 255, 0.05) 0%, transparent 60%)',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
