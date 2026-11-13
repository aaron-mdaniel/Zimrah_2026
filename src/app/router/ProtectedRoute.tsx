import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { UserRole } from '@/types';
import { UnauthorizedPage } from '@/pages/admin/UnauthorizedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" text="Verifying authentication session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }

  // If specific roles are required, verify user role
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = profile?.role;
    // SUPER_ADMIN has blanket permission across all protected routes
    const isAllowed = userRole === 'SUPER_ADMIN' || (userRole && allowedRoles.includes(userRole));

    if (!isAllowed) {
      return <UnauthorizedPage />;
    }
  }

  return <>{children}</>;
};
