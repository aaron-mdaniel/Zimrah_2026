import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-zim-primary-dark text-slate-300 pt-12 pb-20 md:pb-12 border-t border-emerald-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-emerald-900/60">
          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/logos/zimrah_logo.png"
                alt="ZIMRAH 2026"
                className="h-10 w-auto object-contain bg-white/10 rounded-lg p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/zimrah_logo.png';
                }}
              />
              <div>
                <span className="text-lg font-black text-white tracking-tight">
                  ZIMRAH <span className="text-zim-gold">2026</span>
                </span>
                <span className="block text-xs text-amber-200/80 uppercase font-medium">
                  Song of Praise
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Youth Kalolsavam Result Management and Championship Ranking System organized by CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement.
            </p>
          </div>

          {/* Festival Venues & Schedule */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Venues & Schedule
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-zim-gold shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Literary Events:</span> 8 Nov 2026
                  <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>Thazhathmon, TVM</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-zim-gold shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Stage Events:</span> 14 Nov 2026
                  <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>St. Mathias CSI Church, Munroethuruth</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>

          {/* Quick Links & Portal */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Quick Navigation
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link to="/results" className="hover:text-zim-gold transition-colors">
                Event Results
              </Link>
              <Link to="/championship/church" className="hover:text-zim-gold transition-colors">
                Church Leaderboard
              </Link>
              <Link to="/events" className="hover:text-zim-gold transition-colors">
                34 Competitions
              </Link>
              <Link to="/championship/individual" className="hover:text-zim-gold transition-colors">
                Kalaprathibha
              </Link>
              <Link to="/search" className="hover:text-zim-gold transition-colors">
                Unified Search
              </Link>
              <Link to="/portal/login" className="text-amber-300 hover:text-amber-200 font-semibold">
                Administrative Portal
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <p>
            &copy; {new Date().getFullYear()} CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement. All rights reserved.
          </p>
          <p className="flex items-center gap-1">
            Built with <Heart className="h-3 w-3 text-red-500 fill-current" /> for ZIMRAH 2026
          </p>
        </div>
      </div>
    </footer>
  );
};
