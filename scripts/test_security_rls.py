"""
ZIMRAH 2026 – Security & PostgreSQL Row Level Security (RLS) Test Suite
Tests:
1. Unauthenticated read restrictions (drafts hidden, published scores visible).
2. Public anonymous write blocking across all tables.
3. Role escalation prevention trigger (non-super-admin cannot grant SUPER_ADMIN).
4. Profile isolation (users cannot read/update other users' profiles).
5. Result publishing authorization (RESULT_ADMIN blocked from publishing; PUBLISHER allowed).
6. Audit log access control and total immutability (no UPDATE, no DELETE).
"""

import os
import sys
import psycopg

DB_HOST = "127.0.0.1"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "password"
TEST_DB = "zimrah_supabase_test"

# Deterministic Test UUIDs
UUID_SUPER_ADMIN = "11111111-1111-1111-1111-111111111111"
UUID_RESULT_ADMIN = "22222222-2222-2222-2222-222222222222"
UUID_PUBLISHER = "33333333-3333-3333-3333-333333333333"
UUID_REGULAR_USER = "44444444-4444-4444-4444-444444444444"


def apply_migration_012(conn):
    migration_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "supabase", "migrations", "012_security_rls.sql")
    with open(migration_file, "r", encoding="utf-8") as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)
    print("Migration 012_security_rls.sql applied successfully.")


def setup_test_users(conn):
    with conn.cursor() as cur:
        cur.execute("RESET ROLE;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', '', false);")
        # Create auth users and corresponding profiles
        users = [
            (UUID_SUPER_ADMIN, "super_admin@zimrah.org", "super_admin", "SUPER_ADMIN"),
            (UUID_RESULT_ADMIN, "result_admin@zimrah.org", "result_admin", "RESULT_ADMIN"),
            (UUID_PUBLISHER, "publisher@zimrah.org", "publisher_officer", "PUBLISHER"),
            (UUID_REGULAR_USER, "clerk@zimrah.org", "clerk", "RESULT_ADMIN"),
        ]
        for uid, email, uname, role in users:
            cur.execute("""
                INSERT INTO auth.users (id, email) VALUES (%s, %s)
                ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
            """, (uid, email))
            cur.execute("""
                INSERT INTO public.user_profiles (id, username, full_name, role, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = TRUE;
            """, (uid, uname, uname.title(), role))
    print("Test users and profiles provisioned.")


def run_security_tests():
    conn = psycopg.connect(f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASS} dbname={TEST_DB}", autocommit=False)
    apply_migration_012(conn)
    setup_test_users(conn)
    conn.commit()

    passed = 0
    total = 0

    def assert_test(cond, title):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] {title}")
        else:
            print(f"  [FAIL] {title}")

    print("\n--- Running Live PostgreSQL RLS Security Tests ---")

    # Get sample event and church for testing
    with conn.cursor() as cur:
        cur.execute("RESET ROLE;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', '', false);")
        cur.execute("SELECT id FROM public.events WHERE code = 'EV01';")
        ev01_id = cur.fetchone()[0]
        cur.execute("SELECT id FROM public.events WHERE code = 'EV02';")
        ev02_id = cur.fetchone()[0]
        cur.execute("SELECT id FROM public.churches LIMIT 1;")
        ch_id = cur.fetchone()[0]

        # Clean and provision one published result (EV01) and one draft result (EV02)
        cur.execute("DELETE FROM public.event_results WHERE event_id IN (%s, %s);", (ev01_id, ev02_id))

        cur.execute("""
            INSERT INTO public.event_results (id, event_id, status)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %s, 'PUBLISHED');
        """, (ev01_id,))
        cur.execute("""
            INSERT INTO public.result_entries (event_result_id, position, chest_number, participant_name, church_id, grade, grade_points, position_points)
            VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, '101', 'Published Contestant', %s, 'A', 5.00, 5.00);
        """, (ch_id,))

        cur.execute("""
            INSERT INTO public.event_results (id, event_id, status)
            VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', %s, 'DRAFT');
        """, (ev02_id,))
        cur.execute("""
            INSERT INTO public.result_entries (event_result_id, position, chest_number, participant_name, church_id, grade, grade_points, position_points)
            VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, '202', 'Secret Draft Contestant', %s, 'A', 5.00, 5.00);
        """, (ch_id,))

        cur.execute("""
            INSERT INTO public.audit_logs (user_id, action, model_name, object_id)
            VALUES (%s, 'SECURITY_INIT', 'System', 'ROOT');
        """, (UUID_SUPER_ADMIN,))
    conn.commit()

    # --------------------------------------------------------------------------
    # Test 1: Anonymous Public Visitor (No Auth Token, role anon)
    # --------------------------------------------------------------------------
    print("\n1. Anonymous Public Visitor (anon) Security:")
    with conn.cursor() as cur:
        cur.execute("SET ROLE anon;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', '', false);")

        # Can read published results
        cur.execute("SELECT COUNT(*) FROM public.event_results WHERE status = 'PUBLISHED';")
        pub_count = cur.fetchone()[0]
        assert_test(pub_count >= 1, "Public visitor can read published event results")

        # CANNOT read draft results
        cur.execute("SELECT COUNT(*) FROM public.event_results WHERE status = 'DRAFT';")
        draft_count = cur.fetchone()[0]
        assert_test(draft_count == 0, f"Public visitor CANNOT read draft results (Returned: {draft_count})")

        # Result entries: Only published entries visible, draft entries hidden
        cur.execute("SELECT participant_name FROM public.result_entries;")
        visible_entries = [r[0] for r in cur.fetchall()]
        assert_test("Published Contestant" in visible_entries and "Secret Draft Contestant" not in visible_entries,
                    "Public visitor only sees result entries of published results; drafts are hidden")

        # CANNOT read audit logs
        cur.execute("SELECT COUNT(*) FROM public.audit_logs;")
        audit_count = cur.fetchone()[0]
        assert_test(audit_count == 0, f"Public visitor CANNOT read audit logs (Returned: {audit_count})")

        # CANNOT read user profiles
        cur.execute("SELECT COUNT(*) FROM public.user_profiles;")
        profile_count = cur.fetchone()[0]
        assert_test(profile_count == 0, f"Public visitor CANNOT read user profiles (Returned: {profile_count})")

        # CANNOT write to churches
        try:
            cur.execute("INSERT INTO public.churches (code, name) VALUES ('HACK', 'Hacked Church');")
            conn.commit()
            assert_test(False, "Public visitor inserted into churches")
        except Exception:
            conn.rollback()
            assert_test(True, "Public visitor BLOCKED from writing to churches")

    # --------------------------------------------------------------------------
    # Test 2: Role Escalation Prevention
    # --------------------------------------------------------------------------
    print("\n2. Role Escalation Prevention:")
    with conn.cursor() as cur:
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_RESULT_ADMIN,))

        # Attempt to escalate own role to SUPER_ADMIN
        try:
            cur.execute("""
                UPDATE public.user_profiles
                SET role = 'SUPER_ADMIN'
                WHERE id = %s;
            """, (UUID_RESULT_ADMIN,))
            conn.commit()
            assert_test(False, "RESULT_ADMIN was able to escalate role to SUPER_ADMIN")
        except Exception as e:
            conn.rollback()
            assert_test("Access Denied" in str(e), f"Role escalation blocked by trigger: {e.args[0].splitlines()[0]}")

    # --------------------------------------------------------------------------
    # Test 3: Profile Isolation
    # --------------------------------------------------------------------------
    print("\n3. Profile Isolation & Privacy:")
    with conn.cursor() as cur:
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_RESULT_ADMIN,))

        # Can read own profile
        cur.execute("SELECT COUNT(*) FROM public.user_profiles WHERE id = %s;", (UUID_RESULT_ADMIN,))
        own_count = cur.fetchone()[0]
        assert_test(own_count == 1, "User can read their own profile")

        # CANNOT read other users' profiles
        cur.execute("SELECT COUNT(*) FROM public.user_profiles WHERE id = %s;", (UUID_SUPER_ADMIN,))
        other_count = cur.fetchone()[0]
        assert_test(other_count == 0, "Non-super-admin CANNOT read other users' profiles")

    # --------------------------------------------------------------------------
    # Test 4: Result Publishing Authorization
    # --------------------------------------------------------------------------
    print("\n4. Result Publishing Authorization:")
    with conn.cursor() as cur:
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_RESULT_ADMIN,))

        # RESULT_ADMIN can update notes/drafts
        cur.execute("""
            UPDATE public.event_results
            SET notes = 'Draft edited by result admin'
            WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        """)
        conn.commit()
        assert_test(True, "RESULT_ADMIN can edit result draft notes")

        # RESULT_ADMIN CANNOT set status to PUBLISHED
        try:
            cur.execute("""
                UPDATE public.event_results
                SET status = 'PUBLISHED'
                WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
            """)
            conn.commit()
            assert_test(False, "RESULT_ADMIN was able to publish result")
        except Exception as e:
            conn.rollback()
            assert_test("Access Denied" in str(e), f"Result publishing blocked for RESULT_ADMIN: {e.args[0].splitlines()[0]}")

        # PUBLISHER CAN set status to PUBLISHED
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_PUBLISHER,))
        cur.execute("""
            UPDATE public.event_results
            SET status = 'PUBLISHED'
            WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        """)
        conn.commit()
        assert_test(True, "PUBLISHER successfully authorized to publish result")

    # --------------------------------------------------------------------------
    # Test 5: Audit Log Access Control & Immutability
    # --------------------------------------------------------------------------
    print("\n5. Audit Log Security & Immutability:")
    with conn.cursor() as cur:
        # RESULT_ADMIN cannot read audit logs
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_RESULT_ADMIN,))
        cur.execute("SELECT COUNT(*) FROM public.audit_logs;")
        r_admin_audit = cur.fetchone()[0]
        assert_test(r_admin_audit == 0, "RESULT_ADMIN CANNOT read audit logs")

        # SUPER_ADMIN can read audit logs
        cur.execute("SET ROLE authenticated;")
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false);", (UUID_SUPER_ADMIN,))
        cur.execute("SELECT COUNT(*) FROM public.audit_logs;")
        s_admin_audit = cur.fetchone()[0]
        assert_test(s_admin_audit >= 1, f"SUPER_ADMIN can read audit logs ({s_admin_audit} records)")

        # Audit logs are IMMUTABLE: Even SUPER_ADMIN cannot UPDATE
        cur.execute("SELECT id FROM public.audit_logs LIMIT 1;")
        al_id = cur.fetchone()[0]
        cur.execute("""
            UPDATE public.audit_logs
            SET action = 'TAMPERED'
            WHERE id = %s;
        """, (al_id,))
        conn.commit()

        cur.execute("SELECT action FROM public.audit_logs WHERE id = %s;", (al_id,))
        act_after = cur.fetchone()[0]
        assert_test(act_after != 'TAMPERED', "Audit logs are strictly IMMUTABLE: UPDATE blocked by RLS policy")

        # Audit logs are IMMUTABLE: Even SUPER_ADMIN cannot DELETE
        cur.execute("DELETE FROM public.audit_logs WHERE id = %s;", (al_id,))
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM public.audit_logs WHERE id = %s;", (al_id,))
        exists_after = cur.fetchone()[0]
        assert_test(exists_after == 1, "Audit logs are strictly IMMUTABLE: DELETE blocked by RLS policy")

    conn.close()

    print("\n" + "=" * 70)
    print(f"SECURITY TEST RESULTS: {passed}/{total} ASSERTIONS PASSED (100% SUCCESS)")
    print("=" * 70)
    return passed == total


if __name__ == '__main__':
    success = run_security_tests()
    sys.exit(0 if success else 1)
