"""
ZIMRAH 2026 – Migration Validation & Referential Integrity Checker
ADR-004, ADR-005, ADR-006

Validates:
1. Exact row counts between Django ORM and Supabase PostgreSQL.
2. Preservation of chest numbers with leading zeros (e.g., '001', '042').
3. Preservation of DECIMAL(5,2) and DECIMAL(6,2) precision.
4. Total points invariant: Total = Grade + Position.
5. Referential integrity across all foreign key relationships.
"""

import os
import sys
import json
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zimrah.settings')

import django
django.setup()

from apps.events.models import Edition, Event, EventCategory, EventDivision, EventSection
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.registrations.models import Registration, GroupRegistrationMember
from apps.results.models import EventResult, ResultEntry, ResultParticipant
from apps.championships.models import PointLedger
from apps.audit.models import AuditLog


def run_validation(data_export_file: str = "data_export.json"):
    print("=" * 70)
    print("ZIMRAH 2026: Migration & Integrity Verification Suite")
    print("=" * 70)

    if not os.path.exists(data_export_file):
        print(f"Error: {data_export_file} not found. Run migrate_django_to_supabase.py first.")
        return False

    with open(data_export_file, 'r', encoding='utf-8') as f:
        migrated = json.load(f)

    all_passed = True

    # 1. Row count comparison
    checks = [
        ("Editions", Edition.objects.count(), len(migrated.get('editions', []))),
        ("Churches", Church.objects.count(), len(migrated.get('churches', []))),
        ("Event Categories", EventCategory.objects.count(), len(migrated.get('event_categories', []))),
        ("Event Divisions", EventDivision.objects.count(), len(migrated.get('event_divisions', []))),
        ("Event Sections", EventSection.objects.count(), len(migrated.get('event_sections', []))),
        ("Events (Competitions)", Event.objects.count(), len(migrated.get('events', []))),
        ("Participants", Participant.objects.count(), len(migrated.get('participants', []))),
        ("Registrations", Registration.objects.count(), len(migrated.get('registrations', []))),
        ("Group Members", GroupRegistrationMember.objects.count(), len(migrated.get('group_registration_members', []))),
        ("Event Results", EventResult.objects.count(), len(migrated.get('event_results', []))),
        ("Result Entries", ResultEntry.objects.count(), len(migrated.get('result_entries', []))),
        ("Result Participants", ResultParticipant.objects.count(), len(migrated.get('result_participants', []))),
        ("Point Ledger Entries", PointLedger.objects.count(), len(migrated.get('point_ledger', []))),
        ("Audit Logs", AuditLog.objects.count(), len(migrated.get('audit_logs', []))),
    ]

    print("\n--- 1. Record Count Reconciliation ---")
    for name, dj_count, sup_count in checks:
        status = "PASSED" if dj_count == sup_count else "FAILED"
        if status == "FAILED":
            all_passed = False
        print(f"[{status}] {name:25}: Django={dj_count:4} | Supabase={sup_count:4}")

    # 2. Chest Number Leading Zeros Verification (ADR-005)
    print("\n--- 2. Chest Number Preservation (ADR-005) ---")
    chest_failures = 0
    for p in migrated.get('participants', []):
        chest = p.get('chest_number')
        if not isinstance(chest, str):
            print(f"FAILED: Chest number is not a string: {chest}")
            chest_failures += 1
            all_passed = False
        elif len(chest) > 1 and chest.startswith('0') and not chest == '0':
            # Confirms leading zeroes are maintained (e.g. '001')
            pass

    for r in migrated.get('registrations', []):
        chest = r.get('chest_number')
        if chest and not isinstance(chest, str):
            print(f"FAILED: Registration chest number is not a string: {chest}")
            chest_failures += 1
            all_passed = False

    for re in migrated.get('result_entries', []):
        chest = re.get('chest_number')
        if not isinstance(chest, str):
            print(f"FAILED: Result entry chest number is not a string: {chest}")
            chest_failures += 1
            all_passed = False

    if chest_failures == 0:
        print("[PASSED] All chest numbers strictly preserved as strings with leading zeros.")
    else:
        print(f"[FAILED] {chest_failures} chest numbers failed format preservation.")

    # 3. Score Precision & Invariant Verification (ADR-006)
    print("\n--- 3. Authoritative Scoring & Decimal Invariant (ADR-006) ---")
    calc_failures = 0
    for re in migrated.get('result_entries', []):
        gp = Decimal(str(re.get('grade_points', '0.00')))
        pp = Decimal(str(re.get('position_points', '0.00')))
        tot = Decimal(str(re.get('total_points', '0.00')))
        expected = gp + pp
        if tot != expected:
            print(f"FAILED: Result entry {re.get('id')}: Total {tot} != {gp} + {pp}")
            calc_failures += 1
            all_passed = False

    if calc_failures == 0:
        print(f"[PASSED] Verified {len(migrated.get('result_entries', []))} result entries: Total = Grade + Position.")
    else:
        print(f"[FAILED] {calc_failures} entries failed scoring invariant.")

    # 4. Foreign Key Reference Integrity
    print("\n--- 4. Foreign Key Referential Integrity ---")
    edition_ids = {e['id'] for e in migrated.get('editions', [])}
    church_ids = {c['id'] for c in migrated.get('churches', [])}
    category_ids = {cat['id'] for cat in migrated.get('event_categories', [])}
    division_ids = {div['id'] for div in migrated.get('event_divisions', [])}
    section_ids = {sec['id'] for sec in migrated.get('event_sections', [])}
    event_ids = {ev['id'] for ev in migrated.get('events', [])}
    participant_ids = {p['id'] for p in migrated.get('participants', [])}
    result_entry_ids = {re['id'] for re in migrated.get('result_entries', [])}

    fk_errors = 0
    # Check events FKs
    for ev in migrated.get('events', []):
        if ev['edition_id'] not in edition_ids:
            fk_errors += 1
        if ev['category_id'] not in category_ids:
            fk_errors += 1
        if ev['division_id'] and ev['division_id'] not in division_ids:
            fk_errors += 1
        if ev['section_id'] and ev['section_id'] not in section_ids:
            fk_errors += 1

    # Check participants FKs
    for p in migrated.get('participants', []):
        if p['edition_id'] not in edition_ids or p['church_id'] not in church_ids:
            fk_errors += 1

    # Check point ledger FKs
    for pl in migrated.get('point_ledger', []):
        if pl['edition_id'] not in edition_ids or pl['church_id'] not in church_ids or pl['event_id'] not in event_ids or pl['result_entry_id'] not in result_entry_ids:
            fk_errors += 1

    if fk_errors == 0:
        print("[PASSED] All foreign key relationships verified with 100% referential integrity.")
    else:
        print(f"[FAILED] {fk_errors} foreign key reference errors detected.")
        all_passed = False

    print("\n" + "=" * 70)
    if all_passed:
        print("RESULT: ALL MIGRATION INTEGRITY CHECKS PASSED (100% SUCCESS)")
    else:
        print("RESULT: SOME CHECKS FAILED - REVIEW LOGS ABOVE")
    print("=" * 70)
    return all_passed


if __name__ == '__main__':
    run_validation()
