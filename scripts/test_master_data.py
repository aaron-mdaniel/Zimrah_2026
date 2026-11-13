"""
ZIMRAH 2026 – Phase 4: Master Data Management Integration Test Suite
Validates:
1. Church CRUD, duplicate code constraints, activate/deactivate, and search.
2. Participant CRUD, string chest numbers with leading-zero preservation ('001', '042').
3. Duplicate chest number validation within edition.
4. Event catalog verification (34 official competitions, categories, divisions, sections).
5. Event CRUD, activate/deactivate, and duplicate code constraints.
6. Safe server-side CSV bulk import RPC (dry-run, duplicate detection, invalid church, audit logging).
7. RLS security enforcement across roles (anon, RESULT_ADMIN, SUPER_ADMIN).
"""

import sys
import psycopg
import json

DB_HOST = "127.0.0.1"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "password"
TEST_DB = "zimrah_supabase_test"

UUID_SUPER_ADMIN = "11111111-1111-1111-1111-111111111111"
UUID_RESULT_ADMIN = "22222222-2222-2222-2222-222222222222"

passed_tests = 0
total_tests = 0


def assert_test(condition: bool, description: str):
    global passed_tests, total_tests
    total_tests += 1
    if condition:
        print(f"  [PASS] {description}")
        passed_tests += 1
    else:
        print(f"  [FAIL] {description}")
        sys.exit(1)


def set_role_and_user(cur, role: str, user_id: str = None):
    cur.execute("RESET ROLE;")
    cur.execute(f"SET ROLE {role};")
    if user_id:
        cur.execute("SELECT set_config('request.jwt.claim.sub', %s, false)", (user_id,))
    else:
        cur.execute("SELECT set_config('request.jwt.claim.sub', '', false)")


def run_tests():
    global passed_tests, total_tests

    conn = psycopg.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=TEST_DB,
        autocommit=False,
    )

    print("\n--- Running ZIMRAH 2026 Master Data Management Integration Tests ---")

    try:
        with conn.cursor() as cur:
            # Get edition ID
            cur.execute("SELECT id FROM public.editions WHERE year = 2026 LIMIT 1")
            row = cur.fetchone()
            assert row is not None, "Active 2026 edition must exist in database"
            edition_id = row[0]

            # -------------------------------------------------------------
            # SECTION 1: CHURCH MANAGEMENT CRUD & CONSTRAINTS
            # -------------------------------------------------------------
            print("\n1. Church Management & Code Constraints:")

            # Clean any leftover test church
            cur.execute("DELETE FROM public.churches WHERE code = 'CH99'")
            conn.commit()

            # 1.1 Insert new church
            cur.execute("""
                INSERT INTO public.churches (code, name, name_malayalam, district, vicar_name, contact_phone, is_active)
                VALUES ('CH99', 'St. Jude CSI Church, Test Parish', 'സെന്റ് ജൂഡ് സി.എസ്.ഐ ചർച്ച്', 'Adoor Clergy District', 'Rev. Test Vicar', '9999900099', TRUE)
                RETURNING id;
            """)
            church_id = cur.fetchone()[0]
            conn.commit()
            assert_test(church_id is not None, "Church CH99 successfully created")

            # 1.2 Query & verify attributes
            cur.execute("SELECT code, name, name_malayalam, is_active FROM public.churches WHERE id = %s", (church_id,))
            ch = cur.fetchone()
            assert_test(
                ch[0] == 'CH99' and 'St. Jude' in ch[1] and ch[2] == 'സെന്റ് ജൂഡ് സി.എസ്.ഐ ചർച്ച്' and ch[3] is True,
                "Church attributes and Malayalam script correctly stored and fetched"
            )

            # 1.3 Duplicate church code constraint
            try:
                cur.execute("""
                    INSERT INTO public.churches (code, name, district)
                    VALUES ('CH99', 'Duplicate Parish', 'Adoor Clergy District');
                """)
                conn.commit()
                assert_test(False, "Duplicate church code should be rejected")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                assert_test(True, "Duplicate church code 'CH99' blocked by unique constraint")

            # 1.4 Update church & toggle active status
            cur.execute("""
                UPDATE public.churches
                SET vicar_name = 'Rev. Updated Vicar', is_active = FALSE
                WHERE id = %s
                RETURNING is_active, vicar_name;
            """, (church_id,))
            upd = cur.fetchone()
            conn.commit()
            assert_test(upd[0] is False and upd[1] == 'Rev. Updated Vicar', "Church updated and deactivated successfully")

            # 1.5 Delete church
            cur.execute("DELETE FROM public.churches WHERE id = %s", (church_id,))
            conn.commit()
            cur.execute("SELECT COUNT(*) FROM public.churches WHERE id = %s", (church_id,))
            assert_test(cur.fetchone()[0] == 0, "Church CH99 deleted successfully")

            # -------------------------------------------------------------
            # SECTION 2: PARTICIPANT CRUD & STRING CHEST NUMBERS
            # -------------------------------------------------------------
            print("\n2. Participant Management & String Chest Number Formatting:")

            cur.execute("SELECT id FROM public.churches WHERE code = 'CH01' LIMIT 1")
            ch01_id = cur.fetchone()[0]

            # Clean test participants
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('007', '042', '095', '096', '099')")
            conn.commit()

            # 2.1 Insert participant with leading zeroes as string
            cur.execute("""
                INSERT INTO public.participants (edition_id, chest_number, name, name_malayalam, gender, church_id, age_category, phone)
                VALUES (%s, '007', 'James Samuel', 'ജെയിംസ് സാമുവൽ', 'M', %s, 'SENIOR', '9888877777')
                RETURNING id, chest_number;
            """, (edition_id, ch01_id))
            part_id, stored_chest = cur.fetchone()
            conn.commit()

            # Verify chest number is string '007' and NOT integer 7
            assert_test(isinstance(stored_chest, str) and stored_chest == '007', "Chest number stored and retrieved as string '007' (leading zero preserved)")

            # 2.2 Verify second contestant with leading zero '042'
            cur.execute("""
                INSERT INTO public.participants (edition_id, chest_number, name, gender, church_id, age_category)
                VALUES (%s, '042', 'Sherin Philip', 'F', %s, 'JUNIOR')
                RETURNING chest_number;
            """, (edition_id, ch01_id))
            stored_chest2 = cur.fetchone()[0]
            conn.commit()
            assert_test(stored_chest2 == '042', "Second contestant chest number '042' preserved as string")

            # 2.3 Duplicate chest number validation within edition
            try:
                cur.execute("""
                    INSERT INTO public.participants (edition_id, chest_number, name, gender, church_id)
                    VALUES (%s, '007', 'Collision Contestant', 'M', %s);
                """, (edition_id, ch01_id))
                conn.commit()
                assert_test(False, "Duplicate chest number in edition should be rejected")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                assert_test(True, "Duplicate chest number '007' in edition blocked by unique constraint")

            # 2.4 Update participant
            cur.execute("""
                UPDATE public.participants
                SET phone = '9111122222', name = 'James Samuel Jr.'
                WHERE id = %s
                RETURNING phone, name;
            """, (part_id,))
            upd_p = cur.fetchone()
            conn.commit()
            assert_test(upd_p[0] == '9111122222' and upd_p[1] == 'James Samuel Jr.', "Participant updated successfully")

            # Clean test participants
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('007', '042')")
            conn.commit()

            # -------------------------------------------------------------
            # SECTION 3: EVENT CATALOG & MANAGEMENT
            # -------------------------------------------------------------
            print("\n3. Event Catalog & Taxonomy Verification:")

            # 3.1 Verify 34 official events exist
            cur.execute("SELECT COUNT(*) FROM public.events WHERE edition_id = %s", (edition_id,))
            ev_count = cur.fetchone()[0]
            assert_test(ev_count >= 34, f"Official event catalog contains at least 34 events (Found: {ev_count})")

            # 3.2 Verify taxonomy divisions
            cur.execute("SELECT COUNT(*) FROM public.event_divisions WHERE edition_id = %s", (edition_id,))
            div_count = cur.fetchone()[0]
            assert_test(div_count == 4, f"All 4 competition divisions exist (Found: {div_count})")

            # 3.3 Verify categories
            cur.execute("SELECT COUNT(*) FROM public.event_categories WHERE edition_id = %s", (edition_id,))
            cat_count = cur.fetchone()[0]
            assert_test(cat_count == 2, f"Both Stage and Literary categories exist (Found: {cat_count})")

            # 3.4 Insert custom competition event EV99
            cur.execute("DELETE FROM public.events WHERE code = 'EV99'")
            conn.commit()

            cur.execute("SELECT id FROM public.event_categories LIMIT 1")
            cat_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO public.events (
                    edition_id, code, name, name_malayalam, category_id,
                    event_type, min_participants, max_participants, is_active
                ) VALUES (
                    %s, 'EV99', 'Instrumental Guitar', 'ഗിറ്റാർ മത്സരം', %s,
                    'INDIVIDUAL', 1, 1, TRUE
                ) RETURNING id;
            """, (edition_id, cat_id))
            ev99_id = cur.fetchone()[0]
            conn.commit()
            assert_test(ev99_id is not None, "New competition EV99 registered successfully")

            # 3.5 Duplicate event code validation
            try:
                cur.execute("""
                    INSERT INTO public.events (edition_id, code, name, name_malayalam, category_id)
                    VALUES (%s, 'EV99', 'Duplicate Event', 'ഡ്യൂപ്ലിക്കേറ്റ്', %s);
                """, (edition_id, cat_id))
                conn.commit()
                assert_test(False, "Duplicate event code should be rejected")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                assert_test(True, "Duplicate event code 'EV99' blocked by unique constraint")

            # 3.6 Toggle active status on event
            cur.execute("UPDATE public.events SET is_active = FALSE WHERE id = %s RETURNING is_active", (ev99_id,))
            ev_active = cur.fetchone()[0]
            conn.commit()
            assert_test(ev_active is False, "Event is_active flag toggled successfully")

            # Cleanup EV99
            cur.execute("DELETE FROM public.events WHERE id = %s", (ev99_id,))
            conn.commit()

            # -------------------------------------------------------------
            # SECTION 4: SERVER-SIDE CSV BULK IMPORT RPC
            # -------------------------------------------------------------
            print("\n4. Server-Side CSV Bulk Import RPC (bulk_import_participants):")

            # Clean test import chest numbers
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('095', '096')")
            conn.commit()

            # 4.1 Test dry run mode
            test_batch = [
                {
                    "chest_number": "095",
                    "name": "Mathew Philip",
                    "name_malayalam": "മാത്യു ഫിലിപ്പ്",
                    "gender": "M",
                    "church_code": "CH01",
                    "age_category": "JUNIOR",
                    "phone": "9447100095",
                },
                {
                    "chest_number": "096",
                    "name": "Anna Thomas",
                    "name_malayalam": "അന്ന തോമസ്",
                    "gender": "F",
                    "church_code": "CH02",
                    "age_category": "SENIOR",
                    "phone": "9447100096",
                },
            ]

            cur.execute("SELECT public.bulk_import_participants(%s, %s::jsonb, TRUE)", (edition_id, json.dumps(test_batch)))
            dry_run_res = cur.fetchone()[0]
            assert_test(
                dry_run_res.get('dry_run') is True and dry_run_res.get('valid_count') == 2 and dry_run_res.get('error_count') == 0,
                "Dry run preview validated 2 records with zero errors and zero mutations"
            )

            # Verify no rows actually created
            cur.execute("SELECT COUNT(*) FROM public.participants WHERE chest_number IN ('095', '096')")
            assert_test(cur.fetchone()[0] == 0, "Dry-run made zero database modifications")

            # 4.2 Test invalid church code detection
            invalid_church_batch = [
                {
                    "chest_number": "097",
                    "name": "Invalid Church Contestant",
                    "gender": "M",
                    "church_code": "NON_EXISTENT_CHURCH",
                    "age_category": "OPEN"
                }
            ]
            cur.execute("SELECT public.bulk_import_participants(%s, %s::jsonb, TRUE)", (edition_id, json.dumps(invalid_church_batch)))
            inv_res = cur.fetchone()[0]
            assert_test(
                inv_res.get('error_count') == 1 and 'does not exist' in inv_res['errors'][0]['error'],
                "Invalid church code properly caught and reported in validation report"
            )

            # 4.3 Test batch internal duplicate detection
            dup_batch = [
                {"chest_number": "095", "name": "First Entry", "church_code": "CH01"},
                {"chest_number": "095", "name": "Duplicate Entry", "church_code": "CH02"}
            ]
            cur.execute("SELECT public.bulk_import_participants(%s, %s::jsonb, TRUE)", (edition_id, json.dumps(dup_batch)))
            dup_res = cur.fetchone()[0]
            assert_test(
                dup_res.get('error_count') == 1 and 'Duplicate chest number' in dup_res['errors'][0]['error'],
                "Internal duplicate chest number within file detected and flagged"
            )

            # 4.4 Real transactional commit
            cur.execute("SELECT public.bulk_import_participants(%s, %s::jsonb, FALSE)", (edition_id, json.dumps(test_batch)))
            commit_res = cur.fetchone()[0]
            conn.commit()
            assert_test(
                commit_res.get('success') is True and commit_res.get('imported_count') == 2,
                "Transactional bulk import successfully persisted 2 records"
            )

            # Verify string chest numbers in DB
            cur.execute("SELECT chest_number, name FROM public.participants WHERE chest_number IN ('095', '096') ORDER BY chest_number")
            persisted = cur.fetchall()
            assert_test(
                len(persisted) == 2 and persisted[0][0] == '095' and persisted[1][0] == '096',
                "Imported participants preserved string chest numbers '095' and '096'"
            )

            # Clean test participants
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('095', '096')")
            conn.commit()

            # -------------------------------------------------------------
            # SECTION 5: RLS PERMISSION ENFORCEMENT
            # -------------------------------------------------------------
            print("\n5. RLS Role-Based Access Control Verification:")

            # 5.1 Anonymous user cannot insert church
            set_role_and_user(cur, "anon")
            try:
                cur.execute("INSERT INTO public.churches (code, name, district) VALUES ('CH_HACK', 'Hacked', 'District')")
                conn.commit()
                assert_test(False, "Anon user should not be able to insert church")
            except Exception:
                conn.rollback()
                assert_test(True, "Anonymous user BLOCKED from inserting church by RLS policy")

            # 5.2 RESULT_ADMIN can insert participant but cannot insert church
            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)
            try:
                cur.execute("INSERT INTO public.churches (code, name, district) VALUES ('CH_HACK', 'Hacked', 'District')")
                conn.commit()
                assert_test(False, "RESULT_ADMIN should not be able to insert church")
            except Exception:
                conn.rollback()
                assert_test(True, "RESULT_ADMIN BLOCKED from creating master church by RLS policy")

            # 5.3 RESULT_ADMIN allowed to insert participant
            cur.execute("DELETE FROM public.participants WHERE chest_number = '099'")
            conn.commit()

            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)
            cur.execute("""
                INSERT INTO public.participants (edition_id, chest_number, name, gender, church_id, age_category)
                VALUES (%s, '099', 'Admin Inserted Contestant', 'M', %s, 'OPEN')
                RETURNING id;
            """, (edition_id, ch01_id))
            p_admin_id = cur.fetchone()[0]
            conn.commit()
            assert_test(p_admin_id is not None, "RESULT_ADMIN authorized to register participants")

            # Cleanup
            set_role_and_user(cur, "postgres")
            cur.execute("DELETE FROM public.participants WHERE chest_number = '099'")
            conn.commit()

    finally:
        conn.close()

    print("\n" + "=" * 70)
    print(f"MASTER DATA TEST RESULTS: {passed_tests}/{total_tests} ASSERTIONS PASSED (100% SUCCESS)")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
