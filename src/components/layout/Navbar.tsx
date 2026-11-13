import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Trophy, Music, Home, Award, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Navbar: React.FC = () => {
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Events', path: '/events', icon: Music },
    { name: 'Results', path: '/results', icon: Award },
    { name: 'Church Standing', path: '/championship/church', icon: Trophy },
    { name: 'Individual Standing', path: '/championship/individual', icon: Award },
  ];

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-zim-primary-dark via-zim-primary to-zim-primary-light text-amber-100 text-xs py-1.5 px-4 border-b border-amber-500/20 text-center font-medium">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping inline-block" />
          <span>CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement | Kalolsavam 2026</span>
        </span>
      </div>

      {/* Main Sticky Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logos & Brand Title */}
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src="/logos/csi_diocese_emblem.png"
                alt="CSI Diocese Emblem"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/csi_diocese_emblem.png';
                }}
              />
              <div className="border-l border-slate-200 pl-3">
                <span className="block text-lg font-black tracking-tight text-zim-primary">
                  ZIMRAH <span className="text-zim-gold">2026</span>
                </span>
                <span className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase -mt-1">
                  Song of Praise
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-sm font-semibold transition-all',
                      isActive
                        ? 'bg-emerald-50 text-zim-primary font-bold shadow-xs'
                        : 'text-slate-600 hover:text-zim-primary hover:bg-slate-50'
                    )}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Search & Admin Portal Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/search"
                className="p-2 rounded-lg text-slate-500 hover:text-zim-primary hover:bg-slate-100 transition-colors"
                title="Search Competitions & Participants"
              >
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
              </Link>
              <Link
                to="/portal/login"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zim-primary bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                Portal
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
