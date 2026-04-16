import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Sun, Moon, Zap, List, ClipboardList, CircleUserRound } from 'lucide-react';
import { useTheme } from '../theme-provider';

/**
 * Main navigation bar for app routing
 */
export const Navigation: React.FC = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;
  const isDark = theme === 'dark';

  const onToggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Zap },
    { path: '/processes', label: 'All Processes', icon: List },
    { path: '/tasks', label: 'Tasks', icon: ClipboardList },
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
              <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg ring-2 ring-primary/25">
                <span className="font-bold text-sm">B</span>
              </span>
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
