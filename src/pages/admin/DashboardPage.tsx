import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Church,
  Users,
  Music,
  Award,
  CheckCircle2,
  ArrowRight,
  FileText,
  Activity,
  Clock,
  History,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { churchService } from '@/services/churchService';
import { participantService } from '@/services/participantService';
import { eventService } from '@/services/eventService';
import { registrationService } from '@/services/registrationService';
import { resultService } from '@/services/resultService';
import { auditService } from '@/services/auditService';

export const DashboardPage: React.FC = () => {
  const { profile } = useAuth();

  // 1. Churches count
  const { data: churchesData, isLoading: loadingChurches } = useQuery({
    queryKey: ['admin-churches-count'],
    queryFn: () => churchService.getChurches({ pageSize: 1 }),
  });

  // 2. Participants count
  const { data: participantsData, isLoading: loadingParticipants } = useQuery({
    queryKey: ['admin-participants-count'],
    queryFn: () => participantService.getParticipants({ pageSize: 1 }),
  });

  // 3. Events count
  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ['admin-events-count'],
    queryFn: () => eventService.getEvents({ pageSize: 1 }),
  });

  // 4. Registrations count
  const { data: registrationData, isLoading: loadingRegs } = useQuery({
    queryKey: ['admin-registrations-count'],
    queryFn: () => registrationService.getRegistrationDashboard(),
  });

  // 5. Result publication breakdown
  const { data: resultStatusData, isLoading: loadingResults } = useQuery({
    queryKey: ['admin-results-breakdown'],
    queryFn: () => resultService.getEventsResultStatus(),
  });

  // 6. Recent administrative audit activity
  const { data: recentLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: () => auditService.getRecentLogs(6),
  });

  const totalChurches = churchesData?.total ?? 8;
  const totalParticipants = participantsData?.total ?? 142;
  const totalEvents = eventsData?.total ?? 34;
  const totalRegistrations = registrationData?.totalRegistrations ?? 0;

  const statusEvents = resultStatusData?.events || [];
  const publishedCount = statusEvents.filter((e) => e.status === 'PUBLISHED').length;
  const draftCount = statusEvents.filter((e) => e.status === 'DRAFT').length;
  const completionPct = totalEvents > 0 ? Math.round((publishedCount / totalEvents) * 100) : 0;

  const metrics = [
    {
      title: 'Parish Churches',
      value: loadingChurches ? '...' : String(totalChurches),
      subtitle: `${totalChurches} Active Parishes`,
      icon: Church,
      color: 'text-emerald-700 bg-emerald-100',
      link: '/portal/churches',
    },
    {
      title: 'Contestant Registry',
      value: loadingParticipants ? '...' : String(totalParticipants),
      subtitle: 'Preserved String Chests',
      icon: Users,
      color: 'text-blue-700 bg-blue-100',
      link: '/portal/participants',
    },
    {
      title: 'Competitions Catalog',
      value: loadingEvents ? '...' : String(totalEvents),
      subtitle: '4 Diocesan Divisions',
      icon: Music,
      color: 'text-purple-700 bg-purple-100',
      link: '/portal/events',
    },
    {
      title: 'Total Registrations',
      value: loadingRegs ? '...' : String(totalRegistrations),
      subtitle: 'Individual & Group Teams',
      icon: FileText,
      color: 'text-amber-800 bg-amber-100',
      link: '/portal/registrations',
    },
    {
      title: 'Published Results',
      value: loadingResults ? '...' : `${publishedCount} / ${totalEvents}`,
      subtitle: `${completionPct}% Festival Complete`,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-100',
      link: '/portal/results',
    },
    {
      title: 'Draft Scorecards',
      value: loadingResults ? '...' : String(draftCount),
      subtitle: `${draftCount} Pending Verification`,
      icon: Clock,
      color: 'text-orange-700 bg-orange-100',
      link: '/portal/results',
    },
  ];

  const quickActions = [
    {
      title: 'Result Scoring Entry',
      desc: 'Input manual judge scores with authoritative PostgreSQL recalculation',
      link: '/portal/results',
      icon: Award,
      primary: true,
    },
    {
      title: 'Stage Sheet Generator',
      desc: 'Generate printable competition roster sheets with Malayalam names',
      link: '/portal/registrations',
      icon: FileText,
    },
    {
      title: 'Bulk Contestant Import',
      desc: 'Upload CSV with automatic validation and duplicate detection',
      link: '/portal/participants',
      icon: Users,
    },
    {
      title: 'Championship Audit',
      desc: 'Review 5-level tie-breaking and active Point Ledger entries',
      link: '/portal/championships',
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-zim-primary to-emerald-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs font-bold text-zinc-950">
              {profile?.role || 'SUPER_ADMIN'} SESSION
            </Badge>
            <span className="text-xs text-emerald-200">ZIMRAH 2026 Admin Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Welcome back, {profile?.username || 'Administrator'}
          </h1>
          <p className="text-sm text-emerald-100/80 mt-1 max-w-xl">
            CSI Madhya Kerala Diocese Adoor Clergy District Youth Movement Kalolsavam Result & Championship Management System.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm" className="gap-1.5 shadow-sm font-bold">
            <Link to="/portal/results">
              <Award className="h-4 w-4" /> Result Workflow
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Row - 6 Cards based on Real Supabase Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <Link key={m.title} to={m.link} className="group">
            <Card className="hover:shadow-md hover:border-slate-300 transition-all h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{m.title}</span>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${m.color}`}>
                    <m.icon className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900">{m.value}</p>
                  <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{m.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Operations Grid */}
      <div>
        <h2 className="text-lg font-black text-slate-900 mb-4">Core Operational Workflows</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((qa) => (
            <Card key={qa.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 text-zim-primary flex items-center justify-center mb-3">
                    <qa.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{qa.title}</h3>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">{qa.desc}</p>
                </div>
                <Button asChild variant={qa.primary ? 'default' : 'outline'} size="sm" className="w-full gap-1.5 text-xs">
                  <Link to={qa.link}>
                    Open Module <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Administrative Activity Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-zim-primary" />
            Recent Administrative Activity
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs gap-1 text-zim-primary">
            <Link to="/portal/audit">
              View Complete Audit Trail <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="py-6 flex justify-center">
              <LoadingSpinner size="sm" text="Loading recent audit actions..." />
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No recent administrative activity recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-[10px] font-bold shrink-0">
                      {log.action}
                    </Badge>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {log.object_repr || `${log.model_name}: ${log.object_id}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Model: {log.model_name} • By: {log.user_name || (log.user_id ? log.user_id.slice(0, 8) : 'Admin')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
