import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Upload,
  Plus,
  FileSpreadsheet,
  Edit,
  Trash2,
  Eye,
  Download,
  AlertTriangle,
  CheckCircle2,
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
import { participantService, CSVImportPreviewResult, CSVImportExecutionResult } from '@/services/participantService';
import { churchService } from '@/services/churchService';
import { Participant } from '@/types';

// Zod Schema for Participant: chest_number MUST be string preserving leading zeros
const participantSchema = z.object({
  chest_number: z
    .string()
    .min(1, 'Chest number is required')
    .max(20, 'Chest number cannot exceed 20 characters')
    .regex(/^[0-9A-Za-z_-]+$/, 'Chest number contains invalid characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  name_malayalam: z.string().optional().or(z.literal('')),
  gender: z.enum(['M', 'F']),
  church_id: z.string().min(1, 'Please select a church / parish'),
  age_category: z.enum(['JUNIOR', 'SENIOR', 'OPEN']),
  phone: z.string().optional().or(z.literal('')),
});

type ParticipantFormData = z.infer<typeof participantSchema>;

export const ParticipantsAdminPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [churchFilter, setChurchFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<Participant | null>(null);

  // CSV Import State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<CSVImportPreviewResult | null>(null);
  const [importSummary, setImportSummary] = useState<CSVImportExecutionResult | null>(null);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const {
    data: participantData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-participants', debouncedSearch, churchFilter, ageFilter, currentPage, pageSize],
    queryFn: () =>
      participantService.getParticipants({
        search: debouncedSearch,
        churchId: churchFilter,
        ageCategory: ageFilter,
        page: currentPage,
        pageSize,
      }),
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['admin-active-churches'],
    queryFn: () => churchService.getAllActiveChurches(),
  });

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormData>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      gender: 'M',
      age_category: 'OPEN',
    },
  });

  // Helper to invalidate both admin and public caches
  const invalidateParticipantQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-participants'] });
    queryClient.invalidateQueries({ queryKey: ['individual-standings'] });
    queryClient.invalidateQueries({ queryKey: ['live-summary'] });
    queryClient.invalidateQueries({ queryKey: ['search-participants'] });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ParticipantFormData) => participantService.createParticipant(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Participant #${res.participant?.chest_number} (${res.participant?.name}) registered!`);
        invalidateParticipantQueries();
        setFormModalOpen(false);
        reset();
      } else {
        toast.error(res.error || 'Failed to create participant');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: ParticipantFormData }) =>
      participantService.updateParticipant(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Participant #${res.participant?.chest_number} updated!`);
        invalidateParticipantQueries();
        setFormModalOpen(false);
        setEditingParticipant(null);
        reset();
      } else {
        toast.error(res.error || 'Failed to update participant');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => participantService.deleteParticipant(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Participant deleted successfully.');
        invalidateParticipantQueries();
        setDeleteConfirmOpen(false);
        setParticipantToDelete(null);
      } else {
        toast.error(res.error || 'Failed to delete participant');
      }
    },
  });

  const importCommitMutation = useMutation({
    mutationFn: ({ preview }: { preview: CSVImportPreviewResult }) =>
      participantService.commitBulkParticipants(preview.validRows, preview.editionId),
    onSuccess: (summary) => {
      setImportSummary(summary);
      invalidateParticipantQueries();
      if (summary.importedCount > 0) {
        toast.success(`Successfully imported ${summary.importedCount} participants!`);
      }
      if (summary.skippedCount > 0) {
        toast.warning(`${summary.skippedCount} rows skipped due to errors.`);
      }
    },
  });

  const openAddModal = () => {
    setEditingParticipant(null);
    reset({
      chest_number: '',
      name: '',
      name_malayalam: '',
      gender: 'M',
      church_id: churches[0]?.id ? String(churches[0].id) : '',
      age_category: 'OPEN',
      phone: '',
    });
    setFormModalOpen(true);
  };

  const openEditModal = (p: Participant) => {
    setEditingParticipant(p);
    reset({
      chest_number: p.chest_number, // Preserves string leading zero
      name: p.name,
      name_malayalam: p.name_malayalam || '',
      gender: p.gender,
      church_id: String(p.church_id),
      age_category: p.age_category,
      phone: p.phone || '',
    });
    setFormModalOpen(true);
  };

  const openDetailModal = (p: Participant) => {
    setSelectedParticipant(p);
    setDetailModalOpen(true);
  };

  const onFormSubmit = (data: ParticipantFormData) => {
    if (editingParticipant) {
      updateMutation.mutate({ id: editingParticipant.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // CSV File Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setIsParsingCsv(true);
    setImportSummary(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const preview = await participantService.previewParticipantCsv(text, 'e2026');
        setPreviewResult(preview);
        setIsParsingCsv(false);
      };
      reader.readAsText(file);
    } catch {
      toast.error('Failed to parse CSV file.');
      setIsParsingCsv(false);
    }
  };

  const downloadSampleTemplate = () => {
    const blob = participantService.generateSampleCsvBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zimrah_participants_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contestant Registry"
        subtitle="Participant enrollment, string chest numbers with leading zeros, church attribution, and bulk CSV ingestion"
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
            onClick={() => {
              setCsvFile(null);
              setPreviewResult(null);
              setImportSummary(null);
              setImportModalOpen(true);
            }}
            className="gap-2 font-semibold"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={openAddModal} className="gap-2 font-bold">
            <Plus className="h-4 w-4" /> Add Contestant
          </Button>
        </div>
      </PageHeader>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full lg:w-80">
          <SearchInput
            placeholder="Search chest # (e.g. 001), name, or phone..."
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
            <span className="text-xs font-semibold text-slate-500">Parish:</span>
            <select
              value={churchFilter}
              onChange={(e) => {
                setChurchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Churches</option>
              {churches.map((c) => (
                <option key={c.code} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Division:</span>
            <select
              value={ageFilter}
              onChange={(e) => {
                setAgeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zim-primary font-medium"
            >
              <option value="">All Ages</option>
              <option value="JUNIOR">Junior</option>
              <option value="SENIOR">Senior</option>
              <option value="OPEN">Open</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Participants Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base text-slate-900 font-bold">
            Enrolled Contestants {participantData ? `(${participantData.total})` : ''}
          </CardTitle>
          {participantData && (
            <span className="text-xs font-medium text-slate-500">
              Page {participantData.page} of {participantData.totalPages}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16">
              <LoadingSpinner size="lg" text="Loading contestant registry..." />
            </div>
          ) : !participantData || participantData.participants.length === 0 ? (
            <EmptyState
              title="No Contestants Found"
              description={
                search || churchFilter || ageFilter
                  ? 'No participants match your active search filters. Try clearing filters.'
                  : 'No contestants have been registered yet. Add single participants or upload a CSV.'
              }
              actionLabel={
                search || churchFilter || ageFilter ? 'Clear Filters' : 'Add First Contestant'
              }
              onAction={() => {
                if (search || churchFilter || ageFilter) {
                  setSearch('');
                  setChurchFilter('');
                  setAgeFilter('');
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
                    <TableHead className="w-24">Chest #</TableHead>
                    <TableHead>Contestant Name</TableHead>
                    <TableHead>Parish Church</TableHead>
                    <TableHead className="text-center w-16">Gender</TableHead>
                    <TableHead className="text-center w-28">Division</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantData.participants.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-mono font-black text-zim-primary tracking-wider text-sm">
                        #{p.chest_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                        {p.name_malayalam && (
                          <div className="text-xs text-slate-500 font-malayalam mt-0.5">
                            {p.name_malayalam}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {p.church ? `${p.church.code} - ${p.church.name}` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {p.gender}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            p.age_category === 'JUNIOR'
                              ? 'secondary'
                              : p.age_category === 'SENIOR'
                              ? 'default'
                              : 'outline'
                          }
                          className="text-[10px] font-bold"
                        >
                          {p.age_category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {p.phone || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-slate-900"
                            onClick={() => openDetailModal(p)}
                            title="View Contestant"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-zim-primary"
                            onClick={() => openEditModal(p)}
                            title="Edit Contestant"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setParticipantToDelete(p);
                              setDeleteConfirmOpen(true);
                            }}
                            title="Delete Contestant"
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
                totalPages={participantData.totalPages}
                totalItems={participantData.total}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Contestant Modal Dialog */}
      <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {editingParticipant
              ? `Edit Contestant #${editingParticipant.chest_number}`
              : 'Register New Contestant'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Participant chest numbers are strictly preserved strings with leading zeros (e.g. 001, 042).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 my-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Chest Number"
              required
              helpText="Preserves leading zeros (e.g. 001)"
              error={errors.chest_number?.message}
            >
              <Input
                {...register('chest_number')}
                placeholder="001"
                className="font-mono font-bold"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Representing Parish / Church" required error={errors.church_id?.message}>
              <select
                {...register('church_id')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="">Select Church</option>
                {churches.map((c) => (
                  <option key={c.code} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Full Name (English)" required error={errors.name?.message}>
            <Input
              {...register('name')}
              placeholder="e.g. Aaron Samuel"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            label="Name in Malayalam"
            helpText="Displayed on score sheets and award certificates"
            error={errors.name_malayalam?.message}
          >
            <Input
              {...register('name_malayalam')}
              placeholder="ആരോൺ സാമുവൽ"
              className="font-malayalam"
              disabled={isSubmitting}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Gender" required error={errors.gender?.message}>
              <select
                {...register('gender')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
              </select>
            </FormField>

            <FormField label="Age Category" required error={errors.age_category?.message}>
              <select
                {...register('age_category')}
                className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zim-primary font-medium"
                disabled={isSubmitting}
              >
                <option value="JUNIOR">Junior</option>
                <option value="SENIOR">Senior</option>
                <option value="OPEN">Open</option>
              </select>
            </FormField>

            <FormField label="Phone" error={errors.phone?.message}>
              <Input
                {...register('phone')}
                placeholder="9988776655"
                disabled={isSubmitting}
              />
            </FormField>
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
              {isSubmitting
                ? 'Saving...'
                : editingParticipant
                ? 'Update Contestant'
                : 'Save Contestant'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Detail Modal */}
      {selectedParticipant && (
        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base px-2.5 py-0.5 rounded bg-zim-primary text-white font-black">
                #{selectedParticipant.chest_number}
              </span>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {selectedParticipant.name}
              </DialogTitle>
            </div>
            {selectedParticipant.name_malayalam && (
              <p className="text-sm text-slate-600 font-malayalam mt-1">
                {selectedParticipant.name_malayalam}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Parish</span>
                <span className="font-bold text-slate-800">
                  {selectedParticipant.church
                    ? `${selectedParticipant.church.code} - ${selectedParticipant.church.name}`
                    : 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Gender</span>
                <span className="font-bold text-slate-800">
                  {selectedParticipant.gender === 'M' ? 'Male' : 'Female'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Division</span>
                <Badge variant="outline" className="font-bold text-[10px] mt-0.5">
                  {selectedParticipant.age_category}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px]">Phone</span>
                <span className="font-mono text-slate-800">{selectedParticipant.phone || '—'}</span>
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
                openEditModal(selectedParticipant);
              }}
            >
              Edit Details
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* CSV Bulk Import Modal Dialog */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-zim-primary" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                Bulk CSV Participant Import
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadSampleTemplate}
              className="text-xs text-zim-primary gap-1"
            >
              <Download className="h-3.5 w-3.5" /> Sample CSV
            </Button>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Upload participant rosters in CSV format. UTF-8 and Excel BOM supported. Leading zeros are safely preserved.
          </DialogDescription>
        </DialogHeader>

        {importSummary ? (
          /* Post-Import Execution Summary */
          <div className="space-y-4 my-2">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-slate-900 text-sm">Bulk Import Processed</h4>
              <p className="text-xs text-slate-600">
                Successfully enrolled <span className="font-bold text-emerald-700">{importSummary.importedCount}</span> participants.
                {importSummary.skippedCount > 0 && (
                  <span className="block text-amber-700 mt-1">
                    {importSummary.skippedCount} rows were skipped due to errors.
                  </span>
                )}
              </p>
            </div>

            {importSummary.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-red-200 rounded-lg p-3 bg-red-50/50 text-xs">
                <span className="font-bold text-red-900 block mb-1">Encountered Issues:</span>
                <ul className="list-disc pl-4 space-y-1 text-red-700">
                  {importSummary.errors.map((e, idx) => (
                    <li key={idx}>
                      {e.row ? `Row ${e.row}: ` : ''}
                      {e.chest_number ? `[Chest #${e.chest_number}] ` : ''}
                      {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="default"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportSummary(null);
                  setPreviewResult(null);
                  setCsvFile(null);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : previewResult ? (
          /* Pre-Import Validation & Preview Screen */
          <div className="space-y-4 my-2">
            <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">File: </span>
                <span className="font-bold text-slate-800">{csvFile?.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 font-bold">
                  ✓ {previewResult.validRows.length} Valid
                </span>
                {previewResult.invalidRows.length > 0 && (
                  <span className="text-red-600 font-bold">
                    ✗ {previewResult.invalidRows.length} Invalid
                  </span>
                )}
              </div>
            </div>

            {/* Invalid Records Alert */}
            {previewResult.invalidRows.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Validation Warnings ({previewResult.invalidRows.length} rows will be skipped):</span>
                </div>
                <div className="max-h-24 overflow-y-auto pl-5 space-y-0.5 text-amber-900 list-disc">
                  {previewResult.invalidRows.slice(0, 10).map((r) => (
                    <div key={r.rowNumber}>
                      Row {r.rowNumber} (#{r.chest_number || 'N/A'}): {r.errors.join('; ')}
                    </div>
                  ))}
                  {previewResult.invalidRows.length > 10 && (
                    <div className="italic text-[11px] text-amber-700">
                      ...and {previewResult.invalidRows.length - 10} more rows with errors.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview of Valid Rows */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-20 text-xs">Chest #</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Parish Code</TableHead>
                    <TableHead className="text-xs text-center">Gender</TableHead>
                    <TableHead className="text-xs text-center">Category</TableHead>
                    <TableHead className="text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.validRows.slice(0, 20).map((r) => (
                    <TableRow key={r.rowNumber} className="text-xs">
                      <TableCell className="font-mono font-bold text-zim-primary">
                        #{r.chest_number}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{r.name}</TableCell>
                      <TableCell className="font-mono text-slate-600">{r.church_code}</TableCell>
                      <TableCell className="text-center">{r.gender}</TableCell>
                      <TableCell className="text-center">{r.age_category}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-bold">
                        Ready
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewResult(null);
                  setCsvFile(null);
                }}
              >
                Choose Different File
              </Button>
              <Button
                variant="default"
                disabled={previewResult.validRows.length === 0 || importCommitMutation.isPending}
                onClick={() => importCommitMutation.mutate({ preview: previewResult })}
                className="font-bold"
              >
                {importCommitMutation.isPending
                  ? 'Importing...'
                  : `Confirm Import (${previewResult.validRows.length} Records)`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* File Upload Dropzone */
          <div className="space-y-4 my-2">
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 hover:border-zim-primary transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">
                {isParsingCsv ? 'Analyzing CSV contents...' : 'Click or drag CSV file to upload'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Standard UTF-8 with BOM supported (Max 5MB)
              </p>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={isParsingCsv}
              >
                Select File
              </Button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
              <p className="font-bold text-slate-800">Required CSV Columns:</p>
              <p className="font-mono text-[11px] text-zim-primary font-semibold">
                chest_number, name, name_malayalam, gender, church_code, age_category, phone
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Example: <span className="font-mono">001, Aaron Samuel, ആരോൺ സാമുവൽ, M, CH01, JUNIOR, 9876543210</span>
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Contestant"
        description={
          <span>
            Are you sure you want to permanently delete contestant{' '}
            <strong className="text-slate-900">
              #{participantToDelete?.chest_number} - {participantToDelete?.name}
            </strong>
            ? This will remove the participant from the tournament registry. Active event registrations or score entries will prevent deletion.
          </span>
        }
        confirmLabel="Delete Contestant"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (participantToDelete) {
            deleteMutation.mutate(participantToDelete.id);
          }
        }}
      />
    </div>
  );
};
