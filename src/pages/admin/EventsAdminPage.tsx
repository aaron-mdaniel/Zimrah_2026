import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Power,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
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
import { Pagination } from '@/components/common/Pagination';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { eventService } from '@/services/eventService';
import { CompetitionEvent, EventType } from '@/types';

// Zod Schema for Event Form
const eventSchema = z.object({
  code: z
    .string()
    .min(2, 'Event code is required')
    .max(20, 'Event code cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Event code can only contain letters, numbers, and dashes'),
  name: z.string().min(2, 'English competition name is required'),
  name_malayalam: z.string().min(2, 'Malayalam competition name is required'),
  category_id: z.string().min(1, 'Please select a category'),
  division_id: z.string().optional().or(z.literal('')),
  section_id: z.string().optional().or(z.literal('')),
  event_type: z.enum(['INDIVIDUAL', 'GROUP']),
  duration_minutes: z.coerce.number().min(0).optional(),
  duration_display: z.string().optional().or(z.literal('')),
  min_participants: z.coerce.number().min(1, 'Minimum 1 participant required'),
  max_participants: z.coerce.number().min(1, 'Maximum 1 participant required'),
  max_entries_per_church: z.coerce.number().min(1).default(1),
  contributes_to_individual: z.boolean().default(true),
  contributes_to_church: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

type EventFormData = z.infer<typeof eventSchema>;

export const EventsAdminPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [divisionFilter, setDivisionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CompetitionEvent | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CompetitionEvent | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CompetitionEvent | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const {
    data: eventData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-events', debouncedSearch, divisionFilter, categoryFilter, typeFilter, currentPage, pageSize],
    queryFn: () =>
      eventService.getEvents({
        search: debouncedSearch,
        divisionId: divisionFilter,
        categoryId: categoryFilter,
        type: typeFilter,
        page: currentPage,
        pageSize,
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

  const { data: sections = [] } = useQuery({
    queryKey: ['event-sections'],
    queryFn: () => eventService.getSections(),
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_type: 'INDIVIDUAL',
      min_participants: 1,
      max_participants: 1,
      max_entries_per_church: 1,
      contributes_to_individual: true,
      contributes_to_church: true,
      is_active: true,
    },
  });

  const watchedEventType = watch('event_type');

  // Auto-adjust team sizes when event type toggles
  const handleEventTypeChange = (type: EventType) => {
    setValue('event_type', type);
    if (type === 'INDIVIDUAL') {
      setValue('min_participants', 1);
      setValue('max_participants', 1);
      setValue('contributes_to_individual', true);
    } else {
      setValue('min_participants', 4);
      setValue('max_participants', 12);
      setValue('contributes_to_individual', false);
    }
  };

  // Helper to invalidate both admin and public caches
  const invalidateEventQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    queryClient.invalidateQueries({ queryKey: ['public-events-catalog'] });
    queryClient.invalidateQueries({ queryKey: ['public-events-list'] });
    queryClient.invalidateQueries({ queryKey: ['search-events'] });
    queryClient.invalidateQueries({ queryKey: ['event-categories'] });
    queryClient.invalidateQueries({ queryKey: ['event-divisions'] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: EventFormData) => eventService.createEvent(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Competition '${res.event?.code} - ${res.event?.name}' created successfully!`);
        invalidateEventQueries();
        setFormModalOpen(false);
        reset();
      } else {
        toast.error(res.error || 'Failed to create event');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: EventFormData }) =>
      eventService.updateEvent(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Competition '${res.event?.code}' updated successfully!`);
        invalidateEventQueries();
        setFormModalOpen(false);
        setEditingEvent(null);
        reset();
      } else {
        toast.error(res.error || 'Failed to update event');
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string | number; currentStatus: boolean }) =>
      eventService.toggleEventActive(id, currentStatus),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Competition status updated.');
        invalidateEventQueries();
      } else {
        toast.error(res.error || 'Failed to update status');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => eventService.deleteEvent(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Competition deleted successfully.');
        invalidateEventQueries();
        setDeleteConfirmOpen(false);
        setEventToDelete(null);
      } else {
        toast.error(res.error || 'Failed to delete competition');
      }
    },
  });

  const openAddModal = () => {
    setEditingEvent(null);
    reset({
      code: '',
      name: '',
      name_malayalam: '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
      division_id: divisions[0]?.id ? String(divisions[0].id) : '',
      section_id: sections[0]?.id ? String(sections[0].id) : '',
      event_type: 'INDIVIDUAL',
      duration_minutes: undefined,
      duration_display: '',
      min_participants: 1,
      max_participants: 1,
      max_entries_per_church: 1,
      contributes_to_individual: true,
      contributes_to_church: true,
      is_active: true,
    });
    setFormModalOpen(true);
  };

  const openEditModal = (event: CompetitionEvent) => {
    setEditingEvent(event);
    reset({
      code: event.code,
      name: event.name,
      name_malayalam: event.name_malayalam || '',
      category_id: String(event.category_id),
      division_id: event.division_id ? String(event.division_id) : '',
      section_id: event.section_id ? String(event.section_id) : '',
      event_type: event.event_type,
      duration_minutes: event.duration_minutes,
      duration_display: event.duration_display || '',
      min_participants: event.min_participants,
      max_participants: event.max_participants,
      max_entries_per_church: event.max_entries_per_church,
      contributes_to_individual: event.contributes_to_individual,
      contributes_to_church: event.contributes_to_church,
      is_active: event.is_active ?? true,
    });
    setFormModalOpen(true);
  };

  const openDetailModal = (event: CompetitionEvent) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  const onFormSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competition Directory & Configuration"
        subtitle="34 Official Kalolsavam competitions across 4 divisions, individual and group rules, timings, and scoring attribution"
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
          <Button onClick={openAddModal} className="gap-2 font-bold">
            <Plus className="h-4 w-4" /> Add Competition
          </Button>
        </div>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full lg:w-72">
          <SearchInput
            placeholder="Search code (EV01), English or Malayalam title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Division:</span>
            <select
              value={divisionFilter}
              onChange={(e) => {
                setDivisionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Divisions</option>
              {divisions.map((d) => (
                <option key={d.division_number} value={d.id}>
                  Div {d.division_number}: {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GROUP">Group</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Events Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base text-slate-900 font-bold">
            Configured Competitions {eventData ? `(${eventData.total})` : ''}
          </CardTitle>
          {eventData && (
            <span className="text-xs font-medium text-slate-500">
              Page {eventData.page} of {eventData.totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Loading competition directory..." />
            </div>
          ) : !eventData || eventData.events.length === 0 ? (
            <EmptyState
              title="No Competitions Found"
              description="No competition events match your selected filters. Try clearing search or division filters."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearch('');
                setDivisionFilter('');
                setCategoryFilter('');
                setTypeFilter('');
              }}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Event Title</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center w-20">Type</TableHead>
                    <TableHead className="text-center w-24">Team Size</TableHead>
                    <TableHead className="text-center w-20">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventData.events.map((e) => (
                    <TableRow key={e.code} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono font-black text-zim-primary tracking-wide">
                        {e.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 leading-snug">{e.name}</div>
                        {e.name_malayalam && (
                          <div className="text-xs text-slate-500 font-malayalam mt-0.5">
                            {e.name_malayalam}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {e.division ? e.division.name : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {e.category ? e.category.name : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={e.event_type === 'GROUP' ? 'secondary' : 'default'}
                          className="text-[10px] font-bold"
                        >
                          {e.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-slate-600">
                        {e.min_participants === e.max_participants
                          ? e.min_participants
                          : `${e.min_participants}–${e.max_participants}`}
                      </TableCell>
                      <TableCell className="text-center">
                        {e.is_active !== false ? (
                          <Badge variant="success" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <XCircle className="h-3 w-3" /> Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-slate-900"
                            onClick={() => openDetailModal(e)}
                            title="View Rules & Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-zim-primary"
                            onClick={() => openEditModal(e)}
                            title="Edit Event"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              e.is_active !== false
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-emerald-600 hover:text-emerald-800'
                            }`}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: e.id,
                                currentStatus: e.is_active ?? true,
                              })
                            }
                            title={e.is_active !== false ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setEventToDelete(e);
                              setDeleteConfirmOpen(true);
                            }}
                            title="Delete Event"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={currentPage}
                totalPages={eventData.totalPages}
                totalItems={eventData.total}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Event Dialog */}
      <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {editingEvent ? `Edit Competition: ${editingEvent.code}` : 'Configure New Competition'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define festival competition parameters, taxonomy attribution, team bounds, and championship point eligibility.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 my-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Competition Code (e.g. EV01)" required error={errors.code?.message}>
              <Input
                {...register('code')}
                placeholder="EV35"
                className="font-mono uppercase font-bold"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Competition Type" required error={errors.event_type?.message}>
              <select
                value={watchedEventType}
                onChange={(e) => handleEventTypeChange(e.target.value as EventType)}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="INDIVIDUAL">Individual Event</option>
                <option value="GROUP">Group / Team Event</option>
              </select>
            </FormField>
          </div>

          <FormField label="Event Title (English)" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="e.g. Solo Eastern - Senior Boys"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="Malayalam Title (Script)"
            required
            helpText="Displayed on stage rosters, scoreboards, and certificates"
            error={errors.name_malayalam?.message}
          >
            <Input
              {...register('name_malayalam')}
              placeholder="സോളോ ഈസ്റ്റേൺ - സീനിയർ - ബോയ്സ്"
              className="font-malayalam"
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Category" required error={errors.category_id?.message}>
              <select
                {...register('category_id')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Division" error={errors.division_id?.message}>
              <select
                {...register('division_id')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="">None / Open</option>
                {divisions.map((d) => (
                  <option key={d.division_number} value={d.id}>
                    Div {d.division_number}: {d.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Age Section" error={errors.section_id?.message}>
              <select
                {...register('section_id')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="">None / Open</option>
                {sections.map((s) => (
                  <option key={s.code} value={s.id}>
                    {s.code} ({s.name})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Min Participants" required error={errors.min_participants?.message}>
              <Input
                type="number"
                {...register('min_participants')}
                min={1}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Max Participants" required error={errors.max_participants?.message}>
              <Input
                type="number"
                {...register('max_participants')}
                min={1}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Max Church Entries" required error={errors.max_entries_per_church?.message}>
              <Input
                type="number"
                {...register('max_entries_per_church')}
                min={1}
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Allocated Duration (Minutes)" error={errors.duration_minutes?.message}>
              <Input
                type="number"
                {...register('duration_minutes')}
                placeholder="5"
                min={0}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Duration Display String" helpText="e.g. '5 മിനിറ്റ്' or '3+5 മിനിറ്റ്സ്'">
              <Input
                {...register('duration_display')}
                placeholder="5 മിനിറ്റ്"
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 block">Championship Point Attribution</span>
            <div className="flex flex-wrap gap-6 text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('contributes_to_church')}
                  className="h-4 w-4 rounded border-slate-300 text-zim-primary focus:ring-zim-primary"
                />
                Contributes to Church Championship
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('contributes_to_individual')}
                  className="h-4 w-4 rounded border-slate-300 text-zim-primary focus:ring-zim-primary"
                />
                Contributes to Individual Kalaprathibha / Kalathilakam
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isSubmitting}
              className="font-bold"
            >
              {isSubmitting ? 'Saving...' : editingEvent ? 'Update Event' : 'Save Event'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Details Modal */}
      {selectedEvent && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base px-2.5 py-0.5 rounded bg-zim-primary text-white font-black">
                {selectedEvent.code}
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {selectedEvent.name}
              </DialogTitle>
            </div>
            {selectedEvent.name_malayalam && (
              <p className="text-sm text-slate-600 font-malayalam mt-1">
                {selectedEvent.name_malayalam}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Division</span>
                <span className="font-bold text-slate-800">
                  {selectedEvent.division?.name || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Category</span>
                <span className="font-bold text-slate-800">
                  {selectedEvent.category?.name || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Type</span>
                <Badge
                  variant={selectedEvent.event_type === 'GROUP' ? 'secondary' : 'default'}
                  className="font-bold text-[10px] mt-0.5"
                >
                  {selectedEvent.event_type}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Team Size</span>
                <span className="font-mono text-slate-800 flex items-center gap-1 mt-0.5">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {selectedEvent.min_participants === selectedEvent.max_participants
                    ? selectedEvent.min_participants
                    : `${selectedEvent.min_participants}–${selectedEvent.max_participants}`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Duration</span>
                <span className="text-slate-800 flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {selectedEvent.duration_display ||
                    (selectedEvent.duration_minutes ? `${selectedEvent.duration_minutes} min` : 'Untimed')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Status</span>
                <span className="font-bold text-slate-800">
                  {selectedEvent.is_active !== false ? (
                    <span className="text-emerald-700">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-[11px]">Championship Rules:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                <li>
                  Church Championship:{' '}
                  {selectedEvent.contributes_to_church ? (
                    <span className="text-emerald-700 font-bold">Points Count (1st=5, 2nd=3, 3rd=1)</span>
                  ) : (
                    <span className="text-slate-400 font-bold">Non-scoring exhibition</span>
                  )}
                </li>
                <li>
                  Individual Championship:{' '}
                  {selectedEvent.contributes_to_individual ? (
                    <span className="text-emerald-700 font-bold">Eligible for Kalaprathibha/Kalathilakam</span>
                  ) : (
                    <span className="text-slate-400 font-bold">Excluded (Group or Special)</span>
                  )}
                </li>
                <li>
                  Parish Limit: Max {selectedEvent.max_entries_per_church} entry per church.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setDetailModalOpen(false);
                openEditModal(selectedEvent);
              }}
            >
              Edit Competition
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Competition Event"
        description={
          <span>
            Are you sure you want to permanently delete event{' '}
            <strong className="text-slate-900">
              {eventToDelete?.code} - {eventToDelete?.name}
            </strong>
            ? This operation will remove the event configuration. If any registrations, score sheets, or point ledger entries exist, the database will block deletion.
          </span>
        }
        confirmLabel="Delete Event"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (eventToDelete) {
            deleteMutation.mutate(eventToDelete.id);
          }
        }}
      />
    </div>
  );
};
