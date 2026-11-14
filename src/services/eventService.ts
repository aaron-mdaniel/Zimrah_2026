import { supabase } from '@/lib/supabase';
import { cacheService } from './cacheService';
import {
  CompetitionEvent,
  EventCategory,
  EventDivision,
  EventSection,
  Edition,
} from '@/types';

export interface EventQueryParams {
  search?: string;
  categoryId?: string | number;
  divisionId?: string | number;
  type?: string;
  editionId?: string | number;
  page?: number;
  pageSize?: number;
}

export interface EventListResponse {
  events: CompetitionEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 34 Official Events from ZIMRAH 2026 Kalolsavam Master Seed
const SEED_EVENTS: CompetitionEvent[] = [
  { id: 'ev01', edition_id: 'e2026', code: 'EV01', name: 'Solo Eastern - Junior Boys', name_malayalam: 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_jb', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev02', edition_id: 'e2026', code: 'EV02', name: 'Solo Eastern - Junior Girls', name_malayalam: 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_jg', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev03', edition_id: 'e2026', code: 'EV03', name: 'Solo Eastern - Senior Boys', name_malayalam: 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ബോയ്സ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_sb', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev04', edition_id: 'e2026', code: 'EV04', name: 'Solo Eastern - Senior Girls', name_malayalam: 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ഗേൾസ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_sg', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev05', edition_id: 'e2026', code: 'EV05', name: 'Solo Western - Junior Boys', name_malayalam: 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_jb', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev06', edition_id: 'e2026', code: 'EV06', name: 'Solo Western - Junior Girls', name_malayalam: 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_jg', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev07', edition_id: 'e2026', code: 'EV07', name: 'Solo Western - Senior Boys', name_malayalam: 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ബോയ്സ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_sb', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev08', edition_id: 'e2026', code: 'EV08', name: 'Solo Western - Senior Girls', name_malayalam: 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ഗേൾസ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_sg', event_type: 'INDIVIDUAL', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev09', edition_id: 'e2026', code: 'EV09', name: 'Light Music - Girls', name_malayalam: 'ലളിതഗാനം - ഗേൾസ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev10', edition_id: 'e2026', code: 'EV10', name: 'Light Music - Boys', name_malayalam: 'ലളിതഗാനം - ബോയ്സ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev11', edition_id: 'e2026', code: 'EV11', name: 'Classical Music', name_malayalam: 'ശാസ്ത്രീയ സംഗീതം', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev12', edition_id: 'e2026', code: 'EV12', name: 'Organ Recital', name_malayalam: 'ഓർഗൻ റിസൈറ്റൽ', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev13', edition_id: 'e2026', code: 'EV13', name: 'Instrumental Music (Percussion)', name_malayalam: 'ഉപകരണ സംഗീതം (പെർക്യൂഷൻ)', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 8, duration_display: '3+5 മിനിറ്റ്സ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev14', edition_id: 'e2026', code: 'EV14', name: 'Instrumental Music (Violin)', name_malayalam: 'ഉപകരണ സംഗീതം (വയലിൻ)', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev15', edition_id: 'e2026', code: 'EV15', name: 'Group Song', name_malayalam: 'സമൂഹഗാനം', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'GROUP', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 4, max_participants: 12, max_entries_per_church: 1, contributes_to_individual: false, contributes_to_church: true, is_active: true },
  { id: 'ev16', edition_id: 'e2026', code: 'EV16', name: 'Quartet', name_malayalam: 'ക്വാർട്ടറ്റ്', category_id: 'cat_stage', division_id: 'div_1', section_id: 'sec_open', event_type: 'GROUP', min_participants: 4, max_participants: 4, max_entries_per_church: 1, contributes_to_individual: false, contributes_to_church: true, is_active: true },
  { id: 'ev17', edition_id: 'e2026', code: 'EV17', name: 'Pencil Drawing', name_malayalam: 'പെൻസിൽ ഡ്രോയിംഗ്', category_id: 'cat_lit', division_id: 'div_2', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev18', edition_id: 'e2026', code: 'EV18', name: 'Water Colour', name_malayalam: 'വാട്ടർ കളർ', category_id: 'cat_lit', division_id: 'div_2', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 75, duration_display: '75 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev19', edition_id: 'e2026', code: 'EV19', name: 'Cartoon', name_malayalam: 'കാർട്ടൂൺ', category_id: 'cat_lit', division_id: 'div_2', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev20', edition_id: 'e2026', code: 'EV20', name: 'Fancy Dress', name_malayalam: 'ഫാൻസി ഡ്രസ്സ്', category_id: 'cat_stage', division_id: 'div_3', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 3, duration_display: '3 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev21', edition_id: 'e2026', code: 'EV21', name: 'Mime', name_malayalam: 'മൂകാഭിനയം (മൈം)', category_id: 'cat_stage', division_id: 'div_3', section_id: 'sec_open', event_type: 'GROUP', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 6, max_entries_per_church: 1, contributes_to_individual: false, contributes_to_church: true, is_active: true },
  { id: 'ev22', edition_id: 'e2026', code: 'EV22', name: 'Mono Act', name_malayalam: 'മോണോ ആക്ട്', category_id: 'cat_stage', division_id: 'div_3', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev23', edition_id: 'e2026', code: 'EV23', name: 'Tableau', name_malayalam: 'ടാബ്ലോ', category_id: 'cat_stage', division_id: 'div_3', section_id: 'sec_open', event_type: 'GROUP', duration_minutes: 7, duration_display: '7 മിനിറ്റ്', min_participants: 4, max_participants: 15, max_entries_per_church: 1, contributes_to_individual: false, contributes_to_church: true, is_active: true },
  { id: 'ev24', edition_id: 'e2026', code: 'EV24', name: 'Skit', name_malayalam: 'സ്കിറ്റ്', category_id: 'cat_stage', division_id: 'div_3', section_id: 'sec_open', event_type: 'GROUP', duration_minutes: 10, duration_display: '10 മിനിറ്റ്', min_participants: 4, max_participants: 8, max_entries_per_church: 1, contributes_to_individual: false, contributes_to_church: true, is_active: true },
  { id: 'ev25', edition_id: 'e2026', code: 'EV25', name: 'Story Writing (Malayalam)', name_malayalam: 'കഥാരചന (മലയാളം)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev26', edition_id: 'e2026', code: 'EV26', name: 'Poem Writing (Malayalam)', name_malayalam: 'കവിതാരചന (മലയാളം)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev27', edition_id: 'e2026', code: 'EV27', name: 'Story Writing (English)', name_malayalam: 'കഥാരചന (ഇംഗ്ലീഷ്)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev28', edition_id: 'e2026', code: 'EV28', name: 'Poem Writing (English)', name_malayalam: 'കവിതാരചന (ഇംഗ്ലീഷ്)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_open', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev29', edition_id: 'e2026', code: 'EV29', name: 'Essay Writing - Junior (Malayalam)', name_malayalam: 'ഉപന്യാസ രചന ജൂനിയർ (മലയാളം)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_junior', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev30', edition_id: 'e2026', code: 'EV30', name: 'Essay Writing - Senior (English)', name_malayalam: 'ഉപന്യാസ രചന സീനിയർ (ഇംഗ്ലീഷ്)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_senior', event_type: 'INDIVIDUAL', duration_minutes: 60, duration_display: '60 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev31', edition_id: 'e2026', code: 'EV31', name: 'Elocution - Junior (Malayalam)', name_malayalam: 'പ്രസംഗം ജൂനിയർ (മലയാളം)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_junior', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev32', edition_id: 'e2026', code: 'EV32', name: 'Elocution - Senior (Malayalam)', name_malayalam: 'പ്രസംഗം സീനിയർ (മലയാളം)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_senior', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev33', edition_id: 'e2026', code: 'EV33', name: 'Elocution - Junior (English)', name_malayalam: 'പ്രസംഗം ജൂനിയർ (ഇംഗ്ലീഷ്)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_junior', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
  { id: 'ev34', edition_id: 'e2026', code: 'EV34', name: 'Elocution - Senior (English)', name_malayalam: 'പ്രസംഗം സീനിയർ (ഇംഗ്ലീഷ്)', category_id: 'cat_lit', division_id: 'div_4', section_id: 'sec_senior', event_type: 'INDIVIDUAL', duration_minutes: 5, duration_display: '5 മിനിറ്റ്', min_participants: 1, max_participants: 1, max_entries_per_church: 1, contributes_to_individual: true, contributes_to_church: true, is_active: true },
];

const SEED_CATEGORIES: EventCategory[] = [
  { id: 'cat_lit', edition_id: 'e2026', name: 'Literary Events', name_malayalam: 'സാഹിത്യ മത്സരങ്ങൾ', date: '2026-11-08', venue: 'Thazhathmon, TVM' },
  { id: 'cat_stage', edition_id: 'e2026', name: 'Stage Events', name_malayalam: 'സ്റ്റേജ് മത്സരങ്ങൾ', date: '2026-11-14', venue: 'St. Mathias CSI Church, Munroethuruth' },
];

const SEED_DIVISIONS: EventDivision[] = [
  { id: 'div_1', edition_id: 'e2026', division_number: 1, name: 'Music', name_malayalam: 'വിഭാഗം - 1: സംഗീതം (16 ഇനങ്ങൾ)' },
  { id: 'div_2', edition_id: 'e2026', division_number: 2, name: 'Fine Arts', name_malayalam: 'വിഭാഗം - 2: ഫൈൻ ആർട്സ് (3 ഇനങ്ങൾ)' },
  { id: 'div_3', edition_id: 'e2026', division_number: 3, name: 'Theater', name_malayalam: 'വിഭാഗം - 3: തീയറ്റർ മത്സരങ്ങൾ (5 ഇനങ്ങൾ)' },
  { id: 'div_4', edition_id: 'e2026', division_number: 4, name: 'Writing & Elocution', name_malayalam: 'വിഭാഗം - 4: രചന പ്രസംഗ മത്സരങ്ങൾ (10 ഇനങ്ങൾ)' },
];

const SEED_SECTIONS: EventSection[] = [
  { id: 'sec_jb', edition_id: 'e2026', code: 'JB', name: 'Junior Boys', name_malayalam: 'ജൂനിയർ ബോയ്സ്' },
  { id: 'sec_jg', edition_id: 'e2026', code: 'JG', name: 'Junior Girls', name_malayalam: 'ജൂനിയർ ഗേൾസ്' },
  { id: 'sec_sb', edition_id: 'e2026', code: 'SB', name: 'Senior Boys', name_malayalam: 'സീനിയർ ബോയ്സ്' },
  { id: 'sec_sg', edition_id: 'e2026', code: 'SG', name: 'Senior Girls', name_malayalam: 'സീനിയർ ഗേൾസ്' },
  { id: 'sec_junior', edition_id: 'e2026', code: 'JUNIOR', name: 'Junior', name_malayalam: 'ജൂനിയർ' },
  { id: 'sec_senior', edition_id: 'e2026', code: 'SENIOR', name: 'Senior', name_malayalam: 'സീനിയർ' },
  { id: 'sec_open', edition_id: 'e2026', code: 'OPEN', name: 'Open', name_malayalam: 'പൊതു വിഭാഗം' },
];

const LOCAL_STORAGE_KEY = 'zimrah_master_events';

function getLocalEvents(): CompetitionEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage events parse failed:', err);
  }
  return [...SEED_EVENTS];
}

export const eventService = {
  async getEvents(params: EventQueryParams = {}): Promise<EventListResponse> {
    const { search = '', categoryId = '', divisionId = '', type = '', page = 1, pageSize = 20 } = params;

    try {
      let query = supabase
        .from('events')
        .select(`
          *,
          category:event_categories(id, name, name_malayalam, date, venue),
          division:event_divisions(id, division_number, name, name_malayalam),
          section:event_sections(id, code, name, name_malayalam)
        `, { count: 'exact' });

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`code.ilike.${term},name.ilike.${term},name_malayalam.ilike.${term}`);
      }

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (divisionId) {
        query = query.eq('division_id', divisionId);
      }

      if (type) {
        query = query.eq('event_type', type);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('code', { ascending: true })
        .range(from, to);

      if (!error && data) {
        return {
          events: data as CompetitionEvent[],
          total: count ?? data.length,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? data.length) / pageSize) || 1,
        };
      }
    } catch (err) {
      console.warn('Supabase getEvents error, using local fallback:', err);
    }

    // Local fallback
    let list = getLocalEvents();

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          (e.name_malayalam && e.name_malayalam.includes(q))
      );
    }

    if (categoryId) {
      list = list.filter((e) => String(e.category_id) === String(categoryId));
    }

    if (divisionId) {
      list = list.filter((e) => String(e.division_id) === String(divisionId));
    }

    if (type) {
      list = list.filter((e) => e.event_type === type);
    }

    const total = list.length;
    const from = (page - 1) * pageSize;
    const paged = list.slice(from, from + pageSize);

    return {
      events: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  async getEventById(id: string | number): Promise<CompetitionEvent | null> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          category:event_categories(id, name, name_malayalam, date, venue),
          division:event_divisions(id, division_number, name, name_malayalam),
          section:event_sections(id, code, name, name_malayalam)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return data as CompetitionEvent;
    } catch (err) {
      console.warn('Supabase getEventById error:', err);
    }

    const found = getLocalEvents().find((e) => String(e.id) === String(id));
    return found || null;
  },

  async getEventByCode(code: string): Promise<CompetitionEvent | null> {
    const clean = code.trim().toUpperCase();
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          category:event_categories(id, name, name_malayalam, date, venue),
          division:event_divisions(id, division_number, name, name_malayalam),
          section:event_sections(id, code, name, name_malayalam)
        `)
        .ilike('code', clean)
        .maybeSingle();

      if (!error && data) return data as CompetitionEvent;
    } catch (err) {
      console.warn('Supabase getEventByCode error:', err);
    }

    const found = getLocalEvents().find((e) => e.code.toUpperCase() === clean);
    return found || null;
  },

  async getCategories(): Promise<EventCategory[]> {
    try {
      const { data, error } = await supabase.from('event_categories').select('*').order('name');
      if (!error && data) return data as EventCategory[];
    } catch (err) {
      console.warn('Supabase getCategories error:', err);
    }
    return SEED_CATEGORIES;
  },

  async getDivisions(): Promise<EventDivision[]> {
    try {
      const { data, error } = await supabase.from('event_divisions').select('*').order('division_number');
      if (!error && data) return data as EventDivision[];
    } catch (err) {
      console.warn('Supabase getDivisions error:', err);
    }
    return SEED_DIVISIONS;
  },

  async getSections(): Promise<EventSection[]> {
    try {
      const { data, error } = await supabase.from('event_sections').select('*').order('code');
      if (!error && data) return data as EventSection[];
    } catch (err) {
      console.warn('Supabase getSections error:', err);
    }
    return SEED_SECTIONS;
  },

  async getEditions(): Promise<Edition[]> {
    try {
      const { data, error } = await supabase.from('editions').select('*').order('year', { ascending: false });
      if (!error && data) return data as Edition[];
    } catch (err) {
      console.warn('Supabase getEditions error:', err);
    }
    return [
      {
        id: 'e2026',
        year: 2026,
        name: 'ZIMRAH 2026',
        theme: 'Song of Praise',
        organizer: 'CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement',
        start_date: '2026-11-08',
        end_date: '2026-11-14',
        is_active: true,
      },
    ];
  },

  async checkCodeUnique(code: string, editionId?: string | number, excludeId?: string | number): Promise<boolean> {
    const clean = code.trim().toUpperCase();
    try {
      let q = supabase.from('events').select('id').ilike('code', clean);
      if (editionId) q = q.eq('edition_id', editionId);
      if (excludeId) q = q.neq('id', excludeId);
      const { data } = await q;
      if (data && data.length > 0) return false;
      return true;
    } catch {
      const existing = getLocalEvents().some(
        (e) => e.code.toUpperCase() === clean && String(e.id) !== String(excludeId)
      );
      return !existing;
    }
  },

  async createEvent(data: Partial<CompetitionEvent>): Promise<{ success: boolean; event?: CompetitionEvent; error?: string }> {
    const cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Event code is required.' };

    const isUnique = await this.checkCodeUnique(cleanCode, data.edition_id);
    if (!isUnique) {
      return { success: false, error: `Event code '${cleanCode}' is already registered in this edition.` };
    }

    let editionId = data.edition_id;
    if (!editionId) {
      const editions = await this.getEditions();
      const active = editions.find((e) => e.is_active) || editions[0];
      editionId = active.id;
    }

    const payload = {
      edition_id: editionId,
      code: cleanCode,
      name: (data.name || '').trim(),
      name_malayalam: (data.name_malayalam || '').trim(),
      category_id: data.category_id || (await this.getCategories())[0]?.id || 'cat_stage',
      division_id: data.division_id,
      section_id: data.section_id,
      event_type: data.event_type || 'INDIVIDUAL',
      duration_minutes: data.duration_minutes,
      duration_display: data.duration_display || '',
      min_participants: data.min_participants ?? (data.event_type === 'GROUP' ? 4 : 1),
      max_participants: data.max_participants ?? (data.event_type === 'GROUP' ? 12 : 1),
      max_entries_per_church: data.max_entries_per_church ?? 1,
      contributes_to_individual: data.contributes_to_individual ?? (data.event_type === 'INDIVIDUAL'),
      contributes_to_church: data.contributes_to_church ?? true,
      is_active: data.is_active ?? true,
    };

    try {
      const { data: created, error } = await supabase
        .from('events')
        .insert(payload)
        .select(`
          *,
          category:event_categories(id, name, name_malayalam),
          division:event_divisions(id, division_number, name, name_malayalam),
          section:event_sections(id, code, name, name_malayalam)
        `)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      if (created) {
        await cacheService.invalidateAll(undefined, 'EVENT_CREATED').catch(() => {});
        return { success: true, event: created as CompetitionEvent };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database insertion failed';
      return { success: false, error: msg };
    }

    return { success: false, error: 'Database did not return created competition event.' };
  },

  async updateEvent(
    id: string | number,
    data: Partial<CompetitionEvent>
  ): Promise<{ success: boolean; event?: CompetitionEvent; error?: string }> {
    if (data.code) {
      const clean = data.code.trim().toUpperCase();
      const isUnique = await this.checkCodeUnique(clean, data.edition_id, id);
      if (!isUnique) {
        return { success: false, error: `Event code '${clean}' is already assigned to another competition.` };
      }
      data.code = clean;
    }

    try {
      const { data: updated, error } = await supabase
        .from('events')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          category:event_categories(id, name, name_malayalam),
          division:event_divisions(id, division_number, name, name_malayalam),
          section:event_sections(id, code, name, name_malayalam)
        `)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      if (updated) {
        await cacheService.invalidateAll(undefined, 'EVENT_UPDATED').catch(() => {});
        return { success: true, event: updated as CompetitionEvent };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database update failed';
      return { success: false, error: msg };
    }

    return { success: false, error: 'Event record not found or could not be updated.' };
  },

  async toggleEventActive(id: string | number, currentStatus: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateEvent(id, { is_active: !currentStatus });
  },

  async deleteEvent(id: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) {
        if (error.code === '23503') {
          return { success: false, error: 'Cannot delete competition with existing registrations or results.' };
        }
        return { success: false, error: error.message };
      }
      await cacheService.invalidateAll(undefined, 'EVENT_DELETED').catch(() => {});
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: msg };
    }
  },
};
