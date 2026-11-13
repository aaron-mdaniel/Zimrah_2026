import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Printer,
  UserPlus,
  Users,
  Trash2,
  RefreshCw,
  FileText,
  ListCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/forms/SearchInput';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/forms/FormField';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { registrationService, RegistrationDashboardEvent } from '@/services/registrationService';
import { churchService } from '@/services/churchService';
import { eventService } from '@/services/eventService';
import { Registration, CompetitionEvent } from '@/types';

// Zod schema for Individual Registration
const individualSchema = z.object({
  event_id: z.string().min(1, 'Please select a competition event'),
  church_id: z.string().min(1, 'Please select a parish church'),
  participant_id: z.string().min(1, 'Please select a contestant'),
  chest_number: z.string().optional().or(z.literal('')),
});

// Zod schema for Group Registration
const groupSchema = z.object({
  event_id: z.string().min(1, 'Please select a group competition'),
  church_id: z.string().min(1, 'Please select a parish church'),
  group_name: z.string().min(2, 'Team name must be at least 2 characters'),
  chest_number: z.string().min(1, 'Team chest number is required (e.g. G01, 201)'),
  member_ids: z.array(z.string()).min(1, 'Please select at least one team member'),
});

type IndividualFormData = z.infer<typeof individualSchema>;
type GroupFormData = z.infer<typeof groupSchema>;

export const RegistrationsAdminPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [individualModalOpen, setIndividualModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [stageSheetModalOpen, setStageSheetModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<CompetitionEvent | null>(null);

  // Deletion state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [regToDelete, setRegToDelete] = useState<Registration | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-registrations-dashboard', debouncedSearch, typeFilter, categoryFilter],
    queryFn: () =>
      registrationService.getRegistrationDashboard({
        search: debouncedSearch,
        type: typeFilter,
        categoryId: categoryFilter,
      }),
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['admin-active-churches'],
    queryFn: () => churchService.getAllActiveChurches(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['event-categories'],
    queryFn: () => eventService.getCategories(),
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['admin-all-events'],
    queryFn: async () => {
      const res = await eventService.getEvents({ pageSize: 100 });
      return res.events;
    },
  });

  // Query: Registrations for active selected event
  const {
    data: eventRegistrations = [],
    isLoading: isLoadingRoster,
  } = useQuery({
    queryKey: ['event-roster', activeEvent?.id],
    queryFn: () =>
      activeEvent ? registrationService.getEventRegistrations(activeEvent.id) : Promise.resolve([]),
    enabled: !!activeEvent,
  });

  // Forms
  const individualForm = useForm<IndividualFormData>({
    resolver: zodResolver(individualSchema),
  });

  const groupForm = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      member_ids: [],
    },
  });

  const watchedIndividualChurch = individualForm.watch('church_id');
  const watchedGroupChurch = groupForm.watch('church_id');
  const watchedGroupEventId = groupForm.watch('event_id');
  const watchedGroupMembers = groupForm.watch('member_ids') || [];

  // Query: Church participants for selected church in individual form
  const { data: churchParticipants = [] } = useQuery({
    queryKey: ['church-participants-individual', watchedIndividualChurch],
    queryFn: () =>
      watchedIndividualChurch
        ? registrationService.getChurchParticipants(watchedIndividualChurch)
        : Promise.resolve([]),
    enabled: !!watchedIndividualChurch,
  });

  // Query: Church participants for selected church in group form
  const { data: groupChurchParticipants = [] } = useQuery({
    queryKey: ['church-participants-group', watchedGroupChurch],
    queryFn: () =>
      watchedGroupChurch
        ? registrationService.getChurchParticipants(watchedGroupChurch)
        : Promise.resolve([]),
    enabled: !!watchedGroupChurch,
  });

  // Active group event metadata
  const selectedGroupEvent = allEvents.find((e) => String(e.id) === String(watchedGroupEventId));

  // Mutations
  const createIndividualMutation = useMutation({
    mutationFn: (data: IndividualFormData) =>
      registrationService.createIndividualRegistration({
        event_id: data.event_id,
        church_id: data.church_id,
        participant_id: data.participant_id,
        chest_number: data.chest_number,
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Contestant registered successfully for event!');
        queryClient.invalidateQueries({ queryKey: ['admin-registrations-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['event-roster'] });
        setIndividualModalOpen(false);
        individualForm.reset();
      } else {
        toast.error(res.error || 'Failed to register contestant');
      }
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: GroupFormData) =>
      registrationService.createGroupRegistration({
        event_id: data.event_id,
        church_id: data.church_id,
        group_name: data.group_name,
        chest_number: data.chest_number,
        member_ids: data.member_ids,
      }),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Team '${groupForm.getValues('group_name')}' registered successfully!`);
        queryClient.invalidateQueries({ queryKey: ['admin-registrations-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['event-roster'] });
        setGroupModalOpen(false);
        groupForm.reset();
      } else {
        toast.error(res.error || 'Failed to register team');
      }
    },
  });

  const deleteRegistrationMutation = useMutation({
    mutationFn: (id: string | number) => registrationService.deleteRegistration(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Registration entry removed successfully.');
        queryClient.invalidateQueries({ queryKey: ['admin-registrations-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['event-roster'] });
        setDeleteConfirmOpen(false);
        setRegToDelete(null);
      } else {
        toast.error(res.error || 'Failed to remove registration');
      }
    },
  });

  // Modal open helpers
  const openIndividualModal = (event?: CompetitionEvent) => {
    individualForm.reset({
      event_id: event ? String(event.id) : '',
      church_id: churches[0]?.id ? String(churches[0].id) : '',
      participant_id: '',
      chest_number: '',
    });
    setIndividualModalOpen(true);
  };

  const openGroupModal = (event?: CompetitionEvent) => {
    const groupEvents = allEvents.filter((e) => e.event_type === 'GROUP');
    const defaultEv = event || groupEvents[0];
    groupForm.reset({
      event_id: defaultEv ? String(defaultEv.id) : '',
      church_id: churches[0]?.id ? String(churches[0].id) : '',
      group_name: '',
      chest_number: 'G01',
      member_ids: [],
    });
    setGroupModalOpen(true);
  };

  const openRoster = (event: CompetitionEvent) => {
    setActiveEvent(event);
    setRosterModalOpen(true);
  };

  const openStageSheet = (event: CompetitionEvent) => {
    setActiveEvent(event);
    setStageSheetModalOpen(true);
  };

  // Group member toggle helper
  const toggleGroupMember = (pId: string) => {
    const current = groupForm.getValues('member_ids') || [];
    if (current.includes(pId)) {
      groupForm.setValue(
        'member_ids',
        current.filter((id) => id !== pId)
      );
    } else {
      groupForm.setValue('member_ids', [...current, pId]);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration Management & Rosters"
        subtitle="Manage contestant entries, church quotas, team member rosters, and official judges stage sheets"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => openIndividualModal()}
            className="gap-2 font-semibold text-xs sm:text-sm"
          >
            <UserPlus className="h-4 w-4 text-zim-primary" /> Register Solo
          </Button>
          <Button
            onClick={() => openGroupModal()}
            className="gap-2 font-bold text-xs sm:text-sm"
          >
            <Users className="h-4 w-4" /> Register Group Team
          </Button>
        </div>
      </PageHeader>

      {/* Stats and Filter Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full lg:w-72">
          <SearchInput
            placeholder="Search event code, Malayalam, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Solo Events Only</option>
              <option value="GROUP">Group Competitions Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Events Registration Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-slate-900 font-bold">
              Competition Enrollment Overview
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {dashboardData?.totalRegistrations ?? 0} Total Contestant & Team Entries Across All 34 Competitions
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Loading registration dashboard..." />
            </div>
          ) : !dashboardData || dashboardData.events.length === 0 ? (
            <EmptyState
              title="No Competitions Found"
              description="No competitions match your current search or filter query."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearch('');
                setTypeFilter('');
                setCategoryFilter('');
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead>Competition Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead className="text-center w-20">Type</TableHead>
                  <TableHead className="text-center w-36">Enrolled Entries</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardData.events.map((ev: RegistrationDashboardEvent) => (
                  <TableRow key={ev.code} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-mono font-black text-zim-primary tracking-wide">
                      {ev.code}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openRoster(ev)}
                        className="text-left font-bold text-slate-900 hover:text-zim-primary transition-colors block"
                      >
                        {ev.name_malayalam || ev.name}
                      </button>
                      <span className="text-xs text-slate-500 block">{ev.name}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {ev.category?.name || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-medium">
                      {ev.division?.name || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={ev.event_type === 'GROUP' ? 'secondary' : 'default'}
                        className="text-[10px] font-bold"
                      >
                        {ev.event_type === 'GROUP' ? 'Group' : 'Solo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {ev.registration_count > 0 ? (
                        <Badge variant="success" className="font-bold text-[11px] px-2.5 py-0.5">
                          {ev.registration_count} {ev.event_type === 'GROUP' ? 'Teams' : 'Contestants'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">0 Entries</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoster(ev)}
                          className="h-8 gap-1 text-xs text-slate-700"
                          title="View Event Roster"
                        >
                          <ListCheck className="h-3.5 w-3.5" /> Roster
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStageSheet(ev)}
                          className="h-8 gap-1 text-xs text-slate-700 hover:text-zim-primary"
                          title="Print Judges Stage Sheet"
                        >
                          <Printer className="h-3.5 w-3.5" /> Sheet
                        </Button>
                        {ev.event_type === 'INDIVIDUAL' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openIndividualModal(ev)}
                            className="h-8 w-8 text-zim-primary hover:bg-emerald-50"
                            title="Register Solo Contestant"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openGroupModal(ev)}
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                            title="Register Group Team"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Individual Registration Modal Dialog */}
      <Dialog open={individualModalOpen} onOpenChange={setIndividualModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-zim-primary" />
            Solo Contestant Registration
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Register an eligible participant for a solo competition. Verifies church affiliation and duplicate entry limits.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={individualForm.handleSubmit((data) => createIndividualMutation.mutate(data))}
          className="space-y-4 my-2"
        >
          <FormField
            label="Competition Event"
            required
            error={individualForm.formState.errors.event_id?.message}
          >
            <select
              {...individualForm.register('event_id')}
              className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
            >
              <option value="">Select Solo Event</option>
              {allEvents
                .filter((e) => e.event_type === 'INDIVIDUAL')
                .map((e) => (
                  <option key={e.code} value={e.id}>
                    {e.code} - {e.name_malayalam || e.name} ({e.name})
                  </option>
                ))}
            </select>
          </FormField>

          <FormField
            label="Representing Parish Church"
            required
            error={individualForm.formState.errors.church_id?.message}
          >
            <select
              {...individualForm.register('church_id')}
              className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
            >
              <option value="">Select Church</option>
              {churches.map((c) => (
                <option key={c.code} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Select Contestant"
            required
            helpText={
              watchedIndividualChurch
                ? `${churchParticipants.length} active participants available in this parish`
                : 'Select church first to load participants'
            }
            error={individualForm.formState.errors.participant_id?.message}
          >
            <select
              {...individualForm.register('participant_id')}
              className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
              disabled={!watchedIndividualChurch || churchParticipants.length === 0}
            >
              <option value="">
                {watchedIndividualChurch
                  ? churchParticipants.length > 0
                    ? 'Select Contestant'
                    : 'No participants registered in this parish'
                  : 'Select Parish First'}
              </option>
              {churchParticipants.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.chest_number} - {p.name} ({p.gender}, {p.age_category})
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Override Event Chest Number (Optional)"
            helpText="Defaults to contestant's registered chest number if blank"
          >
            <Input
              {...individualForm.register('chest_number')}
              placeholder="e.g. 001"
              className="font-mono font-bold"
            />
          </FormField>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIndividualModalOpen(false)}
              disabled={createIndividualMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={createIndividualMutation.isPending}
              className="font-bold"
            >
              {createIndividualMutation.isPending ? 'Registering...' : 'Register Contestant'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Group Team Registration Modal Dialog */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-zim-primary" />
            Group Team Registration
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Register a church team roster for group competitions (Group Song, Tableau, Skit, Quartet, Mime).
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={groupForm.handleSubmit((data) => createGroupMutation.mutate(data))}
          className="space-y-4 my-2"
        >
          <FormField
            label="Group Competition Event"
            required
            error={groupForm.formState.errors.event_id?.message}
          >
            <select
              {...groupForm.register('event_id')}
              className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
            >
              <option value="">Select Group Event</option>
              {allEvents
                .filter((e) => e.event_type === 'GROUP')
                .map((e) => (
                  <option key={e.code} value={e.id}>
                    {e.code} - {e.name_malayalam || e.name} ({e.min_participants}–{e.max_participants} members)
                  </option>
                ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Parish Church"
              required
              error={groupForm.formState.errors.church_id?.message}
            >
              <select
                {...groupForm.register('church_id')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
              >
                <option value="">Select Church</option>
                {churches.map((c) => (
                  <option key={c.code} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Team Chest Number"
              required
              error={groupForm.formState.errors.chest_number?.message}
            >
              <Input
                {...groupForm.register('chest_number')}
                placeholder="e.g. G01, 201"
                className="font-mono font-bold"
              />
            </FormField>
          </div>

          <FormField
            label="Team / Group Name"
            required
            error={groupForm.formState.errors.group_name?.message}
          >
            <Input
              {...groupForm.register('group_name')}
              placeholder="e.g. St. Mathias Youth Choir / Team A"
            />
          </FormField>

          {/* Member Roster Multi-Select */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Select Team Roster Members ({watchedGroupMembers.length} Selected)
              </span>
              {selectedGroupEvent && (
                <span className="text-[11px] font-semibold text-slate-500">
                  Required: {selectedGroupEvent.min_participants}–{selectedGroupEvent.max_participants} members
                </span>
              )}
            </div>

            {selectedGroupEvent && (
              watchedGroupMembers.length < selectedGroupEvent.min_participants ? (
                <p className="text-[11px] text-amber-700 font-medium">
                  ⚠️ Need at least {selectedGroupEvent.min_participants - watchedGroupMembers.length} more members.
                </p>
              ) : watchedGroupMembers.length > selectedGroupEvent.max_participants ? (
                <p className="text-[11px] text-red-600 font-bold">
                  ⚠️ Too many members! Max allowed: {selectedGroupEvent.max_participants}.
                </p>
              ) : (
                <p className="text-[11px] text-emerald-700 font-bold">
                  ✓ Valid team size ({watchedGroupMembers.length} members).
                </p>
              )
            )}

            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 bg-slate-50/50 space-y-1">
              {!watchedGroupChurch ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  Please select a parish church above to view eligible contestants.
                </p>
              ) : groupChurchParticipants.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No participants enrolled under this parish church.
                </p>
              ) : (
                groupChurchParticipants.map((p) => {
                  const isChecked = watchedGroupMembers.includes(String(p.id));
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-zim-primary/10 border border-zim-primary/30 font-semibold text-zim-primary'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleGroupMember(String(p.id))}
                          className="h-4 w-4 rounded border-slate-300 text-zim-primary focus:ring-zim-primary"
                        />
                        <span className="font-mono font-bold">#{p.chest_number}</span>
                        <span>{p.name}</span>
                        {p.name_malayalam && (
                          <span className="text-[11px] text-slate-400 font-malayalam">
                            ({p.name_malayalam})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {p.gender} • {p.age_category}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            {groupForm.formState.errors.member_ids && (
              <p className="text-xs text-red-600 font-medium">
                {groupForm.formState.errors.member_ids.message}
              </p>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGroupModalOpen(false)}
              disabled={createGroupMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={
                createGroupMutation.isPending ||
                (selectedGroupEvent
                  ? watchedGroupMembers.length < selectedGroupEvent.min_participants ||
                    watchedGroupMembers.length > selectedGroupEvent.max_participants
                  : watchedGroupMembers.length === 0)
              }
              className="font-bold"
            >
              {createGroupMutation.isPending ? 'Registering...' : 'Register Team'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Event Roster View Drawer / Modal */}
      {activeEvent && (
        <Dialog open={rosterModalOpen} onOpenChange={setRosterModalOpen}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm px-2 py-0.5 rounded bg-zim-primary text-white font-black">
                  {activeEvent.code}
                </span>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {activeEvent.name_malayalam || activeEvent.name}
                </DialogTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRosterModalOpen(false);
                  openStageSheet(activeEvent);
                }}
                className="gap-1.5 text-xs text-zim-primary font-semibold"
              >
                <Printer className="h-3.5 w-3.5" /> Printable Stage Sheet
              </Button>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {activeEvent.name} • {activeEvent.category?.name} • {eventRegistrations.length} Total Enrolled
            </DialogDescription>
          </DialogHeader>

          <div className="my-2 max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
            {isLoadingRoster ? (
              <div className="py-12">
                <LoadingSpinner size="md" text="Loading event entries..." />
              </div>
            ) : eventRegistrations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No contestants or teams registered yet for this competition.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-20 text-xs">Chest #</TableHead>
                    <TableHead className="text-xs">Contestant / Team</TableHead>
                    <TableHead className="text-xs">Church</TableHead>
                    <TableHead className="text-xs">Team Composition</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventRegistrations.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="font-mono font-bold text-zim-primary">
                        #{r.chest_number}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-slate-900 block">
                          {r.participant?.name || r.group_name}
                        </span>
                        {r.participant?.name_malayalam && (
                          <span className="text-[11px] text-slate-500 font-malayalam block">
                            {r.participant.name_malayalam}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        {r.church?.code} - {r.church?.name}
                      </TableCell>
                      <TableCell>
                        {r.members && r.members.length > 0 ? (
                          <div>
                            <Badge variant="secondary" className="font-bold text-[10px] mb-1">
                              {r.members.length} Members
                            </Badge>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              {r.members.map((m) => m.participant?.name).filter(Boolean).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Solo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRegToDelete(r);
                            setDeleteConfirmOpen(true);
                          }}
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Remove Registration"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="gap-2">
            {activeEvent.event_type === 'INDIVIDUAL' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRosterModalOpen(false);
                  openIndividualModal(activeEvent);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add Solo Entry
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRosterModalOpen(false);
                  openGroupModal(activeEvent);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <Users className="h-3.5 w-3.5" /> Add Team Entry
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => setRosterModalOpen(false)}>
              Close Roster
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Official Printable Judges Stage Sheet Modal */}
      {activeEvent && (
        <Dialog open={stageSheetModalOpen} onOpenChange={setStageSheetModalOpen}>
          <DialogHeader className="no-print">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-zim-primary" />
                Official Contestant Roster & Judges Stage Sheet
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStageSheetModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Printable Sheet Body */}
          <div className="my-2 p-6 bg-white border border-slate-200 rounded-xl max-h-[70vh] overflow-y-auto text-black font-serif print:p-0 print:border-none print:max-h-none">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3 mb-4">
              <div className="flex items-center justify-center gap-4 mb-2">
                <img
                  src="/logos/zimrah_logo.png"
                  alt="ZIMRAH"
                  className="h-12 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/zimrah_logo.png';
                  }}
                />
                <div>
                  <h4 className="font-bold text-sm tracking-wide uppercase">CSI MADHYA KERALA DIOCESE</h4>
                  <h5 className="font-bold text-xs uppercase text-slate-800">
                    ADOOR CLERGY DISTRICT YOUTH MOVEMENT
                  </h5>
                </div>
              </div>
              <h2 className="font-black text-lg tracking-tight">ZIMRAH 2026 – SONG OF PRAISE</h2>
              <h3 className="font-bold text-sm underline tracking-wide uppercase mt-1">
                OFFICIAL CONTESTANT ROSTER & JUDGES SCORE SHEET
              </h3>

              <div className="grid grid-cols-2 text-left text-xs font-sans mt-3 pt-2 border-t border-slate-300 gap-y-1">
                <div>
                  <strong>Competition:</strong> {activeEvent.code} – {activeEvent.name_malayalam} ({activeEvent.name})
                </div>
                <div>
                  <strong>Category:</strong> {activeEvent.category?.name || 'Festival Event'}
                </div>
                <div>
                  <strong>Venue:</strong> {activeEvent.category?.venue || 'Festival Auditorium'}
                </div>
                <div>
                  <strong>Duration:</strong> {activeEvent.duration_display || (activeEvent.duration_minutes ? `${activeEvent.duration_minutes} min` : 'Untimed')}
                </div>
              </div>
            </div>

            {/* Stage Sheet Table */}
            <table className="w-full border-collapse border border-black text-xs font-sans mb-8">
              <thead>
                <tr className="bg-slate-100 text-center font-bold">
                  <th className="border border-black p-2 w-12">Sl No.</th>
                  <th className="border border-black p-2 w-24">Chest No.</th>
                  <th className="border border-black p-2 text-left">Contestant / Church Team</th>
                  <th className="border border-black p-2 text-left w-48">Representing Church</th>
                  <th className="border border-black p-2 w-28">Marks / Grade</th>
                  <th className="border border-black p-2 w-20">Rank</th>
                </tr>
              </thead>
              <tbody>
                {eventRegistrations.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-black p-2 text-center font-mono font-bold text-sm">
                      #{r.chest_number}
                    </td>
                    <td className="border border-black p-2">
                      <strong className="block text-sm">
                        {r.participant?.name || r.group_name}
                      </strong>
                      {r.participant?.name_malayalam && (
                        <span className="text-xs font-malayalam block text-slate-600">
                          {r.participant.name_malayalam}
                        </span>
                      )}
                      {r.members && r.members.length > 0 && (
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          <strong>Members ({r.members.length}):</strong>{' '}
                          {r.members.map((m) => m.participant?.name).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="border border-black p-2 font-medium">
                      {r.church?.code} - {r.church?.name}
                    </td>
                    <td className="border border-black p-2 text-center"></td>
                    <td className="border border-black p-2 text-center"></td>
                  </tr>
                ))}
                {eventRegistrations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="border border-black p-6 text-center text-slate-400">
                      No contestants enrolled for this event.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 text-center text-xs pt-8 border-t border-slate-300">
              <div>
                <div className="border-t border-dotted border-black w-3/4 mx-auto pt-1 font-semibold">
                  Judge 1 Signature & Name
                </div>
              </div>
              <div>
                <div className="border-t border-dotted border-black w-3/4 mx-auto pt-1 font-semibold">
                  Judge 2 Signature & Name
                </div>
              </div>
              <div>
                <div className="border-t border-dotted border-black w-3/4 mx-auto pt-1 font-semibold">
                  Youth Movement Convener / Vicar
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Remove Registration Entry"
        description={
          <span>
            Are you sure you want to remove the registration for{' '}
            <strong className="text-slate-900">
              #{regToDelete?.chest_number} - {regToDelete?.participant?.name || regToDelete?.group_name}
            </strong>
            ? This will remove the contestant or team from this competition's roster.
          </span>
        }
        confirmLabel="Remove Registration"
        variant="danger"
        isLoading={deleteRegistrationMutation.isPending}
        onConfirm={() => {
          if (regToDelete) {
            deleteRegistrationMutation.mutate(regToDelete.id);
          }
        }}
      />
    </div>
  );
};
