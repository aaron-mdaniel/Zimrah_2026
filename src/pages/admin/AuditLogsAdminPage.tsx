import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Shield, Eye, Calendar, User, Terminal } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/forms/SearchInput';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { auditService } from '@/services/auditService';
import type { AuditLog } from '@/types';

export const AuditLogsAdminPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch real audit logs from Supabase
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => auditService.getRecentLogs(150),
    refetchInterval: 30000,
  });

  const filtered = logs.filter((log) => {
    const s = search.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(s)) ||
      (log.model_name && log.model_name.toLowerCase().includes(s)) ||
      (log.object_repr && log.object_repr.toLowerCase().includes(s)) ||
      (log.user_name && log.user_name.toLowerCase().includes(s)) ||
      (log.ip_address && log.ip_address.includes(s))
    );
  });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('PUBLISH') || action.includes('CREATED') || action.includes('IMPORT')) {
      return 'success';
    }
    if (action.includes('CORRECT') || action.includes('UPDATE')) {
      return 'warning';
    }
    if (action.includes('UNPUBLISH') || action.includes('DELETE')) {
      return 'destructive';
    }
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrative Audit Trail"
        subtitle="Immutable transaction log capturing user identity, modified models, and timestamped changes"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:w-80">
          <SearchInput
            placeholder="Search action, model, or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Shield className="h-4 w-4 text-emerald-600" />
          <span>PostgreSQL Append-Only Ledger • RLS Protected</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zim-primary" />
              <span>Audit Records ({filtered.length})</span>
            </div>
            {isLoading && <span className="text-xs text-slate-400 font-normal">Refreshing...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {isLoading && logs.length === 0 ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="md" text="Loading immutable audit logs..." />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit logs found"
              description={search ? `No records matching "${search}"` : 'Audit trail is currently empty.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Action</TableHead>
                    <TableHead>Target Entity</TableHead>
                    <TableHead>User / Admin</TableHead>
                    <TableHead className="text-center">IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Inspection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <Badge
                          variant={getActionBadgeVariant(log.action)}
                          className="font-mono text-[10px] font-bold"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-slate-900">
                          {log.object_repr || `${log.model_name}: ${log.object_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Model: {log.model_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{log.user_name || (log.user_id ? log.user_id.slice(0, 8) + '...' : 'System / Trigger')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-slate-500">
                        {log.ip_address || '127.0.0.1'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-8 gap-1 text-xs text-slate-600 hover:text-zim-primary"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Diff
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JSON Changes Diff Viewer Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Terminal className="h-5 w-5 text-zim-primary" />
              Audit Transaction Inspection
            </DialogTitle>
            <DialogDescription>
              Detailed mutation metadata recorded in PostgreSQL audit logs
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium">Action: </span>
                  <span className="font-bold text-slate-900 font-mono">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Model: </span>
                  <span className="font-bold text-slate-900 font-mono">{selectedLog.model_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Target ID: </span>
                  <span className="font-bold text-slate-900 font-mono">{selectedLog.object_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Timestamp: </span>
                  <span className="font-bold text-slate-900">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payload & Diff Snapshot (JSON)
                </p>
                <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-80">
                  {JSON.stringify(selectedLog.changes || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
