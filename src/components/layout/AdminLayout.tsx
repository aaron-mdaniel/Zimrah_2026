import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Menu, X, Shield, ExternalLink } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';

export const AdminLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Simple title generator from current pathname
  const getPageTitle = (path: string) => {
    if (path.includes('/portal/churches')) return 'Parish Churches';
    if (path.includes('/portal/participants')) return 'Contestant Registry';
    if (path.includes('/portal/events')) return 'Competition Directory';
    if (path.includes('/portal/registrations')) return 'Registrations & Rosters';
    if (path.includes('/portal/results')) return 'Result Management';
    if (path.includes('/portal/championships')) return 'Championship Standings';
    if (path.includes('/portal/audit')) return 'Audit Trail';
    return 'Dashboard Overview';
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 flex-1 max-w-xs w-full bg-slate-900 shadow-xl">
            <div className="absolute top-3 right-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-zim-primary hidden sm:inline-block" />
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {getPageTitle(location.pathname)}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-zim-primary bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>Public Live Site</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
