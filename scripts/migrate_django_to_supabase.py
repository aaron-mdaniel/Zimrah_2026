"""
ZIMRAH 2026 – Automated Django to Supabase PostgreSQL ETL & Migration Tool
ADR-001, ADR-003, ADR-005, ADR-006

Exports, transforms, and imports all Django database models into Supabase PostgreSQL
preserving UUID mappings, leading zeros on chest numbers, decimal precision, and audit history.
"""

import argparse
import json
import os
import sys
import uuid
from decimal import Decimal
from typing import Dict, Any, List

# Add parent directory to path so Django settings can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zimrah.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from apps.events.models import Edition, EventCategory, EventDivision, EventSection, Event
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.registrations.models import Registration, GroupRegistrationMember
from apps.results.models import EventResult, ResultEntry, ResultParticipant
from apps.championships.models import PointLedger
from apps.audit.models import AuditLog

NAMESPACE_ZIMRAH = uuid.UUID('d3cec8de-04c7-4c4d-88f5-3fb146019e48')

def gen_deterministic_uuid(model_name: str, pk: Any) -> str:
    """Generate deterministic UUID from legacy Django integer primary key."""
    return str(uuid.uuid5(NAMESPACE_ZIMRAH, f"{model_name}:{pk}"))


def extract_data() -> Dict[str, List[Dict[str, Any]]]:
    """Extract all records from Django models."""
    print("Extracting Django data...")
    data = {}

    # 1. Editions
    data['editions'] = [
        {
            'id': gen_deterministic_uuid('edition', e.id),
            'legacy_id': e.id,
            'year': e.year,
            'name': e.name,
            'theme': e.theme,
            'organizer': e.organizer,
            'start_date': str(e.start_date) if e.start_date else None,
            'end_date': str(e.end_date) if e.end_date else None,
            'is_active': e.is_active,
            'created_at': e.created_at.isoformat(),
            'updated_at': e.updated_at.isoformat(),
        }
        for e in Edition.objects.all()
    ]

    # 2. Churches
    data['churches'] = [
        {
            'id': gen_deterministic_uuid('church', c.id),
            'legacy_id': c.id,
            'code': c.code,
            'name': c.name,
            'name_malayalam': c.name_malayalam,
            'district': c.district,
            'vicar_name': c.vicar_name,
            'youth_leader_name': c.youth_leader_name,
            'contact_phone': c.contact_phone,
            'contact_email': c.contact_email,
            'is_active': c.is_active,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
        }
        for c in Church.objects.all()
    ]

    # 3. User Profiles
    User = get_user_model()
    data['user_profiles'] = [
        {
            'id': gen_deterministic_uuid('user', u.id),
            'legacy_id': u.id,
            'username': u.username,
            'full_name': u.get_full_name() or u.username,
            'role': getattr(u, 'role', 'RESULT_ADMIN'),
            'phone': getattr(u, 'phone', ''),
            'is_active': u.is_active,
            'created_at': u.date_joined.isoformat(),
            'updated_at': u.date_joined.isoformat(),
        }
        for u in User.objects.all()
    ]

    # 4. Categories, Divisions, Sections
    data['event_categories'] = [
        {
            'id': gen_deterministic_uuid('category', cat.id),
            'legacy_id': cat.id,
            'edition_id': gen_deterministic_uuid('edition', cat.edition_id),
            'name': cat.name,
            'name_malayalam': cat.name_malayalam,
            'date': str(cat.date) if cat.date else None,
            'venue': cat.venue,
        }
        for cat in EventCategory.objects.all()
    ]

    data['event_divisions'] = [
        {
            'id': gen_deterministic_uuid('division', div.id),
            'legacy_id': div.id,
            'edition_id': gen_deterministic_uuid('edition', div.edition_id),
            'division_number': div.division_number,
            'name': div.name,
            'name_malayalam': div.name_malayalam,
        }
        for div in EventDivision.objects.all()
    ]

    data['event_sections'] = [
        {
            'id': gen_deterministic_uuid('section', sec.id),
            'legacy_id': sec.id,
            'edition_id': gen_deterministic_uuid('edition', sec.edition_id),
            'code': sec.code,
            'name': sec.name,
            'name_malayalam': sec.name_malayalam,
        }
        for sec in EventSection.objects.all()
    ]

    # 5. Events
    data['events'] = [
        {
            'id': gen_deterministic_uuid('event', ev.id),
            'legacy_id': ev.id,
            'edition_id': gen_deterministic_uuid('edition', ev.edition_id),
            'code': ev.code,
            'name': ev.name,
            'name_malayalam': ev.name_malayalam,
            'category_id': gen_deterministic_uuid('category', ev.category_id),
            'division_id': gen_deterministic_uuid('division', ev.division_id) if ev.division_id else None,
            'section_id': gen_deterministic_uuid('section', ev.section_id) if ev.section_id else None,
            'event_type': ev.event_type,
            'duration_minutes': ev.duration_minutes,
            'duration_display': ev.duration_display,
            'min_participants': ev.min_participants,
            'max_participants': ev.max_participants,
            'max_entries_per_church': ev.max_entries_per_church,
            'contributes_to_individual': ev.contributes_to_individual,
            'contributes_to_church': ev.contributes_to_church,
            'created_at': ev.created_at.isoformat(),
            'updated_at': ev.updated_at.isoformat(),
        }
        for ev in Event.objects.all()
    ]

    # 6. Participants
    data['participants'] = [
        {
            'id': gen_deterministic_uuid('participant', p.id),
            'legacy_id': p.id,
            'edition_id': gen_deterministic_uuid('edition', p.edition_id),
            'chest_number': str(p.chest_number),  # Preserve leading zeros
            'name': p.name,
            'name_malayalam': p.name_malayalam,
            'gender': p.gender,
            'church_id': gen_deterministic_uuid('church', p.church_id),
            'age_category': p.age_category,
            'phone': p.phone,
            'created_at': p.created_at.isoformat(),
            'updated_at': p.updated_at.isoformat(),
        }
        for p in Participant.objects.all()
    ]

    # 7. Registrations & Group Members
    data['registrations'] = [
        {
            'id': gen_deterministic_uuid('registration', r.id),
            'legacy_id': r.id,
            'edition_id': gen_deterministic_uuid('edition', r.edition_id),
            'event_id': gen_deterministic_uuid('event', r.event_id),
            'church_id': gen_deterministic_uuid('church', r.church_id),
            'participant_id': gen_deterministic_uuid('participant', r.participant_id) if r.participant_id else None,
            'group_name': r.group_name,
            'chest_number': str(r.chest_number),
            'registered_at': r.registered_at.isoformat(),
        }
        for r in Registration.objects.all()
    ]

    data['group_registration_members'] = [
        {
            'id': gen_deterministic_uuid('group_member', gm.id),
            'legacy_id': gm.id,
            'registration_id': gen_deterministic_uuid('registration', gm.registration_id),
            'participant_id': gen_deterministic_uuid('participant', gm.participant_id),
            'role': gm.role,
        }
        for gm in GroupRegistrationMember.objects.all()
    ]

    # 8. Results
    data['event_results'] = [
        {
            'id': gen_deterministic_uuid('event_result', er.id),
            'legacy_id': er.id,
            'event_id': gen_deterministic_uuid('event', er.event_id),
            'status': er.status,
            'created_by': gen_deterministic_uuid('user', er.created_by_id) if er.created_by_id else None,
            'published_by': gen_deterministic_uuid('user', er.published_by_id) if er.published_by_id else None,
            'published_at': er.published_at.isoformat() if er.published_at else None,
            'notes': er.notes,
            'created_at': er.created_at.isoformat(),
            'updated_at': er.updated_at.isoformat(),
        }
        for er in EventResult.objects.all()
    ]

    data['result_entries'] = [
        {
            'id': gen_deterministic_uuid('result_entry', re.id),
            'legacy_id': re.id,
            'event_result_id': gen_deterministic_uuid('event_result', re.event_result_id),
            'position': re.position,
            'chest_number': str(re.chest_number),
            'participant_name': re.participant_name,
            'church_id': gen_deterministic_uuid('church', re.church_id),
            'participant_id': gen_deterministic_uuid('participant', re.participant_id) if re.participant_id else None,
            'grade': re.grade,
            'grade_points': str(re.grade_points),
            'position_points': str(re.position_points),
            'total_points': str(re.total_points),
            'remarks': re.remarks,
        }
        for re in ResultEntry.objects.all()
    ]

    data['result_participants'] = [
        {
            'id': gen_deterministic_uuid('result_participant', rp.id),
            'legacy_id': rp.id,
            'result_entry_id': gen_deterministic_uuid('result_entry', rp.result_entry_id),
            'participant_id': gen_deterministic_uuid('participant', rp.participant_id),
            'role': rp.role,
            'points_allocated': str(rp.points_allocated),
        }
        for rp in ResultParticipant.objects.all()
    ]

    # 9. Point Ledgers
    data['point_ledger'] = [
        {
            'id': gen_deterministic_uuid('point_ledger', pl.id),
            'legacy_id': pl.id,
            'edition_id': gen_deterministic_uuid('edition', pl.edition_id),
            'result_entry_id': gen_deterministic_uuid('result_entry', pl.result_entry_id),
            'event_id': gen_deterministic_uuid('event', pl.event_id),
            'church_id': gen_deterministic_uuid('church', pl.church_id),
            'participant_id': gen_deterministic_uuid('participant', pl.participant_id) if pl.participant_id else None,
            'target': pl.target,
            'points': str(pl.points),
            'is_active': pl.is_active,
            'created_at': pl.created_at.isoformat(),
        }
        for pl in PointLedger.objects.all()
    ]

    # 10. Audit Logs
    data['audit_logs'] = [
        {
            'id': gen_deterministic_uuid('audit_log', al.id),
            'legacy_id': al.id,
            'user_id': gen_deterministic_uuid('user', al.user_id) if al.user_id else None,
            'action': al.action,
            'model_name': al.model_name,
            'object_id': str(al.object_id),
            'object_repr': al.object_repr,
            'changes': json.dumps(al.changes) if isinstance(al.changes, (dict, list)) else al.changes,
            'ip_address': al.ip_address,
            'timestamp': al.timestamp.isoformat(),
        }
        for al in AuditLog.objects.all()
    ]

    return data


def generate_sql_inserts(data: Dict[str, List[Dict[str, Any]]], output_file: str):
    """Generate SQL INSERT statements for Supabase PostgreSQL."""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- ZIMRAH 2026 – Automated Data Migration Dump\n")
        f.write("-- Generated from Django database\n\n")
        f.write("BEGIN;\n\n")

        for table, rows in data.items():
            if not rows:
                continue
            f.write(f"-- Table: {table} ({len(rows)} records)\n")
            for r in rows:
                cols = list(r.keys())
                vals = []
                for c in cols:
                    v = r[c]
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, bool):
                        vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    else:
                        escaped = str(v).replace("'", "''")
                        vals.append(f"'{escaped}'")
                cols_str = ", ".join(cols)
                vals_str = ", ".join(vals)
                f.write(f"INSERT INTO public.{table} ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;\n")
            f.write("\n")

        f.write("COMMIT;\n")
    print(f"Generated SQL migration dump: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="ZIMRAH 2026 Django to Supabase Migration Tool")
    parser.add_argument("--export-json", type=str, default="data_export.json", help="Path to export JSON file")
    parser.add_argument("--export-sql", type=str, default="data_export.sql", help="Path to export SQL file")
    args = parser.parse_args()

    data = extract_data()
    total_records = sum(len(v) for v in data.values())
    print(f"Total extracted records across {len(data)} tables: {total_records}")

    for k, v in data.items():
        print(f"  {k}: {len(v)} records")

    with open(args.export_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"Exported JSON: {args.export_json}")

    generate_sql_inserts(data, args.export_sql)


if __name__ == '__main__':
    main()
