import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <span className="text-7xl font-black text-zim-primary/20 block mb-2">404</span>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-slate-500 mb-6">
          The competition, scorecard, or page you are looking for does not exist or has been relocated.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="default" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" /> Return to Homepage
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/results">
              <ArrowLeft className="h-4 w-4" /> All Results
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
