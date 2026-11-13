import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export const UnauthorizedPage: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-red-200 bg-red-50/30 text-center shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-xs">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl text-red-950 font-black">
            Access Restricted
          </CardTitle>
          <CardDescription className="text-sm text-red-800">
            Your current administrative role (<span className="font-bold text-red-900">{profile?.role || 'UNASSIGNED'}</span>) does not have sufficient permissions to access this module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-600 bg-white border border-red-100 p-3 rounded-lg leading-relaxed text-left">
            If you require access to this section (e.g., Result Publishing or Audit Logs), please contact the <span className="font-semibold text-slate-800">System Super Administrator</span> to request elevated permissions.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 font-bold">
              <Link to="/portal/dashboard">
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 font-bold">
              <Link to="/">
                <Home className="h-4 w-4" /> Public Portal
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
