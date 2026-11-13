import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Eye,
  Power,
  RefreshCw,
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
import { churchService } from '@/services/churchService';
import { Church } from '@/types';

// Zod Schema for Church Validation
const churchSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, and dashes'),
  name: z.string().min(3, 'Parish name must be at least 3 characters'),
  name_malayalam: z.string().optional().or(z.literal('')),
  district: z.string().min(2, 'District is required'),
  vicar_name: z.string().optional().or(z.literal('')),
  youth_leader_name: z.string().optional().or(z.literal('')),
  contact_phone: z.string().optional().or(z.literal('')),
  contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  is_active: z.boolean().default(true),
});

type ChurchFormData = z.infer<typeof churchSchema>;

export const ChurchesAdminPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingChurch, setEditingChurch] = useState<Church | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState<Church | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [churchToDelete, setChurchToDelete] = useState<Church | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query: Churches
  const {
    data: churchData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-churches', debouncedSearch, statusFilter, currentPage, pageSize],
    queryFn: () =>
      churchService.getChurches({
        search: debouncedSearch,
        status: statusFilter,
        page: currentPage,
        pageSize,
      }),
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChurchFormData>({
    resolver: zodResolver(churchSchema),
    defaultValues: {
      district: 'Adoor Clergy District',
      is_active: true,
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ChurchFormData) => churchService.createChurch(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Parish church '${res.church?.code} - ${res.church?.name}' registered successfully!`);
        queryClient.invalidateQueries({ queryKey: ['admin-churches'] });
        setFormModalOpen(false);
        reset();
      } else {
        toast.error(res.error || 'Failed to create church');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error creating church';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: ChurchFormData }) =>
      churchService.updateChurch(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Parish church '${res.church?.code}' updated successfully!`);
        queryClient.invalidateQueries({ queryKey: ['admin-churches'] });
        setFormModalOpen(false);
        setEditingChurch(null);
        reset();
      } else {
        toast.error(res.error || 'Failed to update church');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error updating church';
      toast.error(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string | number; currentStatus: boolean }) =>
      churchService.toggleChurchStatus(id, currentStatus),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Church active status updated.');
        queryClient.invalidateQueries({ queryKey: ['admin-churches'] });
      } else {
        toast.error(res.error || 'Failed to toggle status');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => churchService.deleteChurch(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Church deleted successfully.');
        queryClient.invalidateQueries({ queryKey: ['admin-churches'] });
        setDeleteConfirmOpen(false);
        setChurchToDelete(null);
      } else {
        toast.error(res.error || 'Cannot delete church');
      }
    },
  });

  const openAddModal = () => {
    setEditingChurch(null);
    reset({
      code: '',
      name: '',
      name_malayalam: '',
      district: 'Adoor Clergy District',
      vicar_name: '',
      youth_leader_name: '',
      contact_phone: '',
      contact_email: '',
      is_active: true,
    });
    setFormModalOpen(true);
  };

  const openEditModal = (church: Church) => {
    setEditingChurch(church);
    reset({
      code: church.code,
      name: church.name,
      name_malayalam: church.name_malayalam || '',
      district: church.district || 'Adoor Clergy District',
      vicar_name: church.vicar_name || '',
      youth_leader_name: church.youth_leader_name || '',
      contact_phone: church.contact_phone || '',
      contact_email: church.contact_email || '',
      is_active: church.is_active,
    });
    setFormModalOpen(true);
  };

  const openDetailModal = (church: Church) => {
    setSelectedChurch(church);
    setDetailModalOpen(true);
  };

  const onFormSubmit = (data: ChurchFormData) => {
    if (editingChurch) {
      updateMutation.mutate({ id: editingChurch.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parish Church Directory"
        subtitle="Manage participating churches, official codes, clergy records, and competition eligibility"
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
            <Plus className="h-4 w-4" /> Add Parish Church
          </Button>
        </div>
      </PageHeader>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full sm:w-80">
          <SearchInput
            placeholder="Search code, parish, Malayalam name, or vicar..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
          {(['all', 'active', 'inactive'] as const).map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className="capitalize text-xs h-8"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base text-slate-900 font-bold">
            Registered Parishes {churchData ? `(${churchData.total})` : ''}
          </CardTitle>
          {churchData && (
            <span className="text-xs font-medium text-slate-500">
              Page {churchData.page} of {churchData.totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Loading parish directory..." />
            </div>
          ) : !churchData || churchData.churches.length === 0 ? (
            <EmptyState
              title="No Churches Found"
              description={
                search || statusFilter !== 'all'
                  ? 'No parish churches matched your current search criteria. Try resetting filters.'
                  : 'No parish churches have been registered yet.'
              }
              actionLabel={search || statusFilter !== 'all' ? 'Reset Filters' : 'Add First Church'}
              onAction={() => {
                if (search || statusFilter !== 'all') {
                  setSearch('');
                  setStatusFilter('all');
                } else {
                  openAddModal();
                }
              }}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Parish Church</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Vicar</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churchData.churches.map((c) => (
                    <TableRow key={c.code} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono font-black text-zim-primary tracking-wide">
                        {c.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 leading-snug">{c.name}</div>
                        {c.name_malayalam && (
                          <div className="text-xs text-slate-500 font-malayalam mt-0.5">
                            {c.name_malayalam}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">{c.district}</TableCell>
                      <TableCell className="text-sm text-slate-800">
                        {c.vicar_name || <span className="text-slate-400 italic">Not set</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {c.contact_phone || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.is_active ? (
                          <Badge variant="success" className="gap-1 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-[11px] font-semibold">
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
                            onClick={() => openDetailModal(c)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-zim-primary"
                            onClick={() => openEditModal(c)}
                            title="Edit Parish"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${
                              c.is_active
                                ? 'text-amber-600 hover:text-amber-800'
                                : 'text-emerald-600 hover:text-emerald-800'
                            }`}
                            onClick={() =>
                              toggleStatusMutation.mutate({ id: c.id, currentStatus: c.is_active })
                            }
                            title={c.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setChurchToDelete(c);
                              setDeleteConfirmOpen(true);
                            }}
                            title="Delete Church"
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
                totalPages={churchData.totalPages}
                totalItems={churchData.total}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Church Modal */}
      <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {editingChurch ? `Edit Parish: ${editingChurch.code}` : 'Register New Parish Church'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editingChurch
              ? 'Update official details and contact information for this parish.'
              : 'Add a participating church under the Adoor Clergy District for ZIMRAH 2026.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 my-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Church Code (e.g. CH09)" required error={errors.code?.message}>
              <Input
                {...register('code')}
                placeholder="CH09"
                className="font-mono uppercase font-bold"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Administrative District" required error={errors.district?.message}>
              <Input
                {...register('district')}
                placeholder="Adoor Clergy District"
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <FormField label="Official Parish Name (English)" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="e.g. St. Thomas CSI Church, Kannamkode"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="Malayalam Name (Script)"
            helpText="Displayed in public scorecards and certificates"
            error={errors.name_malayalam?.message}
          >
            <Input
              {...register('name_malayalam')}
              placeholder="സെന്റ് തോമസ് സി.എസ്.ഐ ചർച്ച്, കണ്ണങ്കോട്"
              className="font-malayalam"
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Parish Priest / Vicar Name" error={errors.vicar_name?.message}>
              <Input
                {...register('vicar_name')}
                placeholder="Rev. ..."
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Youth Movement Secretary / Leader" error={errors.youth_leader_name?.message}>
              <Input
                {...register('youth_leader_name')}
                placeholder="Secretary Name"
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Primary Contact Phone" error={errors.contact_phone?.message}>
              <Input
                {...register('contact_phone')}
                placeholder="9447100000"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Contact Email" error={errors.contact_email?.message}>
              <Input
                {...register('contact_email')}
                type="email"
                placeholder="parish@example.com"
                disabled={isSubmitting}
              />
            </FormField>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              {...register('is_active')}
              className="h-4 w-4 rounded border-slate-300 text-zim-primary focus:ring-zim-primary"
            />
            <label htmlFor="is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active for competition participation and scoring
            </label>
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
              {isSubmitting ? 'Saving...' : editingChurch ? 'Update Parish' : 'Save Parish'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Church Details Modal */}
      {selectedChurch && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zim-primary/10 text-zim-primary font-black">
                {selectedChurch.code}
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {selectedChurch.name}
              </DialogTitle>
            </div>
            {selectedChurch.name_malayalam && (
              <p className="text-sm text-slate-500 font-malayalam mt-1">
                {selectedChurch.name_malayalam}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">District</span>
                <span className="font-bold text-slate-800">{selectedChurch.district}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Status</span>
                <span className="font-bold">
                  {selectedChurch.is_active ? (
                    <span className="text-emerald-700 font-bold">Active Contestant</span>
                  ) : (
                    <span className="text-red-600 font-bold">Inactive</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Vicar</span>
                <span className="font-medium text-slate-800">
                  {selectedChurch.vicar_name || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Youth Leader</span>
                <span className="font-medium text-slate-800">
                  {selectedChurch.youth_leader_name || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Phone</span>
                <span className="font-mono text-slate-800">
                  {selectedChurch.contact_phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Email</span>
                <span className="text-slate-800">{selectedChurch.contact_email || '—'}</span>
              </div>
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
                openEditModal(selectedChurch);
              }}
            >
              Edit Parish
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Parish Church"
        description={
          <span>
            Are you sure you want to permanently delete parish{' '}
            <strong className="text-slate-900">{churchToDelete?.code} - {churchToDelete?.name}</strong>?
            This operation cannot be undone. If any contestants or registrations are associated with this church,
            the database will reject the deletion to protect tournament data integrity.
          </span>
        }
        confirmLabel="Delete Church"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (churchToDelete) {
            deleteMutation.mutate(churchToDelete.id);
          }
        }}
      />
    </div>
  );
};
