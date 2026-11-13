import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Music, Award, Trophy, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MobileNav: React.FC = () => {
  const tabs = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Events', path: '/events', icon: Music },
    { label: 'Results', path: '/results', icon: Award },
    { label: 'Championship', path: '/championship/church', icon: Trophy },
    { label: 'Search', path: '/search', icon: Search },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200/90 shadow-lg px-2 py-1 safe-area-pb">
      <div className="grid grid-cols-5 items-center">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-colors',
                isActive
                  ? 'text-zim-primary font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            {({ isActive }) => (
              <>
                <tab.icon
                  className={cn(
                    'h-5 w-5 mb-0.5 transition-transform',
                    isActive && 'scale-110 stroke-[2.5]'
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
