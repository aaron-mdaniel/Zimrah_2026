import { supabase } from '@/lib/supabase';
import { Participant, Church, Gender, AgeCategory } from '@/types';
import { churchService } from './churchService';

export interface ParticipantQueryParams {
  search?: string;
  churchId?: string | number;
  ageCategory?: string;
  editionId?: string | number;
  page?: number;
  pageSize?: number;
}

export interface ParticipantListResponse {
  participants: Participant[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CSVParticipantRow {
  rowNumber: number;
  chest_number: string;
  name: string;
  name_malayalam?: string;
  gender: Gender;
  church_code: string;
  age_category: AgeCategory;
  phone?: string;
  isValid: boolean;
  errors: string[];
}

export interface CSVImportPreviewResult {
  totalRows: number;
  validRows: CSVParticipantRow[];
  invalidRows: CSVParticipantRow[];
  duplicatesInBatch: string[];
  editionId: string | number;
}

export interface CSVImportExecutionResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: Array<{ row?: number; chest_number?: string; error: string }>;
}

const SEED_PARTICIPANTS: Participant[] = [
  { id: 'p1', edition_id: 'e2026', chest_number: '001', name: 'Aaron Samuel', name_malayalam: 'ആരോൺ സാമുവൽ', gender: 'M', church_id: 'c1', age_category: 'JUNIOR', phone: '9988776601', church: { id: 'c1', code: 'CH01', name: 'St. Mathias CSI Church, Munroethuruth', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p2', edition_id: 'e2026', chest_number: '002', name: 'Joel Mathew', name_malayalam: 'ജോയൽ മാത്യു', gender: 'M', church_id: 'c1', age_category: 'JUNIOR', phone: '9988776602', church: { id: 'c1', code: 'CH01', name: 'St. Mathias CSI Church, Munroethuruth', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p3', edition_id: 'e2026', chest_number: '003', name: 'Titus George', name_malayalam: 'ടൈറ്റസ് ജോർജ്', gender: 'M', church_id: 'c1', age_category: 'JUNIOR', phone: '9988776603', church: { id: 'c1', code: 'CH01', name: 'St. Mathias CSI Church, Munroethuruth', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p4', edition_id: 'e2026', chest_number: '004', name: 'Kiran Varghese', name_malayalam: 'കിരൺ വർഗ്ഗീസ്', gender: 'M', church_id: 'c1', age_category: 'JUNIOR', phone: '9988776604', church: { id: 'c1', code: 'CH01', name: 'St. Mathias CSI Church, Munroethuruth', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p5', edition_id: 'e2026', chest_number: '010', name: 'Mathew Thomas', name_malayalam: 'മാത്യു തോമസ്', gender: 'M', church_id: 'c2', age_category: 'SENIOR', phone: '9988776605', church: { id: 'c2', code: 'CH02', name: 'Holy Trinity CSI Church, Adoor', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p6', edition_id: 'e2026', chest_number: '042', name: 'Rohan George', name_malayalam: 'രോഹൻ ജോർജ്', gender: 'M', church_id: 'c2', age_category: 'SENIOR', phone: '9988776606', church: { id: 'c2', code: 'CH02', name: 'Holy Trinity CSI Church, Adoor', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p7', edition_id: 'e2026', chest_number: '088', name: 'Sherin Mathew', name_malayalam: 'ഷെറിൻ മാത്യു', gender: 'F', church_id: 'c3', age_category: 'SENIOR', phone: '9988776607', church: { id: 'c3', code: 'CH03', name: 'St. Thomas CSI Church, Kannamkode', district: 'Adoor Clergy District', is_active: true } },
  { id: 'p8', edition_id: 'e2026', chest_number: '105', name: 'Hannah Philip', name_malayalam: 'ഹന്നാ ഫിലിപ്പ്', gender: 'F', church_id: 'c4', age_category: 'JUNIOR', phone: '9988776608', church: { id: 'c4', code: 'CH04', name: 'All Saints CSI Church, Thazhathmon', district: 'Adoor Clergy District', is_active: true } },
];

const LOCAL_STORAGE_KEY = 'zimrah_master_participants';

function getLocalParticipants(): Participant[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage participant parse failed:', err);
  }
  return [...SEED_PARTICIPANTS];
}

function saveLocalParticipants(participants: Participant[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(participants));
  } catch (err) {
    console.warn('LocalStorage participant save failed:', err);
  }
}

export const participantService = {
  async getParticipants(params: ParticipantQueryParams = {}): Promise<ParticipantListResponse> {
    const { search = '', churchId = '', ageCategory = '', page = 1, pageSize = 20 } = params;

    try {
      let query = supabase
        .from('participants')
        .select(`
          *,
          church:churches(id, code, name, name_malayalam, district, is_active)
        `, { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`chest_number.ilike.${term},name.ilike.${term},name_malayalam.ilike.${term},phone.ilike.${term}`);
      }

      if (churchId) {
        query = query.eq('church_id', churchId);
      }

      if (ageCategory) {
        query = query.eq('age_category', ageCategory);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('chest_number', { ascending: true })
        .range(from, to);

      if (!error && data) {
        return {
          participants: data as Participant[],
          total: count ?? data.length,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? data.length) / pageSize) || 1,
        };
      }
    } catch (err) {
      console.warn('Supabase getParticipants error, using local fallback:', err);
    }

    // Local fallback
    let list = getLocalParticipants();

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.chest_number.includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.name_malayalam && p.name_malayalam.includes(q)) ||
          (p.phone && p.phone.includes(q)) ||
          (p.church && p.church.name.toLowerCase().includes(q))
      );
    }

    if (churchId) {
      list = list.filter((p) => String(p.church_id) === String(churchId));
    }

    if (ageCategory) {
      list = list.filter((p) => p.age_category === ageCategory);
    }

    const total = list.length;
    const from = (page - 1) * pageSize;
    const paged = list.slice(from, from + pageSize);

    return {
      participants: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  async getParticipantById(id: string | number): Promise<Participant | null> {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select(`
          *,
          church:churches(id, code, name, name_malayalam, district, is_active)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data as Participant;
    } catch (err) {
      console.warn('Supabase getParticipantById error:', err);
    }

    const found = getLocalParticipants().find((p) => String(p.id) === String(id));
    return found || null;
  },

  async checkChestNumberUnique(
    chestNumber: string,
    editionId?: string | number,
    excludeId?: string | number
  ): Promise<boolean> {
    // Strictly treat chest number as string without parseInt
    const cleanChest = String(chestNumber).trim();
    if (!cleanChest) return false;

    try {
      let q = supabase.from('participants').select('id').eq('chest_number', cleanChest);
      if (editionId) {
        q = q.eq('edition_id', editionId);
      }
      if (excludeId) {
        q = q.neq('id', excludeId);
      }
      const { data } = await q;
      if (data && data.length > 0) return false;
      return true;
    } catch {
      const exists = getLocalParticipants().some(
        (p) => p.chest_number === cleanChest && String(p.id) !== String(excludeId)
      );
      return !exists;
    }
  },

  async createParticipant(
    data: Partial<Participant>
  ): Promise<{ success: boolean; participant?: Participant; error?: string }> {
    // Strictly preserve string chest number with leading zeros
    const cleanChest = String(data.chest_number || '').trim();
    if (!cleanChest) {
      return { success: false, error: 'Chest number is required.' };
    }

    const isUnique = await this.checkChestNumberUnique(cleanChest, data.edition_id);
    if (!isUnique) {
      return { success: false, error: `Chest number '${cleanChest}' is already registered in this edition.` };
    }

    // Default to active edition if not provided
    let editionId = data.edition_id;
    if (!editionId) {
      try {
        const { data: ed } = await supabase.from('editions').select('id').eq('is_active', true).maybeSingle();
        if (ed) editionId = ed.id;
      } catch {
        editionId = 'e2026';
      }
    }

    const payload = {
      edition_id: editionId,
      chest_number: cleanChest,
      name: (data.name || '').trim(),
      name_malayalam: (data.name_malayalam || '').trim(),
      gender: data.gender || 'M',
      church_id: data.church_id,
      age_category: data.age_category || 'OPEN',
      phone: (data.phone || '').trim(),
    };

    try {
      const { data: created, error } = await supabase
        .from('participants')
        .insert(payload)
        .select(`*, church:churches(id, code, name)`)
        .single();

      if (!error && created) {
        return { success: true, participant: created as Participant };
      }
      if (error) {
        console.warn('Supabase insert failed, using fallback:', error.message);
      }
    } catch (err) {
      console.warn('Supabase createParticipant exception:', err);
    }

    // Local fallback
    const local = getLocalParticipants();
    const church = (await churchService.getAllActiveChurches()).find(
      (c) => String(c.id) === String(data.church_id)
    );

    const newParticipant: Participant = {
      id: `p_${Date.now()}`,
      edition_id: editionId || 'e2026',
      chest_number: cleanChest,
      name: payload.name,
      name_malayalam: payload.name_malayalam,
      gender: payload.gender as Gender,
      church_id: payload.church_id!,
      age_category: payload.age_category as AgeCategory,
      phone: payload.phone,
      church,
      created_at: new Date().toISOString(),
    };

    local.push(newParticipant);
    saveLocalParticipants(local);
    return { success: true, participant: newParticipant };
  },

  async updateParticipant(
    id: string | number,
    data: Partial<Participant>
  ): Promise<{ success: boolean; participant?: Participant; error?: string }> {
    if (data.chest_number) {
      const cleanChest = String(data.chest_number).trim();
      const isUnique = await this.checkChestNumberUnique(cleanChest, data.edition_id, id);
      if (!isUnique) {
        return { success: false, error: `Chest number '${cleanChest}' is already assigned to another participant.` };
      }
      data.chest_number = cleanChest;
    }

    try {
      const { data: updated, error } = await supabase
        .from('participants')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`*, church:churches(id, code, name)`)
        .single();

      if (!error && updated) {
        return { success: true, participant: updated as Participant };
      }
    } catch (err) {
      console.warn('Supabase updateParticipant error:', err);
    }

    // Local fallback
    const local = getLocalParticipants();
    const idx = local.findIndex((p) => String(p.id) === String(id));
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...data };
      saveLocalParticipants(local);
      return { success: true, participant: local[idx] };
    }

    return { success: false, error: 'Participant not found.' };
  },

  async deleteParticipant(id: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('participants').delete().eq('id', id);
      if (!error) return { success: true };
      if (error.code === '23503') {
        return { success: false, error: 'Cannot delete participant with active competition entries or registrations.' };
      }
      return { success: false, error: error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: msg };
    } finally {
      const local = getLocalParticipants().filter((p) => String(p.id) !== String(id));
      saveLocalParticipants(local);
    }
  },

  /**
   * Parses and previews a CSV file for participant enrollment.
   * Preserves leading zeroes, detects duplicate chest numbers within file and against DB.
   */
  async previewParticipantCsv(
    csvContent: string,
    editionId: string | number
  ): Promise<CSVImportPreviewResult> {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return {
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        duplicatesInBatch: [],
        editionId,
      };
    }

    // Header inspection
    const headerLine = lines[0];
    const headers = headerLine
      .split(',')
      .map((h) => h.replace(/^\ufeff/, '').trim().toLowerCase().replace(/['"]/g, ''));

    const chestIdx = headers.findIndex((h) => h === 'chest_number' || h === 'chest_no' || h === 'chest');
    const nameIdx = headers.findIndex((h) => h === 'name' || h === 'full_name');
    const nameMalIdx = headers.findIndex((h) => h === 'name_malayalam' || h === 'malayalam');
    const genderIdx = headers.findIndex((h) => h === 'gender');
    const churchIdx = headers.findIndex((h) => h === 'church_code' || h === 'church');
    const ageIdx = headers.findIndex((h) => h === 'age_category' || h === 'category');
    const phoneIdx = headers.findIndex((h) => h === 'phone');

    const churches = await churchService.getAllActiveChurches();
    const churchMap = new Map<string, Church>();
    churches.forEach((c) => churchMap.set(c.code.toUpperCase(), c));

    // Existing participants for duplicate check
    const existing = await this.getParticipants({ page: 1, pageSize: 2000 });
    const existingChests = new Set(existing.participants.map((p) => p.chest_number));

    const seenChestsInBatch = new Set<string>();
    const duplicatesInBatch: string[] = [];
    const validRows: CSVParticipantRow[] = [];
    const invalidRows: CSVParticipantRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowLine = lines[i];
      // Basic CSV tokenization respecting quoted commas
      const rawCols: string[] = [];
      let inQuote = false;
      let token = '';
      for (let c = 0; c < rowLine.length; c++) {
        const char = rowLine[c];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          rawCols.push(token.trim().replace(/^"|"$/g, ''));
          token = '';
        } else {
          token += char;
        }
      }
      rawCols.push(token.trim().replace(/^"|"$/g, ''));

      // Clean chest number - PRESERVE STRING LEADING ZEROS
      const chest_number = chestIdx !== -1 && rawCols[chestIdx] ? String(rawCols[chestIdx]).trim() : '';
      const name = nameIdx !== -1 && rawCols[nameIdx] ? rawCols[nameIdx].trim() : '';
      const name_malayalam = nameMalIdx !== -1 && rawCols[nameMalIdx] ? rawCols[nameMalIdx].trim() : '';
      let gender = genderIdx !== -1 && rawCols[genderIdx] ? rawCols[genderIdx].trim().toUpperCase() : 'M';
      if (gender !== 'M' && gender !== 'F') gender = 'M';

      const church_code = churchIdx !== -1 && rawCols[churchIdx] ? rawCols[churchIdx].trim().toUpperCase() : '';
      let age_category = ageIdx !== -1 && rawCols[ageIdx] ? rawCols[ageIdx].trim().toUpperCase() : 'OPEN';
      if (!['JUNIOR', 'SENIOR', 'OPEN'].includes(age_category)) age_category = 'OPEN';

      const phone = phoneIdx !== -1 && rawCols[phoneIdx] ? rawCols[phoneIdx].trim() : '';

      const errors: string[] = [];

      if (!chest_number) {
        errors.push('Missing chest number.');
      }
      if (!name) {
        errors.push('Missing participant name.');
      }
      if (!church_code) {
        errors.push('Missing church code.');
      } else if (!churchMap.has(church_code)) {
        errors.push(`Church code '${church_code}' not found.`);
      }

      if (chest_number) {
        if (existingChests.has(chest_number)) {
          errors.push(`Chest #${chest_number} already exists in database.`);
        }
        if (seenChestsInBatch.has(chest_number)) {
          errors.push(`Duplicate chest #${chest_number} within this file.`);
          if (!duplicatesInBatch.includes(chest_number)) {
            duplicatesInBatch.push(chest_number);
          }
        }
        seenChestsInBatch.add(chest_number);
      }

      const rowObj: CSVParticipantRow = {
        rowNumber: i + 1,
        chest_number,
        name,
        name_malayalam,
        gender: gender as Gender,
        church_code,
        age_category: age_category as AgeCategory,
        phone,
        isValid: errors.length === 0,
        errors,
      };

      if (rowObj.isValid) {
        validRows.push(rowObj);
      } else {
        invalidRows.push(rowObj);
      }
    }

    return {
      totalRows: lines.length - 1,
      validRows,
      invalidRows,
      duplicatesInBatch,
      editionId,
    };
  },

  /**
   * Commits validated participants either via PostgreSQL RPC or fallback batch
   */
  async commitBulkParticipants(
    validRows: CSVParticipantRow[],
    editionId: string | number
  ): Promise<CSVImportExecutionResult> {
    if (validRows.length === 0) {
      return { success: true, importedCount: 0, skippedCount: 0, errors: [] };
    }

    try {
      // 1. Attempt PostgreSQL RPC `bulk_import_participants`
      const payload = validRows.map((r) => ({
        chest_number: r.chest_number,
        name: r.name,
        name_malayalam: r.name_malayalam || '',
        gender: r.gender,
        church_code: r.church_code,
        age_category: r.age_category,
        phone: r.phone || '',
      }));

      const { data, error } = await supabase.rpc('bulk_import_participants', {
        p_edition_id: editionId,
        p_records: payload,
        p_dry_run: false,
      });

      if (!error && data && data.success) {
        return {
          success: true,
          importedCount: data.imported_count || validRows.length,
          skippedCount: data.skipped_count || 0,
          errors: data.errors || [],
        };
      }
    } catch (err) {
      console.warn('RPC bulk_import_participants failed, attempting client insertion:', err);
    }

    // 2. Client-side sequential or local storage fallback
    const churches = await churchService.getAllActiveChurches();
    const churchMap = new Map<string, Church>();
    churches.forEach((c) => churchMap.set(c.code.toUpperCase(), c));

    let imported = 0;
    const errors: Array<{ row?: number; chest_number?: string; error: string }> = [];

    for (const r of validRows) {
      const church = churchMap.get(r.church_code);
      if (!church) {
        errors.push({ row: r.rowNumber, chest_number: r.chest_number, error: `Church code '${r.church_code}' not found` });
        continue;
      }

      const res = await this.createParticipant({
        edition_id: editionId,
        chest_number: r.chest_number,
        name: r.name,
        name_malayalam: r.name_malayalam,
        gender: r.gender,
        church_id: church.id,
        age_category: r.age_category,
        phone: r.phone,
      });

      if (res.success) {
        imported++;
      } else {
        errors.push({ row: r.rowNumber, chest_number: r.chest_number, error: res.error || 'Failed to create' });
      }
    }

    return {
      success: imported > 0 || errors.length === 0,
      importedCount: imported,
      skippedCount: errors.length,
      errors,
    };
  },

  /**
   * Generates sample CSV template for participant bulk upload with UTF-8 BOM
   */
  generateSampleCsvBlob(): Blob {
    const csvContent =
      '\ufeffchest_number,name,name_malayalam,gender,church_code,age_category,phone\n' +
      '001,Aaron Samuel,ആരോൺ സാമുവൽ,M,CH01,JUNIOR,9876543210\n' +
      '002,Sherin Mathew,ഷെറിൻ മാത്യു,F,CH01,SENIOR,9876543211\n' +
      '003,Joel Thomas,ജോയൽ തോമസ്,M,CH02,JUNIOR,9876543212\n' +
      '010,Mathew George,മാത്യു ജോർജ്,M,CH02,SENIOR,9876543213\n';

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  },
};
