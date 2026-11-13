export type UserRole = 'SUPER_ADMIN' | 'RESULT_ADMIN' | 'PUBLISHER';

export interface UserProfile {
  id: string;
  username: string;
  full_name?: string;
  email?: string;
  role: UserRole;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Church {
  id: number | string;
  code: string;
  name: string;
  name_malayalam?: string;
  district: string;
  vicar_name?: string;
  youth_leader_name?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Edition {
  id: number | string;
  year: number;
  name: string;
  theme?: string;
  organizer?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface EventCategory {
  id: number | string;
  edition_id: number | string;
  name: string;
  name_malayalam?: string;
  date?: string;
  venue?: string;
}

export interface EventDivision {
  id: number | string;
  edition_id: number | string;
  division_number: number;
  name: string;
  name_malayalam?: string;
}

export interface EventSection {
  id: number | string;
  edition_id: number | string;
  code: string;
  name: string;
  name_malayalam?: string;
}

export type EventType = 'INDIVIDUAL' | 'GROUP';

export interface CompetitionEvent {
  id: number | string;
  edition_id: number | string;
  code: string;
  name: string;
  name_malayalam?: string;
  category_id: number | string;
  division_id?: number | string;
  section_id?: number | string;
  event_type: EventType;
  duration_minutes?: number;
  duration_display?: string;
  min_participants: number;
  max_participants: number;
  max_entries_per_church: number;
  contributes_to_individual: boolean;
  contributes_to_church: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  category?: EventCategory;
  division?: EventDivision;
  section?: EventSection;
}

export type Gender = 'M' | 'F';
export type AgeCategory = 'JUNIOR' | 'SENIOR' | 'OPEN';

export interface Participant {
  id: number | string;
  edition_id: number | string;
  chest_number: string; // Strictly string to preserve leading zeros
  name: string;
  name_malayalam?: string;
  gender: Gender;
  church_id: number | string;
  age_category: AgeCategory;
  phone?: string;
  church?: Church;
  created_at?: string;
}

export interface Registration {
  id: number | string;
  edition_id: number | string;
  event_id: number | string;
  church_id: number | string;
  participant_id?: number | string;
  group_name?: string;
  chest_number: string;
  registered_at?: string;
  event?: CompetitionEvent;
  church?: Church;
  participant?: Participant;
  members?: GroupRegistrationMember[];
}

export interface GroupRegistrationMember {
  id: number | string;
  registration_id: number | string;
  participant_id: number | string;
  role?: string;
  participant?: Participant;
}

export type ResultStatus = 'DRAFT' | 'VERIFIED' | 'PUBLISHED';
export type GradeType = 'A' | 'B' | 'C' | '';
export type PositionType = 1 | 2 | 3 | null;

export interface ResultEntry {
  id: number | string;
  event_result_id?: number | string;
  position: PositionType;
  chest_number: string;
  participant_name: string;
  church_id: number | string;
  participant_id?: number | string;
  grade: GradeType;
  grade_points: string | number;
  position_points: string | number;
  total_points: string | number; // Server-side calculated
  remarks?: string;
  church?: Church;
  participant?: Participant;
}

export interface EventResult {
  id: number | string;
  event_id: number | string;
  status: ResultStatus;
  notes?: string;
  published_at?: string;
  published_by?: string;
  created_at?: string;
  updated_at?: string;
  event?: CompetitionEvent;
  entries?: ResultEntry[];
}

export interface ChurchStanding {
  rank: number;
  is_tied: boolean;
  church_id: number | string;
  church_name: string;
  church_code: string;
  church_location?: string;
  total_points: number;
  first_places: number;
  second_places: number;
  third_places: number;
  grade_a_count: number;
  grade_b_count: number;
  grade_c_count: number;
  events_count: number;
}

export interface IndividualStanding {
  rank: number;
  is_tied: boolean;
  participant_id: number | string;
  participant_name: string;
  chest_number: string;
  category: AgeCategory;
  category_display?: string;
  gender: Gender;
  church_id: number | string;
  church_name: string;
  church_code: string;
  total_points: number;
  first_places: number;
  second_places: number;
  third_places: number;
  grade_a_count: number;
  grade_b_count: number;
  grade_c_count: number;
  events_count: number;
}

export interface ResultEntryInput {
  chest_number: string;
  position: PositionType;
  grade: GradeType;
  church_id?: number | string;
  participant_id?: number | string;
  remarks?: string;
  member_ids?: (number | string)[];
}

export interface ResultDraftInput {
  event_id: number | string;
  notes?: string;
  entries: ResultEntryInput[];
}

export interface LiveSummary {
  edition_name?: string;
  total_events: number;
  completed_events?: number;
  remaining_events?: number;
  published_results: number;
  pending_results?: number;
  completion_pct?: number;
  total_churches?: number;
  total_participants?: number;
  last_updated?: string;
  top_churches?: ChurchStanding[];
  top_individuals?: IndividualStanding[];
  latest_results?: {
    code: string;
    name: string;
    name_malayalam?: string;
    published_at: string;
    winner: string;
  }[];
}

export interface AuditLog {
  id: number | string;
  user_id?: string;
  user_name?: string;
  action: string;
  model_name: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, unknown>;
  ip_address?: string;
  timestamp: string;
}
