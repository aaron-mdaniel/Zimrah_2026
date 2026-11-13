import { supabase } from '@/lib/supabase';
import { Church } from '@/types';

export interface ChurchQueryParams {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export interface ChurchListResponse {
  churches: (Church & { participant_count?: number; registration_count?: number })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SEED_CHURCHES: Church[] = [
  { id: 'c1', code: 'CH01', name: 'St. Mathias CSI Church, Munroethuruth', name_malayalam: 'സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്', district: 'Adoor Clergy District', vicar_name: 'Rev. John Philip', contact_phone: '9447100001', is_active: true },
  { id: 'c2', code: 'CH02', name: 'Holy Trinity CSI Church, Adoor', name_malayalam: 'ഹോളി ട്രിനിറ്റി സി.എസ്.ഐ ചർച്ച്, അടൂർ', district: 'Adoor Clergy District', vicar_name: 'Rev. Thomas Mathew', contact_phone: '9447100002', is_active: true },
  { id: 'c3', code: 'CH03', name: 'St. Thomas CSI Church, Kannamkode', name_malayalam: 'സെന്റ് തോമസ് സി.എസ്.ഐ ചർച്ച്, കണ്ണങ്കോട്', district: 'Adoor Clergy District', vicar_name: 'Rev. P. K. George', contact_phone: '9447100003', is_active: true },
  { id: 'c4', code: 'CH04', name: 'All Saints CSI Church, Thazhathmon', name_malayalam: 'ഓൾ സെയിന്റ്സ് സി.എസ്.ഐ ചർച്ച്, താഴത്തുമൺ', district: 'Adoor Clergy District', vicar_name: 'Rev. Abraham Varghese', contact_phone: '9447100004', is_active: true },
  { id: 'c5', code: 'CH05', name: 'Christ Church CSI, Anandappally', name_malayalam: 'ക്രൈസ്റ്റ് ചർച്ച് സി.എസ്.ഐ, ആനന്ദപ്പള്ളി', district: 'Adoor Clergy District', vicar_name: 'Rev. Jacob Koshy', contact_phone: '9447100005', is_active: true },
  { id: 'c6', code: 'CH06', name: 'St. Mark CSI Church, Peringanadu', name_malayalam: 'സെന്റ് മാർക്ക് സി.എസ്.ഐ ചർച്ച്, പെരിങ്ങനാട്', district: 'Adoor Clergy District', vicar_name: 'Rev. Sam George', contact_phone: '9447100006', is_active: true },
  { id: 'c7', code: 'CH07', name: 'St. Luke CSI Church, Kadampanad', name_malayalam: 'സെന്റ് ലൂക്ക് സി.എസ്.ഐ ചർച്ച്, കടമ്പനാട്', district: 'Adoor Clergy District', vicar_name: 'Rev. Varghese Philip', contact_phone: '9447100007', is_active: true },
  { id: 'c8', code: 'CH08', name: 'St. Stephen CSI Church, Parakode', name_malayalam: 'സെന്റ് സ്റ്റീഫൻ സി.എസ്.ഐ ചർച്ച്, പറക്കോട്', district: 'Adoor Clergy District', vicar_name: 'Rev. Sunny Varghese', contact_phone: '9447100008', is_active: true },
];

const LOCAL_STORAGE_KEY = 'zimrah_master_churches';

function getLocalChurches(): Church[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage church parse failed:', err);
  }
  return [...SEED_CHURCHES];
}

function saveLocalChurches(churches: Church[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(churches));
  } catch (err) {
    console.warn('LocalStorage church save failed:', err);
  }
}

export const churchService = {
  async getChurches(params: ChurchQueryParams = {}): Promise<ChurchListResponse> {
    const { search = '', status = 'all', page = 1, pageSize = 15 } = params;

    try {
      let query = supabase.from('churches').select('*', { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`code.ilike.${term},name.ilike.${term},name_malayalam.ilike.${term},vicar_name.ilike.${term}`);
      }

      if (status === 'active') {
        query = query.eq('is_active', true);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('code', { ascending: true })
        .range(from, to);

      if (!error && data) {
        return {
          churches: data as Church[],
          total: count ?? data.length,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? data.length) / pageSize) || 1,
        };
      }
    } catch (err) {
      console.warn('Supabase getChurches error, using local fallback:', err);
    }

    // Local fallback
    let list = getLocalChurches();

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.name_malayalam && c.name_malayalam.includes(q)) ||
          (c.vicar_name && c.vicar_name.toLowerCase().includes(q))
      );
    }

    if (status === 'active') {
      list = list.filter((c) => c.is_active);
    } else if (status === 'inactive') {
      list = list.filter((c) => !c.is_active);
    }

    const total = list.length;
    const from = (page - 1) * pageSize;
    const paged = list.slice(from, from + pageSize);

    return {
      churches: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  async getAllActiveChurches(): Promise<Church[]> {
    try {
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (!error && data) {
        return data as Church[];
      }
    } catch (err) {
      console.warn('Supabase getAllActiveChurches error:', err);
    }

    return getLocalChurches().filter((c) => c.is_active);
  },

  async getChurchById(id: string | number): Promise<Church | null> {
    try {
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data as Church;
    } catch (err) {
      console.warn('Supabase getChurchById error:', err);
    }

    const found = getLocalChurches().find((c) => String(c.id) === String(id));
    return found || null;
  },

  async checkCodeUnique(code: string, excludeId?: string | number): Promise<boolean> {
    const cleanCode = code.trim().toUpperCase();
    try {
      let q = supabase.from('churches').select('id').ilike('code', cleanCode);
      if (excludeId) {
        q = q.neq('id', excludeId);
      }
      const { data } = await q;
      if (data && data.length > 0) return false;
      return true;
    } catch {
      const existing = getLocalChurches().some(
        (c) => c.code.toUpperCase() === cleanCode && String(c.id) !== String(excludeId)
      );
      return !existing;
    }
  },

  async createChurch(data: Partial<Church>): Promise<{ success: boolean; church?: Church; error?: string }> {
    const cleanCode = (data.code || '').trim().toUpperCase();
    const isUnique = await this.checkCodeUnique(cleanCode);
    if (!isUnique) {
      return { success: false, error: `Church code '${cleanCode}' is already assigned.` };
    }

    const payload = {
      code: cleanCode,
      name: (data.name || '').trim(),
      name_malayalam: (data.name_malayalam || '').trim(),
      district: (data.district || 'Adoor Clergy District').trim(),
      vicar_name: (data.vicar_name || '').trim(),
      youth_leader_name: (data.youth_leader_name || '').trim(),
      contact_phone: (data.contact_phone || '').trim(),
      contact_email: (data.contact_email || '').trim(),
      is_active: data.is_active ?? true,
    };

    try {
      const { data: created, error } = await supabase
        .from('churches')
        .insert(payload)
        .select()
        .single();

      if (!error && created) {
        return { success: true, church: created as Church };
      }
      if (error) {
        console.warn('Supabase insert failed, using fallback:', error.message);
      }
    } catch (err: unknown) {
      console.warn('Supabase create exception:', err);
    }

    // Local fallback
    const local = getLocalChurches();
    const newChurch: Church = {
      id: `c_${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    local.push(newChurch);
    saveLocalChurches(local);
    return { success: true, church: newChurch };
  },

  async updateChurch(id: string | number, data: Partial<Church>): Promise<{ success: boolean; church?: Church; error?: string }> {
    if (data.code) {
      const cleanCode = data.code.trim().toUpperCase();
      const isUnique = await this.checkCodeUnique(cleanCode, id);
      if (!isUnique) {
        return { success: false, error: `Church code '${cleanCode}' is already assigned.` };
      }
      data.code = cleanCode;
    }

    try {
      const { data: updated, error } = await supabase
        .from('churches')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && updated) {
        return { success: true, church: updated as Church };
      }
    } catch (err) {
      console.warn('Supabase update error:', err);
    }

    // Local fallback
    const local = getLocalChurches();
    const idx = local.findIndex((c) => String(c.id) === String(id));
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...data, updated_at: new Date().toISOString() };
      saveLocalChurches(local);
      return { success: true, church: local[idx] };
    }
    return { success: false, error: 'Church record not found' };
  },

  async toggleChurchStatus(id: string | number, currentStatus: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateChurch(id, { is_active: !currentStatus });
  },

  async deleteChurch(id: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('churches').delete().eq('id', id);
      if (!error) return { success: true };
      if (error.code === '23503') {
        return { success: false, error: 'Cannot delete church because participants or registrations are registered under it.' };
      }
      return { success: false, error: error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: msg };
    } finally {
      // Also update local storage if fallback
      const local = getLocalChurches().filter((c) => String(c.id) !== String(id));
      saveLocalChurches(local);
    }
  },
};
