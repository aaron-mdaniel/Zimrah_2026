import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Church,
  Users,
  Music,
  ClipboardList,
  Award,
  Trophy,
  History,
  LogOut,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

interface SidebarProps {
  onClose?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { profile, signOut } = useAuth();
  const userRole = profile?.role || 'SUPER_ADMIN';

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/portal/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER'],
    },
    {
      name: 'Results Workflow',
      path: '/portal/results',
      icon: Award,
      roles: ['SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER'],
    },
    {
      name: 'Churches',
      path: '/portal/churches',
      icon: Church,
      roles: ['SUPER_ADMIN'],
    },
    {
      name: 'Participants',
      path: '/portal/participants',
      icon: Users,
      roles: ['SUPER_ADMIN', 'RESULT_ADMIN'],
    },
    {
      name: 'Competitions',
      path: '/portal/events',
      icon: Music,
      roles: ['SUPER_ADMIN'],
    },
    {
      name: 'Registrations',
      path: '/portal/registrations',
      icon: ClipboardList,
      roles: ['SUPER_ADMIN', 'RESULT_ADMIN'],
    },
    {
      name: 'Championships',
      path: '/portal/championships',
      icon: Trophy,
      roles: ['SUPER_ADMIN', 'PUBLISHER'],
    },
    {
      name: 'Audit Logs',
      path: '/portal/audit',
      icon: History,
      roles: ['SUPER_ADMIN'],
    },
  ];

  // Filter navigation items by role
  const visibleNavItems = navigation.filter(
    (item) => userRole === 'SUPER_ADMIN' || item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <img
          src="/logos/zimrah_logo.png"
          alt="ZIMRAH 2026"
          className="h-8 w-auto object-contain rounded p-0.5 bg-white/10"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/zimrah_logo.png';
          }}
        />
        <div>
          <span className="block font-black text-white text-base tracking-tight leading-none">
            ZIMRAH <span className="text-zim-gold">Portal</span>
          </span>
          <span className="block text-[10px] text-slate-400 uppercase font-semibold mt-0.5">
            Admin Console
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Management
        </div>
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all group',
                isActive
                  ? 'bg-zim-primary text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-white'
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-amber-300" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-6 px-3 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Public System
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
        >
          <div className="flex items-center gap-3">
            <ExternalLink className="h-4 w-4 text-slate-400" />
            <span>Public Scoreboard</span>
          </div>
        </a>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <span className="block text-xs font-bold text-white truncate">
              {profile?.username || 'Administrator'}
            </span>
            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 uppercase">
              {profile?.role || 'SUPER_ADMIN'}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
