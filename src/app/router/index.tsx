import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Public Pages
import { HomePage } from '@/pages/public/HomePage';
import { EventsPage } from '@/pages/public/EventsPage';
import { ResultsPage } from '@/pages/public/ResultsPage';
import { ResultDetailPage } from '@/pages/public/ResultDetailPage';
import { ChurchLeaderboardPage } from '@/pages/public/ChurchLeaderboardPage';
import { IndividualLeaderboardPage } from '@/pages/public/IndividualLeaderboardPage';
import { SearchPage } from '@/pages/public/SearchPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';

// Admin Pages
import { LoginPage } from '@/pages/admin/LoginPage';
import { ResetPasswordPage } from '@/pages/admin/ResetPasswordPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { ChurchesAdminPage } from '@/pages/admin/ChurchesAdminPage';
import { ParticipantsAdminPage } from '@/pages/admin/ParticipantsAdminPage';
import { EventsAdminPage } from '@/pages/admin/EventsAdminPage';
import { RegistrationsAdminPage } from '@/pages/admin/RegistrationsAdminPage';
import { ResultEntryAdminPage } from '@/pages/admin/ResultEntryAdminPage';
import { ChampionshipsAdminPage } from '@/pages/admin/ChampionshipsAdminPage';
import { AuditLogsAdminPage } from '@/pages/admin/AuditLogsAdminPage';

export const router = createBrowserRouter([
  // Public Routes (No authentication required)
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'results/:code', element: <ResultDetailPage /> },
      { path: 'championship/church', element: <ChurchLeaderboardPage /> },
      { path: 'championship/individual', element: <IndividualLeaderboardPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // Admin Auth Routes
  {
    path: '/portal/login',
    element: <LoginPage />,
  },
  {
    path: '/portal/reset-password',
    element: <ResetPasswordPage />,
  },

  // Protected Admin Portal Routes with Role-Based Access Control
  {
    path: '/portal',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/portal/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER']}>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'churches',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <ChurchesAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'participants',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RESULT_ADMIN']}>
            <ParticipantsAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'events',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <EventsAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'registrations',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RESULT_ADMIN']}>
            <RegistrationsAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'results',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER']}>
            <ResultEntryAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'championships',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'PUBLISHER']}>
            <ChampionshipsAdminPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit',
        element: (
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <AuditLogsAdminPage />
          </ProtectedRoute>
        ),
      },
      { path: '*', element: <Navigate to="/portal/dashboard" replace /> },
    ],
  },
]);
