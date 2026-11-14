import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Edit,
  ShieldAlert,
  Plus,
  Trash2,
  Eye,
  RotateCcw,
  History,
  FileCheck2,
  UserCheck,
  AlertTriangle,
  Send,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/forms/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/hooks/useAuth';
import {
  resultService,
  EventResultStatusItem,
  ResultEntryPayload,
  EventResultDetailResponse,
} from '@/services/resultService';
import { churchService } from '@/services/churchService';
import { eventService } from '@/services/eventService';
import { GradeType, PositionType } from '@/types';

interface ScoreEntryRow {
  id?: string | number;
  chest_number: string;
  participant_name: string;
  church_id: string;
  participant_id?: string;
  position: string; // '1' | '2' | '3' | ''
  grade: GradeType;
  grade_points: string;
  position_points: string;
  remarks: string;
}

export const ResultEntryAdminPage: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const canPublish = profile?.role === 'SUPER_ADMIN' || profile?.role === 'PUBLISHER';

  // State Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');

  // Active Modals & Operations
  const [activeEvent, setActiveEvent] = useState<EventResultStatusItem | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [isCorrectMode, setIsCorrectMode] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Form State for Result Entry / Correction
  const [rows, setRows] = useState<ScoreEntryRow[]>([]);
  const [judgeNotes, setJudgeNotes] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [unpublishReason, setUnpublishReason] = useState('');

  // Queries
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['admin-results-status', debouncedSearch, statusFilter, selectedCategory, selectedDivision],
    queryFn: () =>
      resultService.getEventsResultStatus({
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        categoryId: selectedCategory || undefined,
        divisionId: selectedDivision || undefined,
      }),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['event-categories'],
    queryFn: () => eventService.getCategories(),
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ['event-divisions'],
    queryFn: () => eventService.getDivisions(),
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['churches-active'],
    queryFn: async () => {
      const res = await churchService.getChurches({ pageSize: 100 });
      return res.churches;
    },
  });

  // Query: Detail for selected event
  const { data: eventDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['admin-event-result-detail', activeEvent?.id],
    queryFn: () => (activeEvent ? resultService.getEventResultDetail(activeEvent.id) : null),
    enabled: !!activeEvent && (entryModalOpen || previewModalOpen),
  });

  // Query: Audit history for active result
  const { data: auditHistory = [], isLoading: isLoadingAudit } = useQuery({
    queryKey: ['admin-result-audit', activeEvent?.result_id],
    queryFn: () =>
      activeEvent?.result_id ? resultService.getResultAuditHistory(activeEvent.result_id) : Promise.resolve([]),
    enabled: !!activeEvent?.result_id && auditModalOpen,
  });

  // Helper to invalidate all admin and public leaderboard/result caches
  const invalidateResultQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-results-status'] });
    queryClient.invalidateQueries({ queryKey: ['admin-event-result-detail'] });
    queryClient.invalidateQueries({ queryKey: ['admin-result-audit'] });
    queryClient.invalidateQueries({ queryKey: ['live-summary'] });
    queryClient.invalidateQueries({ queryKey: ['church-standings'] });
    queryClient.invalidateQueries({ queryKey: ['individual-standings'] });
    queryClient.invalidateQueries({ queryKey: ['home-published-results'] });
    queryClient.invalidateQueries({ queryKey: ['public-published-results'] });
    queryClient.invalidateQueries({ queryKey: ['public-result-scorecard'] });
  };

  // Mutations
  const saveDraftMutation = useMutation({
    mutationFn: (data: { eventId: string | number; entries: ResultEntryPayload[]; notes: string }) =>
      resultService.saveDraft(data.eventId, data.entries, data.notes),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Draft results saved successfully with authoritative score calculations.');
        invalidateResultQueries();
        setEntryModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to save draft results');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error saving draft results');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (eventId: string | number) => resultService.publishResult(eventId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Results published successfully! Championship ledger points are now active.');
        invalidateResultQueries();
        setPreviewModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to publish results');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error publishing results');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (data: { eventId: string | number; reason: string }) =>
      resultService.unpublishResult(data.eventId, data.reason),
    onSuccess: (res) => {
      if (res.success) {
        toast.warning('Results unpublished. Points have been deactivated from public leaderboards.');
        invalidateResultQueries();
        setUnpublishModalOpen(false);
        setUnpublishReason('');
      } else {
        toast.error(res.error || 'Failed to unpublish results');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error unpublishing results');
    },
  });

  const correctMutation = useMutation({
    mutationFn: (data: { eventId: string | number; entries: ResultEntryPayload[]; reason: string }) =>
      resultService.correctResult(data.eventId, data.entries, data.reason),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Published results corrected successfully. Leaderboard points updated.');
        invalidateResultQueries();
        setEntryModalOpen(false);
        setCorrectionReason('');
      } else {
        toast.error(res.error || 'Failed to apply score correction');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error applying score correction');
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (eventId: string | number) => resultService.deleteDraft(eventId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Result draft deleted successfully.');
        invalidateResultQueries();
        setDeleteConfirmOpen(false);
      } else {
        toast.error(res.error || 'Failed to delete draft');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Error deleting draft');
    },
  });

  // Handler: Open Result Entry / Edit Form
  const handleOpenEntry = (eventItem: EventResultStatusItem, correctMode = false) => {
    setActiveEvent(eventItem);
    setIsCorrectMode(correctMode);
    setCorrectionReason('');
    setJudgeNotes(eventItem.notes || '');

    // Reset rows; if detail is loaded, pre-populate
    setRows([]);
    setEntryModalOpen(true);
  };

  const createBlankRow = React.useCallback((): ScoreEntryRow => ({
    chest_number: '',
    participant_name: '',
    church_id: churches[0] ? String(churches[0].id) : '',
    position: '',
    grade: '',
    grade_points: '0.00',
    position_points: '0.00',
    remarks: '',
  }), [churches]);

  const loadFromRegistrations = React.useCallback((regs: EventResultDetailResponse['registrations']) => {
    const populated: ScoreEntryRow[] = regs.map((r) => {
      const name = r.participant ? r.participant.name : r.group_name || 'Team Contestant';
      return {
        chest_number: r.chest_number,
        participant_name: name,
        church_id: String(r.church_id),
        participant_id: r.participant_id ? String(r.participant_id) : undefined,
        position: '',
        grade: '',
        grade_points: '0.00',
        position_points: '0.00',
        remarks: '',
      };
    });
    setRows(populated);
    toast.info(`Loaded ${populated.length} registered contestants into the scorecard.`);
  }, [toast]);

  // Populate rows once event detail is fetched
  React.useEffect(() => {
    if (eventDetail && entryModalOpen) {
      if (eventDetail.entries.length > 0) {
        const loadedRows: ScoreEntryRow[] = eventDetail.entries.map((e) => ({
          id: e.id,
          chest_number: e.chest_number,
          participant_name: e.participant_name,
          church_id: String(e.church_id || e.church?.id || ''),
          participant_id: e.participant_id ? String(e.participant_id) : undefined,
          position: e.position ? String(e.position) : '',
          grade: e.grade || '',
          grade_points: String(e.grade_points ?? '0.00'),
          position_points: String(e.position_points ?? '0.00'),
          remarks: e.remarks || '',
        }));
        setRows(loadedRows);
      } else if (eventDetail.registrations.length > 0) {
        // Auto-load registered contestants if draft is empty!
        loadFromRegistrations(eventDetail.registrations);
      } else {
        // Default 1 blank row
        setRows([createBlankRow()]);
      }
    }
  }, [eventDetail, entryModalOpen, createBlankRow, loadFromRegistrations]);

  const handleRowChange = (index: number, field: keyof ScoreEntryRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createBlankRow()]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submission
  const handleSubmitScores = () => {
    if (!activeEvent) return;

    if (rows.length === 0) {
      toast.error('Please enter at least one contestant score entry.');
      return;
    }

    // Validate rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.chest_number.trim() || !r.participant_name.trim()) {
        toast.error(`Row #${i + 1}: Chest number and contestant name are required.`);
        return;
      }
      if (!r.church_id) {
        toast.error(`Row #${i + 1}: Please select a church.`);
        return;
      }
      const gp = Number(r.grade_points);
      const pp = Number(r.position_points);
      if (isNaN(gp) || gp < 0 || isNaN(pp) || pp < 0) {
        toast.error(`Row #${i + 1}: Grade and Position points must be non-negative numbers.`);
        return;
      }
    }

    const payload: ResultEntryPayload[] = rows.map((r) => ({
      id: r.id,
      chest_number: r.chest_number.trim(),
      participant_name: r.participant_name.trim(),
      church_id: r.church_id,
      participant_id: r.participant_id || null,
      position: (r.position ? Number(r.position) : null) as PositionType,
      grade: r.grade as GradeType,
      grade_points: r.grade_points,
      position_points: r.position_points,
      remarks: r.remarks.trim(),
    }));

    if (isCorrectMode) {
      if (!correctionReason.trim()) {
        toast.error('A reason for score correction is mandatory for audit compliance.');
        return;
      }
      correctMutation.mutate({
        eventId: activeEvent.id,
        entries: payload,
        reason: correctionReason.trim(),
      });
    } else {
      saveDraftMutation.mutate({
        eventId: activeEvent.id,
        entries: payload,
        notes: judgeNotes.trim(),
      });
    }
  };

  // Preview & Publish trigger
  const handleOpenPreview = (eventItem: EventResultStatusItem) => {
    setActiveEvent(eventItem);
    setPreviewModalOpen(true);
  };

  // Unpublish trigger
  const handleOpenUnpublish = (eventItem: EventResultStatusItem) => {
    setActiveEvent(eventItem);
    setUnpublishReason('');
    setUnpublishModalOpen(true);
  };

  // Audit history trigger
  const handleOpenAudit = (eventItem: EventResultStatusItem) => {
    setActiveEvent(eventItem);
    setAuditModalOpen(true);
  };

  const eventsList = eventsData?.events || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Management & Publication Engine"
        subtitle="Authoritative server-side scoring, atomic championship ledger integration, and multi-state publication workflow"
      />

      {/* Authoritative Server Scoring Invariant Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900 shadow-xs">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block mb-0.5">Authoritative Server Scoring Invariant (ADR-006)</span>
          Total Points are calculated server-side exclusively as:{' '}
          <code className="font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-950 font-mono">
            Total Points = Grade Points + Position Points
          </code>
          . Client total inputs are strictly recalculated on the backend. Publishing updates the Church &amp; Individual
          Point Ledgers atomically.
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <Tabs defaultValue="ALL" value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="ALL">All Competitions (34)</TabsTrigger>
            <TabsTrigger value="PUBLISHED" className="text-emerald-700">
              Published
            </TabsTrigger>
            <TabsTrigger value="DRAFT" className="text-amber-700">
              Drafts
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="text-slate-600">
              Pending
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Category Filter */}
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-zim-primary/20"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Division Filter */}
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-zim-primary/20"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
          >
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                Div {d.division_number}: {d.name}
              </option>
            ))}
          </select>

          <div className="w-full sm:w-64">
            <SearchInput
              placeholder="Search code or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        </div>
      </div>

      {/* Main Competitions Scoring Status Table */}
      <Card>
        <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-zim-primary" />
            Official Competition Results Directory
          </CardTitle>
          <span className="text-xs text-slate-500 font-medium">
            Showing {eventsList.length} of 34 events
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingEvents ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner size="lg" text="Loading competition status..." />
            </div>
          ) : eventsList.length === 0 ? (
            <EmptyState
              title="No competitions match filter"
              description="Try adjusting your status filter or search query."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-20 font-bold">Code</TableHead>
                    <TableHead className="font-bold">Competition Title</TableHead>
                    <TableHead className="font-bold">Division &amp; Category</TableHead>
                    <TableHead className="text-center font-bold">Type</TableHead>
                    <TableHead className="text-center font-bold">Scorecard Entries</TableHead>
                    <TableHead className="text-center font-bold">Publication Status</TableHead>
                    <TableHead className="text-right font-bold pr-6">Management Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsList.map((ev) => (
                    <TableRow key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-mono font-bold text-zim-primary">
                        {ev.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{ev.name}</div>
                        {ev.name_malayalam && (
                          <div className="text-xs text-slate-500 font-malayalam font-normal">
                            {ev.name_malayalam}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-700">
                          {ev.division?.name || 'General Division'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {ev.category?.name || 'Competition'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={ev.event_type === 'GROUP' ? 'default' : 'secondary'}
                          className="text-[10px] uppercase font-bold"
                        >
                          {ev.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        {ev.entries_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                            <UserCheck className="h-3 w-3 text-zim-primary" />
                            {ev.entries_count} contestants
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No entries</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {ev.status === 'PUBLISHED' && (
                          <Badge variant="success" className="gap-1 text-[11px] font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> PUBLISHED
                          </Badge>
                        )}
                        {ev.status === 'DRAFT' && (
                          <Badge variant="warning" className="gap-1 text-[11px] font-bold">
                            <Clock className="h-3.5 w-3.5" /> DRAFT
                          </Badge>
                        )}
                        {ev.status === 'PENDING' && (
                          <Badge variant="outline" className="text-slate-500 text-[11px]">
                            PENDING ENTRY
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Case 1: PENDING -> Enter Scores */}
                          {ev.status === 'PENDING' && (
                            <Button
                              size="sm"
                              className="h-8 gap-1 text-xs bg-zim-primary hover:bg-zim-primary-dark"
                              onClick={() => handleOpenEntry(ev, false)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Enter Scores
                            </Button>
                          )}

                          {/* Case 2: DRAFT -> Edit, Preview & Publish, Delete */}
                          {ev.status === 'DRAFT' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-xs border-amber-300 bg-amber-50/50 hover:bg-amber-100/50 text-amber-900"
                                onClick={() => handleOpenEntry(ev, false)}
                              >
                                <Edit className="h-3.5 w-3.5 text-amber-600" /> Edit Draft
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleOpenPreview(ev)}
                              >
                                <Eye className="h-3.5 w-3.5" /> Preview &amp; Publish
                              </Button>
                              {isSuperAdmin && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                                  title="Delete Draft"
                                  onClick={() => {
                                    setActiveEvent(ev);
                                    setDeleteConfirmOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}

                          {/* Case 3: PUBLISHED -> Preview, Correct, Unpublish, Audit */}
                          {ev.status === 'PUBLISHED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 text-xs"
                                onClick={() => handleOpenPreview(ev)}
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-600" /> Scorecard
                              </Button>
                              {canPublish && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1 text-xs border-blue-200 bg-blue-50/40 hover:bg-blue-100/40 text-blue-900"
                                    onClick={() => handleOpenEntry(ev, true)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 text-blue-600" /> Correct Scores
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 gap-1 text-xs text-amber-700 hover:bg-amber-50"
                                    onClick={() => handleOpenUnpublish(ev)}
                                  >
                                    Unpublish
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800"
                                title="Audit Timeline"
                                onClick={() => handleOpenAudit(ev)}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================================================================== */}
      {/* MODAL 1: MULTI-ROW RESULT ENTRY & SCORE CORRECTION FORM */}
      {/* ==================================================================== */}
      <Dialog
        open={entryModalOpen}
        onOpenChange={(open) => {
          if (!open) setEntryModalOpen(false);
        }}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm bg-zim-primary/10 text-zim-primary px-2 py-0.5 rounded">
                      {activeEvent?.code}
                    </span>
                    <Badge variant={isCorrectMode ? 'destructive' : 'default'} className="text-[11px] font-bold">
                      {isCorrectMode ? 'OFFICIAL SCORE CORRECTION' : 'SCORECARD ENTRY'}
                    </Badge>
                  </div>
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {activeEvent?.name}
                  </DialogTitle>
                  {activeEvent?.name_malayalam && (
                    <DialogDescription className="text-xs text-slate-500 font-malayalam">
                      {activeEvent.name_malayalam} • Division: {activeEvent.division?.name || 'Music'} • Category: {activeEvent.category?.name || 'Stage'}
                    </DialogDescription>
                  )}
                </div>

                {/* Convenient 1-Click Load from Registrations */}
                {eventDetail && eventDetail.registrations.length > 0 && !isCorrectMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs border-zim-primary/30 text-zim-primary hover:bg-zim-primary/5 self-start sm:self-center"
                    onClick={() => loadFromRegistrations(eventDetail.registrations)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Load from Registrations ({eventDetail.registrations.length})
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Mandatory Reason Alert if in Correction Mode */}
              {isCorrectMode && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    Mandatory Reason for Score Correction (Audit Compliance)
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed">
                    Modifying a published result will automatically deactivate previous Point Ledger records,
                    recalculate church and individual standings, and record an immutable diff in the festival audit trail.
                  </p>
                  <Input
                    placeholder="State specific reason for correction (e.g. Tabulation error in Grade A points)..."
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="bg-white border-red-300 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Multi-row Score Entry Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 text-xs">
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead className="w-28 font-bold">Chest No *</TableHead>
                      <TableHead className="w-56 font-bold">Contestant / Team Name *</TableHead>
                      <TableHead className="w-64 font-bold">Church / Parish *</TableHead>
                      <TableHead className="w-24 font-bold text-center">Grade</TableHead>
                      <TableHead className="w-28 font-bold text-center">Grade Pts</TableHead>
                      <TableHead className="w-28 font-bold text-center">Position</TableHead>
                      <TableHead className="w-28 font-bold text-center">Position Pts</TableHead>
                      <TableHead className="w-28 font-bold text-center bg-zim-primary/5 text-zim-primary">
                        Total Pts
                      </TableHead>
                      <TableHead className="w-48 font-bold">Remarks</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const gp = Number(row.grade_points) || 0;
                      const pp = Number(row.position_points) || 0;
                      const liveTotal = (gp + pp).toFixed(2);

                      return (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell className="text-center font-mono text-xs text-slate-400">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.chest_number}
                              onChange={(e) => handleRowChange(idx, 'chest_number', e.target.value)}
                              placeholder="001"
                              className="h-8 font-mono font-bold text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.participant_name}
                              onChange={(e) => handleRowChange(idx, 'participant_name', e.target.value)}
                              placeholder="Contestant name"
                              className="h-8 text-xs font-semibold"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              value={row.church_id}
                              onChange={(e) => handleRowChange(idx, 'church_id', e.target.value)}
                              className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-zim-primary truncate"
                            >
                              <option value="">Select Church</option>
                              {churches.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.code} – {c.name}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-center">
                            <select
                              value={row.grade}
                              onChange={(e) => handleRowChange(idx, 'grade', e.target.value as GradeType)}
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-center"
                            >
                              <option value="">None</option>
                              <option value="A">Grade A</option>
                              <option value="B">Grade B</option>
                              <option value="C">Grade C</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.25"
                              min="0"
                              value={row.grade_points}
                              onChange={(e) => handleRowChange(idx, 'grade_points', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <select
                              value={row.position}
                              onChange={(e) => handleRowChange(idx, 'position', e.target.value)}
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-center"
                            >
                              <option value="">None</option>
                              <option value="1">1st Place</option>
                              <option value="2">2nd Place</option>
                              <option value="3">3rd Place</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.25"
                              min="0"
                              value={row.position_points}
                              onChange={(e) => handleRowChange(idx, 'position_points', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-xs bg-zim-primary/5 text-zim-primary">
                            {liveTotal}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.remarks}
                              onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                              placeholder="Remarks"
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-300 hover:text-red-600"
                              onClick={() => handleRemoveRow(idx)}
                              title="Delete Row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Add Contestant Row Button */}
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleAddRow}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Contestant Row
                </Button>

                <div className="text-xs text-slate-500 font-medium">
                  Total Contestants in Table: <span className="font-bold text-slate-900">{rows.length}</span>
                </div>
              </div>

              {/* Internal Judge Notes */}
              <FormField
                label="Internal Judge Notes & Tabulation Remarks"
                helpText="Administrative notes, judge jury panel numbers, or special tie-breaking records"
              >
                <textarea
                  rows={2}
                  value={judgeNotes}
                  onChange={(e) => setJudgeNotes(e.target.value)}
                  placeholder="Enter remarks from judge sheets..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-zim-primary/20"
                />
              </FormField>
            </div>

            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEntryModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleSubmitScores}
                  disabled={saveDraftMutation.isPending || correctMutation.isPending}
                  className={`text-xs gap-1.5 font-bold ${
                    isCorrectMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-zim-primary hover:bg-zim-primary-dark text-white'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  {isCorrectMode ? 'Apply Score Correction' : 'Save Draft Scorecard'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </div>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 2: RESULT PREVIEW & OFFICIAL PUBLICATION MODAL */}
      {/* ==================================================================== */}
      <Dialog
        open={previewModalOpen}
        onOpenChange={(open) => {
          if (!open) setPreviewModalOpen(false);
        }}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                  {activeEvent?.code}
                </span>
                <Badge variant={activeEvent?.status === 'PUBLISHED' ? 'success' : 'warning'} className="text-[11px] font-bold">
                  {activeEvent?.status === 'PUBLISHED' ? 'OFFICIAL PUBLISHED SCORECARD' : 'VERIFIED RESULT PREVIEW'}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {activeEvent?.name}
              </DialogTitle>
              {activeEvent?.name_malayalam && (
                <DialogDescription className="text-xs text-slate-500 font-malayalam">
                  {activeEvent.name_malayalam} • Division: {activeEvent.division?.name}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isLoadingDetail ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner text="Fetching verified scorecard..." />
                </div>
              ) : !eventDetail?.entries || eventDetail.entries.length === 0 ? (
                <EmptyState
                  title="No result entries recorded"
                  description="Please enter scores in draft mode before previewing."
                />
              ) : (
                <>
                  {/* Results Podium & Placement Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 text-xs">
                          <TableHead className="w-24 text-center font-bold">Position</TableHead>
                          <TableHead className="w-20 font-bold">Chest No</TableHead>
                          <TableHead className="font-bold">Contestant / Team</TableHead>
                          <TableHead className="font-bold">Representing Parish</TableHead>
                          <TableHead className="w-20 text-center font-bold">Grade</TableHead>
                          <TableHead className="w-24 text-center font-bold">Grade Pts</TableHead>
                          <TableHead className="w-24 text-center font-bold">Pos Pts</TableHead>
                          <TableHead className="w-28 text-center font-bold bg-zim-primary/10 text-zim-primary">
                            Total Points
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventDetail.entries.map((ent) => (
                          <TableRow key={ent.id} className="hover:bg-slate-50/50">
                            <TableCell className="text-center">
                              {ent.position === 1 && (
                                <Badge className="bg-amber-500 text-white font-bold text-xs px-2.5 py-0.5 shadow-xs">
                                  1st Place
                                </Badge>
                              )}
                              {ent.position === 2 && (
                                <Badge className="bg-slate-400 text-white font-bold text-xs px-2.5 py-0.5 shadow-xs">
                                  2nd Place
                                </Badge>
                              )}
                              {ent.position === 3 && (
                                <Badge className="bg-amber-700 text-white font-bold text-xs px-2.5 py-0.5 shadow-xs">
                                  3rd Place
                                </Badge>
                              )}
                              {!ent.position && (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-slate-800 text-xs">
                              {ent.chest_number}
                            </TableCell>
                            <TableCell className="font-bold text-slate-900 text-sm">
                              {ent.participant_name}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {ent.church?.name || ent.church_id}
                            </TableCell>
                            <TableCell className="text-center font-bold text-xs">
                              {ent.grade ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                                  {ent.grade}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              {Number(ent.grade_points).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs">
                              {Number(ent.position_points).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold text-sm bg-zim-primary/5 text-zim-primary">
                              {Number(ent.total_points).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Championship Ledger Impact Breakdown */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileCheck2 className="h-4 w-4 text-emerald-600" />
                      Championship Point Ledger Impact Summary
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Publishing will credit points to the Church Championship once per team/solo entry.
                      {activeEvent?.contributes_to_individual && (
                        <span> Individual points will also be credited to qualifying contestant standings.</span>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPreviewModalOpen(false)}
                className="text-xs"
              >
                Close Preview
              </Button>
              {activeEvent?.status !== 'PUBLISHED' && canPublish && (
                <Button
                  type="button"
                  onClick={() => activeEvent && publishMutation.mutate(activeEvent.id)}
                  disabled={publishMutation.isPending || !eventDetail?.entries?.length}
                  className="text-xs gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Publish Official Results &amp; Activate Points
                </Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 3: UNPUBLISH CONFIRMATION MODAL */}
      {/* ==================================================================== */}
      <Dialog
        open={unpublishModalOpen}
        onOpenChange={(open) => {
          if (!open) setUnpublishModalOpen(false);
        }}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                Unpublish Event Result
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to unpublish <strong>{activeEvent?.code} - {activeEvent?.name}</strong>?
                This will immediately revert the result to <strong>DRAFT</strong>, hide it from public visitors,
                and deactivate all associated Championship Point Ledger entries.
              </DialogDescription>
            </DialogHeader>

            <FormField label="Reason for Unpublishing (Optional)">
              <Input
                placeholder="e.g. Verification dispute, Judge panel review..."
                value={unpublishReason}
                onChange={(e) => setUnpublishReason(e.target.value)}
                className="text-xs"
              />
            </FormField>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUnpublishModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() =>
                  activeEvent &&
                  unpublishMutation.mutate({ eventId: activeEvent.id, reason: unpublishReason })
                }
                disabled={unpublishMutation.isPending}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                Confirm &amp; Unpublish
              </Button>
            </DialogFooter>
          </div>
        </div>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 4: AUDIT TIMELINE DRAWER */}
      {/* ==================================================================== */}
      <Dialog
        open={auditModalOpen}
        onOpenChange={(open) => {
          if (!open) setAuditModalOpen(false);
        }}
      >
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="h-5 w-5 text-zim-primary" />
                Scoring Lifecycle Audit Trail: {activeEvent?.code}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Complete immutable record of all draft saves, publications, unpublishes, and corrections.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {isLoadingAudit ? (
                <div className="py-8 flex justify-center">
                  <LoadingSpinner text="Fetching audit trail..." />
                </div>
              ) : auditHistory.length === 0 ? (
                <EmptyState
                  title="No audit entries recorded"
                  description="Changes to this result will be recorded here automatically."
                />
              ) : (
                <div className="space-y-3">
                  {auditHistory.map((item) => (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            item.action === 'RESULT_PUBLISHED'
                              ? 'success'
                              : item.action === 'RESULT_CORRECTED'
                              ? 'destructive'
                              : 'default'
                          }
                          className="font-mono text-[10px] font-bold"
                        >
                          {item.action}
                        </Badge>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium">
                        Target: <span className="font-semibold text-slate-900">{item.object_repr}</span>
                      </div>
                      <pre className="bg-white border border-slate-200 rounded p-2 font-mono text-[11px] overflow-x-auto text-slate-800">
                        {JSON.stringify(item.changes, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAuditModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </div>
      </Dialog>

      {/* Delete Draft Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Result Draft"
        description={`Are you sure you want to delete the result draft for ${activeEvent?.code} - ${activeEvent?.name}? This action cannot be undone.`}
        confirmLabel="Delete Draft"
        variant="danger"
        onConfirm={() => {
          if (activeEvent) deleteDraftMutation.mutate(activeEvent.id);
        }}
      />
    </div>
  );
};
