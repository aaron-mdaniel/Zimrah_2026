import { supabase } from '@/lib/supabase';
import {
  Registration,
  CompetitionEvent,
  Participant,
  GroupRegistrationMember,
} from '@/types';
import { eventService } from './eventService';
import { churchService } from './churchService';
import { participantService } from './participantService';

export interface RegistrationDashboardEvent extends CompetitionEvent {
  registration_count: number;
}

export interface RegistrationDashboardResponse {
  events: RegistrationDashboardEvent[];
  totalRegistrations: number;
}

export interface IndividualRegistrationPayload {
  edition_id?: string | number;
  event_id: string | number;
  church_id: string | number;
  participant_id: string | number;
  chest_number?: string;
}

export interface GroupRegistrationPayload {
  edition_id?: string | number;
  event_id: string | number;
  church_id: string | number;
  group_name: string;
  chest_number: string;
  member_ids: (string | number)[];
}

const LOCAL_STORAGE_REGISTRATIONS_KEY = 'zimrah_master_registrations';

// Initial seed registrations for local fallback
const SEED_REGISTRATIONS: Registration[] = [
  {
    id: 'reg_1',
    edition_id: 'e2026',
    event_id: 'ev01',
    church_id: 'c1',
    participant_id: 'p1',
    chest_number: '001',
    registered_at: '2026-11-01T10:00:00Z',
    participant: {
      id: 'p1',
      edition_id: 'e2026',
      chest_number: '001',
      name: 'Aaron Samuel',
      name_malayalam: 'ആരോൺ സാമുവൽ',
      gender: 'M',
      church_id: 'c1',
      age_category: 'JUNIOR',
    },
    church: {
      id: 'c1',
      code: 'CH01',
      name: 'St. Mathias CSI Church, Munroethuruth',
      district: 'Adoor Clergy District',
      is_active: true,
    },
  },
  {
    id: 'reg_2',
    edition_id: 'e2026',
    event_id: 'ev01',
    church_id: 'c2',
    participant_id: 'p5',
    chest_number: '010',
    registered_at: '2026-11-01T10:30:00Z',
    participant: {
      id: 'p5',
      edition_id: 'e2026',
      chest_number: '010',
      name: 'Mathew Thomas',
      name_malayalam: 'മാത്യു തോമസ്',
      gender: 'M',
      church_id: 'c2',
      age_category: 'SENIOR',
    },
    church: {
      id: 'c2',
      code: 'CH02',
      name: 'Holy Trinity CSI Church, Adoor',
      district: 'Adoor Clergy District',
      is_active: true,
    },
  },
  {
    id: 'reg_3',
    edition_id: 'e2026',
    event_id: 'ev15',
    church_id: 'c1',
    group_name: 'St. Mathias Youth Choir',
    chest_number: 'G01',
    registered_at: '2026-11-01T11:00:00Z',
    church: {
      id: 'c1',
      code: 'CH01',
      name: 'St. Mathias CSI Church, Munroethuruth',
      district: 'Adoor Clergy District',
      is_active: true,
    },
    members: [
      {
        id: 'm1',
        registration_id: 'reg_3',
        participant_id: 'p1',
        participant: {
          id: 'p1',
          edition_id: 'e2026',
          chest_number: '001',
          name: 'Aaron Samuel',
          gender: 'M',
          church_id: 'c1',
          age_category: 'JUNIOR',
        },
      },
      {
        id: 'm2',
        registration_id: 'reg_3',
        participant_id: 'p2',
        participant: {
          id: 'p2',
          edition_id: 'e2026',
          chest_number: '002',
          name: 'Joel Mathew',
          gender: 'M',
          church_id: 'c1',
          age_category: 'JUNIOR',
        },
      },
      {
        id: 'm3',
        registration_id: 'reg_3',
        participant_id: 'p3',
        participant: {
          id: 'p3',
          edition_id: 'e2026',
          chest_number: '003',
          name: 'Titus George',
          gender: 'M',
          church_id: 'c1',
          age_category: 'JUNIOR',
        },
      },
      {
        id: 'm4',
        registration_id: 'reg_3',
        participant_id: 'p4',
        participant: {
          id: 'p4',
          edition_id: 'e2026',
          chest_number: '004',
          name: 'Kiran Varghese',
          gender: 'M',
          church_id: 'c1',
          age_category: 'JUNIOR',
        },
      },
    ],
  },
];

function getLocalRegistrations(): Registration[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage registrations parse failed:', err);
  }
  return [...SEED_REGISTRATIONS];
}

function saveLocalRegistrations(regs: Registration[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(regs));
  } catch (err) {
    console.warn('LocalStorage registrations save failed:', err);
  }
}

export const registrationService = {
  /**
   * Fetches event-wise registration dashboard: each event with its total registered count.
   */
  async getRegistrationDashboard(params: {
    search?: string;
    type?: string;
    categoryId?: string;
    divisionId?: string;
  } = {}): Promise<RegistrationDashboardResponse> {
    const { search = '', type = '', categoryId = '', divisionId = '' } = params;

    try {
      // 1. Fetch events
      const eventsRes = await eventService.getEvents({
        search,
        type,
        categoryId,
        divisionId,
        page: 1,
        pageSize: 100,
      });

      // 2. Fetch registration counts per event from Supabase
      const { data: regCounts, error } = await supabase
        .from('registrations')
        .select('event_id');

      if (!error && regCounts) {
        const countMap = new Map<string, number>();
        regCounts.forEach((r) => {
          const evId = String(r.event_id);
          countMap.set(evId, (countMap.get(evId) || 0) + 1);
        });

        const eventsWithCounts: RegistrationDashboardEvent[] = eventsRes.events.map((ev) => ({
          ...ev,
          registration_count: countMap.get(String(ev.id)) || 0,
        }));

        return {
          events: eventsWithCounts,
          totalRegistrations: regCounts.length,
        };
      }
    } catch (err) {
      console.warn('Supabase getRegistrationDashboard error, falling back:', err);
    }

    // Local fallback
    const localRegs = getLocalRegistrations();
    const eventsRes = await eventService.getEvents({
      search,
      type,
      categoryId,
      divisionId,
      page: 1,
      pageSize: 100,
    });

    const countMap = new Map<string, number>();
    localRegs.forEach((r) => {
      const evId = String(r.event_id);
      countMap.set(evId, (countMap.get(evId) || 0) + 1);
    });

    const eventsWithCounts: RegistrationDashboardEvent[] = eventsRes.events.map((ev) => ({
      ...ev,
      registration_count: countMap.get(String(ev.id)) || 0,
    }));

    return {
      events: eventsWithCounts,
      totalRegistrations: localRegs.length,
    };
  },

  /**
   * Fetches all registered entries (solo or group) for a specific competition event.
   */
  async getEventRegistrations(eventId: string | number): Promise<Registration[]> {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          *,
          church:churches(id, code, name, district, is_active),
          participant:participants(id, chest_number, name, name_malayalam, gender, age_category, phone),
          members:group_registration_members(
            id,
            role,
            participant:participants(id, chest_number, name, name_malayalam, gender, age_category)
          )
        `)
        .eq('event_id', eventId)
        .order('chest_number', { ascending: true });

      if (!error && data) {
        return data as Registration[];
      }
    } catch (err) {
      console.warn('Supabase getEventRegistrations error, using fallback:', err);
    }

    const localRegs = getLocalRegistrations();
    return localRegs.filter((r) => String(r.event_id) === String(eventId));
  },

  /**
   * Registers a single participant for an individual competition event.
   */
  async createIndividualRegistration(
    payload: IndividualRegistrationPayload
  ): Promise<{ success: boolean; registration?: Registration; error?: string }> {
    // 1. Fetch participant & event details for validation
    const participant = await participantService.getParticipantById(payload.participant_id);
    if (!participant) {
      return { success: false, error: 'Participant not found in directory.' };
    }

    const event = await eventService.getEventById(payload.event_id);
    if (!event) {
      return { success: false, error: 'Competition event not found.' };
    }

    if (event.event_type !== 'INDIVIDUAL') {
      return { success: false, error: 'This is a group competition. Use group team registration.' };
    }

    // 2. Validate church affiliation
    if (String(participant.church_id) !== String(payload.church_id)) {
      return {
        success: false,
        error: `Church Affiliation Mismatch: Contestant '${participant.name}' belongs to church ${participant.church?.name || participant.church_id}, not the selected church.`,
      };
    }

    // 3. Validate duplicate registration
    const existing = await this.getEventRegistrations(payload.event_id);
    const isAlreadyRegistered = existing.some(
      (r) => String(r.participant_id) === String(payload.participant_id)
    );
    if (isAlreadyRegistered) {
      return {
        success: false,
        error: `Contestant '${participant.name}' is already registered for ${event.code} (${event.name}).`,
      };
    }

    // 4. Validate church quota
    const churchEntries = existing.filter((r) => String(r.church_id) === String(payload.church_id));
    if (churchEntries.length >= event.max_entries_per_church) {
      return {
        success: false,
        error: `Church Quota Exceeded: Church already has ${churchEntries.length} entries for ${event.code} (maximum permitted: ${event.max_entries_per_church}).`,
      };
    }

    // Autofill chest number from participant if not overridden
    const chestNumber = payload.chest_number?.trim() || String(participant.chest_number);

    let editionId = payload.edition_id;
    if (!editionId) {
      const editions = await eventService.getEditions();
      editionId = editions[0]?.id || 'e2026';
    }

    try {
      // Attempt RPC function
      const { data, error } = await supabase.rpc('create_individual_registration', {
        p_edition_id: editionId,
        p_event_id: payload.event_id,
        p_church_id: payload.church_id,
        p_participant_id: payload.participant_id,
        p_chest_number: chestNumber,
      });

      if (!error && data && data.success) {
        return { success: true };
      }
      if (error) {
        console.warn('RPC create_individual_registration error, trying direct insert:', error.message);
      }
    } catch (err) {
      console.warn('Individual registration RPC exception:', err);
    }

    // Direct Supabase insert
    try {
      const { data: created, error } = await supabase
        .from('registrations')
        .insert({
          edition_id: editionId,
          event_id: payload.event_id,
          church_id: payload.church_id,
          participant_id: payload.participant_id,
          chest_number: chestNumber,
        })
        .select()
        .single();

      if (!error && created) {
        return { success: true, registration: created as Registration };
      }
    } catch (err) {
      console.warn('Supabase direct insert exception:', err);
    }

    // Local fallback
    const local = getLocalRegistrations();
    const church = await churchService.getChurchById(payload.church_id);

    const newReg: Registration = {
      id: `reg_${Date.now()}`,
      edition_id: editionId,
      event_id: payload.event_id,
      church_id: payload.church_id,
      participant_id: payload.participant_id,
      chest_number: chestNumber,
      registered_at: new Date().toISOString(),
      participant,
      church: church || undefined,
      event,
    };

    local.push(newReg);
    saveLocalRegistrations(local);
    return { success: true, registration: newReg };
  },

  /**
   * Registers a church team with multiple roster members for a group competition.
   */
  async createGroupRegistration(
    payload: GroupRegistrationPayload
  ): Promise<{ success: boolean; registration?: Registration; error?: string }> {
    const event = await eventService.getEventById(payload.event_id);
    if (!event) {
      return { success: false, error: 'Competition event not found.' };
    }

    if (event.event_type !== 'GROUP') {
      return { success: false, error: 'This is an individual event. Use solo registration.' };
    }

    if (!payload.group_name.trim()) {
      return { success: false, error: 'Team name is required.' };
    }

    if (!payload.chest_number.trim()) {
      return { success: false, error: 'Team chest number is required.' };
    }

    const memberCount = payload.member_ids.length;
    if (memberCount < event.min_participants) {
      return {
        success: false,
        error: `Team size under minimum: ${event.code} requires at least ${event.min_participants} participants (selected: ${memberCount}).`,
      };
    }

    if (memberCount > event.max_participants) {
      return {
        success: false,
        error: `Team size exceeds maximum: ${event.code} allows at most ${event.max_participants} participants (selected: ${memberCount}).`,
      };
    }

    // Validate church membership of all members
    const churchParticipants = await this.getChurchParticipants(payload.church_id);
    const validMemberIds = new Set(churchParticipants.map((p) => String(p.id)));

    for (const mId of payload.member_ids) {
      if (!validMemberIds.has(String(mId))) {
        return {
          success: false,
          error: 'Church Membership Violation: One or more selected members do not belong to the representing church.',
        };
      }
    }

    // Check duplicate member registration in another team for this same event
    const existingRegs = await this.getEventRegistrations(payload.event_id);
    for (const reg of existingRegs) {
      if (reg.members) {
        for (const m of reg.members) {
          if (payload.member_ids.map(String).includes(String(m.participant_id))) {
            return {
              success: false,
              error: `Participant '${m.participant?.name || m.participant_id}' is already registered in team '${reg.group_name}' for this event.`,
            };
          }
        }
      }
    }

    // Check church quota
    const churchGroups = existingRegs.filter((r) => String(r.church_id) === String(payload.church_id));
    if (churchGroups.length >= event.max_entries_per_church) {
      return {
        success: false,
        error: `Church Quota Exceeded: Church already has ${churchGroups.length} teams registered for ${event.code} (max allowed: ${event.max_entries_per_church}).`,
      };
    }

    let editionId = payload.edition_id;
    if (!editionId) {
      const editions = await eventService.getEditions();
      editionId = editions[0]?.id || 'e2026';
    }

    try {
      // 1. Try PostgreSQL RPC
      const { data, error } = await supabase.rpc('create_group_registration', {
        p_edition_id: editionId,
        p_event_id: payload.event_id,
        p_church_id: payload.church_id,
        p_group_name: payload.group_name.trim(),
        p_chest_number: payload.chest_number.trim(),
        p_member_ids: payload.member_ids,
      });

      if (!error && data && data.success) {
        return { success: true };
      }
      if (error) {
        console.warn('RPC create_group_registration error, falling back:', error.message);
      }
    } catch (err) {
      console.warn('Group registration RPC exception:', err);
    }

    // Local fallback
    const local = getLocalRegistrations();
    const church = await churchService.getChurchById(payload.church_id);

    const members: GroupRegistrationMember[] = churchParticipants
      .filter((p) => payload.member_ids.map(String).includes(String(p.id)))
      .map((p, idx) => ({
        id: `m_${Date.now()}_${idx}`,
        registration_id: `reg_${Date.now()}`,
        participant_id: p.id,
        participant: p,
      }));

    const newReg: Registration = {
      id: `reg_${Date.now()}`,
      edition_id: editionId,
      event_id: payload.event_id,
      church_id: payload.church_id,
      group_name: payload.group_name.trim(),
      chest_number: payload.chest_number.trim(),
      registered_at: new Date().toISOString(),
      church: church || undefined,
      event,
      members,
    };

    local.push(newReg);
    saveLocalRegistrations(local);
    return { success: true, registration: newReg };
  },

  /**
   * Removes a registration entry.
   */
  async deleteRegistration(id: string | number): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (!error) return { success: true };
      if (error.code === '23503') {
        return {
          success: false,
          error: 'Cannot delete registration because official scores or results have already been tabulated.',
        };
      }
      return { success: false, error: error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      return { success: false, error: msg };
    } finally {
      const local = getLocalRegistrations().filter((r) => String(r.id) !== String(id));
      saveLocalRegistrations(local);
    }
  },

  /**
   * Fetches participants belonging to a specific church for drop-down population.
   */
  async getChurchParticipants(churchId: string | number): Promise<Participant[]> {
    const res = await participantService.getParticipants({
      churchId,
      page: 1,
      pageSize: 500,
    });
    return res.participants;
  },
};
