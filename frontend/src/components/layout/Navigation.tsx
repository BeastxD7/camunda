import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Sun, Moon, Zap, List, ClipboardList, CircleUserRound, Database, RefreshCw, Contact } from 'lucide-react';
import { api } from '@/lib/api';
import { useTheme } from '../theme-provider';

/**
 * Main navigation bar for app routing
 */
export const Navigation: React.FC = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [sourceMode, setSourceMode] = useState<'camunda' | 'db'>('camunda');
  const [syncing, setSyncing] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isDark = theme === 'dark';
  const optimizeCollectionId = import.meta.env.VITE_OPTIMIZE_COLLECTION_ID || '';

  useEffect(() => {
    void api.demo.getSourceMode()
      .then((response) => {
        if (response.success && response.data?.mode) {
          setSourceMode(response.data.mode);
        }
      })
      .catch(() => {
        setSourceMode('camunda');
      });
  }, []);

  const onToggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const onToggleSourceMode = async (mode: 'camunda' | 'db') => {
    if (mode === sourceMode) return;
    setSwitching(true);
    try {
      await api.demo.setSourceMode(mode);
      setSourceMode(mode);
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  };

  const onSyncDemoData = async () => {
    setSyncing(true);
    try {
      if (!optimizeCollectionId) {
        throw new Error('VITE_OPTIMIZE_COLLECTION_ID is required to sync demo Optimize data.');
      }

      await api.demo.syncAll(optimizeCollectionId);
      setSourceMode('db');
      await api.demo.setSourceMode('db');
      window.location.reload();
    } finally {
      setSyncing(false);
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Zap },
    { path: '/processes', label: 'All Processes', icon: List },
    { path: '/tasks', label: 'Tasks', icon: ClipboardList },
    { path: '/customers', label: 'Customers', icon: Contact },
  ];

  return (
    <nav className="support-header fixed top-0 left-0 right-0 z-50 rounded-none border-b border-border/60 px-4 sm:px-6 lg:px-8 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="group flex items-center gap-2.5 transition-all hover:opacity-80 active:scale-95">
            {/* Logo Icon with gradient background */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg blur-md" />
              {/* <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg ring-2 ring-primary/25"> */}
                {/* <span className="font-bold text-sm">B</span> */}
              {/* </span> */}
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-7sXfsQAXFT4k2X_Ox5SX_gDDl8YD9tBKpQ&s" alt="CAMUNDA" className='w-20 rounded-md'/>
            </div>

            {/* Brand Text */}
            <div className="flex flex-col">
              <span className="block font-bold text-lg leading-none text-foreground">
                Bank Support
              </span>
              <span className="block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground/70">
                Smart Case Management
              </span>
            </div>
          </Link>

          {/* Center Navigation Items */}
          <div className="hidden lg:flex items-center gap-1 ml-12">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border/70 bg-secondary/30 px-2 py-1.5 text-xs md:flex">
              <Database size={14} className="text-muted-foreground" />
              <button
                type="button"
                onClick={() => void onToggleSourceMode('camunda')}
                disabled={switching || sourceMode === 'camunda'}
                className={`rounded-md px-2 py-1 transition-colors ${sourceMode === 'camunda' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Camunda
              </button>
              <button
                type="button"
                onClick={() => void onToggleSourceMode('db')}
                disabled={switching || sourceMode === 'db'}
                className={`rounded-md px-2 py-1 transition-colors ${sourceMode === 'db' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                DB
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onSyncDemoData()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-sm text-foreground transition-all hover:border-border/100 hover:bg-secondary/50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Sync DB</span>
            </button>

            {/* Search - Hidden on mobile */}
            <div className="hidden items-center rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-muted-foreground md:flex hover:border-border/100 transition-colors">
              <Search size={14} />
              <span className="ml-2 text-xs font-medium">Search</span>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-sm text-foreground transition-all hover:border-border/100 hover:bg-secondary/50"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden md:inline font-medium">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            {/* Profile Button */}
            <button
              type="button"
              aria-label="Profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-secondary/30 text-muted-foreground transition-all hover:text-foreground hover:border-border/100 hover:bg-secondary/50"
            >
              <CircleUserRound size={18} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
