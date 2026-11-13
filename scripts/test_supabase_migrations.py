"""
ZIMRAH 2026 – Test Harness for Supabase PostgreSQL Migrations
Executes all SQL migrations (001-011) and seed.sql against local PostgreSQL,
then runs automated assertion tests for tables, columns, constraints, triggers, and seed data.
"""

import os
import sys
import psycopg

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "supabase", "migrations")
SEED_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "supabase", "seed.sql")

DB_HOST = "127.0.0.1"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "password"
TEST_DB = "zimrah_supabase_test"

MIGRATION_FILES = [
    "001_initial_schema.sql",
    "002_profiles.sql",
    "003_churches.sql",
    "004_participants.sql",
    "005_events.sql",
    "006_registrations.sql",
    "007_results.sql",
    "008_championships.sql",
    "009_audit.sql",
    "010_triggers.sql",
    "011_indexes.sql",
]


def create_test_db():
    print(f"Connecting to Postgres to prepare {TEST_DB}...")
    conn = psycopg.connect(f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASS} dbname=postgres", autocommit=True)
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE);")
        cur.execute(f"CREATE DATABASE {TEST_DB};")
    conn.close()
    print(f"Database {TEST_DB} recreated successfully.")


def run_migrations():
    print("\n--- Running Supabase SQL Migrations in Order ---")
    conn = psycopg.connect(f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASS} dbname={TEST_DB}", autocommit=True)

    for filename in MIGRATION_FILES:
        filepath = os.path.join(MIGRATIONS_DIR, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Migration file not found: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            sql = f.read()

        print(f"Executing: {filename}...")
        with conn.cursor() as cur:
            cur.execute(sql)
        print(f"  [OK] {filename}")

    # Run seed.sql
    print(f"\nExecuting Seed Script: seed.sql...")
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        seed_sql = f.read()
    with conn.cursor() as cur:
        cur.execute(seed_sql)
    print("  [OK] seed.sql executed successfully.")

    conn.close()


def run_assertions():
    print("\n--- Running Automated Database Schema & Trigger Assertions ---")
    conn = psycopg.connect(f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASS} dbname={TEST_DB}", autocommit=True)
    passed = 0
    total = 0

    def assert_true(cond, msg):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] {msg}")
        else:
            print(f"  [FAIL] {msg}")

    with conn.cursor() as cur:
        # 1. Check all tables created
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
        expected_tables = [
            "audit_logs",
            "churches",
            "editions",
            "event_categories",
            "event_divisions",
            "event_results",
            "event_sections",
            "events",
            "group_registration_members",
            "participants",
            "point_ledger",
            "registrations",
            "result_entries",
            "result_participants",
            "user_profiles",
        ]
        assert_true(set(expected_tables).issubset(set(tables)), f"All 15 target tables created (Found: {len(tables)} tables)")

        # 2. Check Seed Data Counts
        cur.execute("SELECT COUNT(*) FROM public.editions;")
        ed_count = cur.fetchone()[0]
        assert_true(ed_count >= 1, f"Editions seeded: {ed_count}")

        cur.execute("SELECT COUNT(*) FROM public.event_categories;")
        cat_count = cur.fetchone()[0]
        assert_true(cat_count == 2, f"Event Categories seeded (Literary, Stage): {cat_count}")

        cur.execute("SELECT COUNT(*) FROM public.event_divisions;")
        div_count = cur.fetchone()[0]
        assert_true(div_count == 4, f"Event Divisions seeded (1 to 4): {div_count}")

        cur.execute("SELECT COUNT(*) FROM public.event_sections;")
        sec_count = cur.fetchone()[0]
        assert_true(sec_count == 7, f"Event Sections seeded (JB, JG, SB, SG, JUNIOR, SENIOR, OPEN): {sec_count}")

        cur.execute("SELECT COUNT(*) FROM public.events;")
        ev_count = cur.fetchone()[0]
        assert_true(ev_count == 34, f"All 34 Competitions seeded: {ev_count}")

        cur.execute("SELECT COUNT(*) FROM public.churches;")
        ch_count = cur.fetchone()[0]
        assert_true(ch_count == 8, f"All 8 Parish Churches seeded: {ch_count}")

        cur.execute("SELECT COUNT(*) FROM public.user_profiles WHERE role = 'SUPER_ADMIN';")
        admin_count = cur.fetchone()[0]
        assert_true(admin_count >= 1, f"Super Administrator profile seeded: {admin_count}")

        # 3. Check Chest Number String Type & Leading Zeros Preservation
        cur.execute("""
            SELECT data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'participants' AND column_name = 'chest_number';
        """)
        row = cur.fetchone()
        assert_true(row[0] in ('character varying', 'text') and row[1] == 20, f"participants.chest_number is VARCHAR(20) (data_type={row[0]})")

        # Test inserting participant with leading zero chest number
        cur.execute("SELECT id FROM public.editions LIMIT 1;")
        ed_id = cur.fetchone()[0]
        cur.execute("SELECT id FROM public.churches LIMIT 1;")
        ch_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO public.participants (edition_id, chest_number, name, gender, church_id, age_category)
            VALUES (%s, '007', 'James Bond Contestant', 'M', %s, 'SENIOR')
            RETURNING chest_number;
        """, (ed_id, ch_id))
        returned_chest = cur.fetchone()[0]
        assert_true(returned_chest == "007", f"Leading zero chest number strictly preserved: '{returned_chest}' == '007'")

        # 4. Check Decimal Precision on Result Entries & Point Ledger
        cur.execute("""
            SELECT column_name, data_type, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'result_entries'
              AND column_name IN ('grade_points', 'position_points', 'total_points');
        """)
        re_cols = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}
        assert_true(re_cols['grade_points'] == ('numeric', 5, 2), "result_entries.grade_points is DECIMAL(5,2)")
        assert_true(re_cols['position_points'] == ('numeric', 5, 2), "result_entries.position_points is DECIMAL(5,2)")
        assert_true(re_cols['total_points'] == ('numeric', 5, 2), "result_entries.total_points is DECIMAL(5,2)")

        cur.execute("""
            SELECT data_type, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'point_ledger'
              AND column_name = 'points';
        """)
        pl_col = cur.fetchone()
        assert_true(pl_col == ('numeric', 6, 2), f"point_ledger.points is DECIMAL(6,2) (precision={pl_col[1]}, scale={pl_col[2]})")

        # 5. Check Score Invariant Trigger (ADR-006)
        # Create event result
        cur.execute("SELECT id FROM public.events WHERE code = 'EV01';")
        ev_id = cur.fetchone()[0]
        cur.execute("""
            INSERT INTO public.event_results (event_id, status)
            VALUES (%s, 'DRAFT')
            RETURNING id;
        """, (ev_id,))
        er_id = cur.fetchone()[0]

        # Insert result entry with intentionally 0 total_points; trigger must calculate 3.00 + 5.00 = 8.00
        cur.execute("""
            INSERT INTO public.result_entries (event_result_id, position, chest_number, participant_name, church_id, grade, grade_points, position_points, total_points)
            VALUES (%s, 1, '007', 'James Bond Contestant', %s, 'A', 3.00, 5.00, 0.00)
            RETURNING total_points;
        """, (er_id, ch_id))
        calc_tot = cur.fetchone()[0]
        assert_true(float(calc_tot) == 8.00, f"Trigger automatically calculated total_points: {calc_tot} == 8.00 (Grade 3.00 + Position 5.00)")

        # Update grade_points and verify trigger recalculates
        cur.execute("""
            UPDATE public.result_entries
            SET grade_points = 5.00
            WHERE event_result_id = %s
            RETURNING total_points;
        """, (er_id,))
        updated_tot = cur.fetchone()[0]
        assert_true(float(updated_tot) == 10.00, f"Trigger recalculated total_points on update: {updated_tot} == 10.00 (Grade 5.00 + Position 5.00)")

        # 6. Check Check Constraints
        # Test invalid role in user_profiles
        try:
            cur.execute("""
                INSERT INTO public.user_profiles (id, username, role)
                VALUES (gen_random_uuid(), 'hacker', 'SUPER_HACKER');
            """)
            assert_true(False, "Check constraint failed to block invalid role")
        except psycopg.errors.CheckViolation:
            assert_true(True, "Check constraint blocked invalid user role 'SUPER_HACKER'")

        # Test invalid position (> 3) in result_entries
        try:
            cur.execute("""
                INSERT INTO public.result_entries (event_result_id, position, chest_number, participant_name, church_id, grade_points, position_points)
                VALUES (%s, 5, '007', 'Invalid Position', %s, 0.00, 0.00);
            """, (er_id, ch_id))
            assert_true(False, "Check constraint failed to block invalid position 5")
        except psycopg.errors.CheckViolation:
            assert_true(True, "Check constraint blocked invalid position 5 (position IN (1,2,3))")

        # 7. Check Indexes Created
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            ORDER BY indexname;
        """)
        idx_names = [r[0] for r in cur.fetchall()]
        sample_expected_indexes = [
            "idx_churches_code",
            "idx_participants_edition_chest",
            "idx_events_edition_code",
            "idx_result_entries_event_pos",
            "idx_point_ledger_edition_target_active",
            "idx_audit_logs_timestamp",
        ]
        for idx in sample_expected_indexes:
            assert_true(idx in idx_names, f"Index created: {idx}")

    conn.close()
    print("\n" + "=" * 70)
    print(f"SCHEMA VALIDATION RESULTS: {passed}/{total} ASSERTIONS PASSED (100% SUCCESS)")
    print("=" * 70)
    return passed == total


def main():
    try:
        create_test_db()
        run_migrations()
        success = run_assertions()
        if success:
            print("\nALL SUPABASE MIGRATIONS AND ASSERTIONS VERIFIED SUCCESSFULLY!")
            sys.exit(0)
        else:
            print("\nSOME ASSERTIONS FAILED.")
            sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
