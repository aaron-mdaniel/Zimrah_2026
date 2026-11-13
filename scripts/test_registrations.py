"""
ZIMRAH 2026 – Phase 5: Registration Management Integration Test Suite
Validates:
1. Individual registration creation via RPC with string chest numbers ('001', leading zeros).
2. Individual duplicate registration prevention (unique index idx_unique_event_participant).
3. Event-level unique chest number constraint (idx_unique_event_chest).
4. Church affiliation mismatch validation.
5. Event type validation (cannot register individual in group event and vice-versa).
6. Church entry quota trigger enforcement (trg_enforce_church_entry_quota).
7. Group registration creation via RPC with atomic member roster.
8. Group member size bounds validation (min_participants, max_participants).
9. Group cross-church participant rejection.
10. Cross-team duplicate member enrollment prevention trigger (trg_prevent_duplicate_group_membership).
11. Group registration deletion and member cascade.
12. Official stage sheet and roster data query accuracy.
13. RLS permissions and RBAC enforcement (anon read-only, admin write, RPC guard).
14. Audit logging verification (REGISTRATION_CREATED, GROUP_REGISTRATION_CREATED).
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

    print("\n--- Running ZIMRAH 2026 Registration Management Integration Tests ---")

    try:
        with conn.cursor() as cur:
            # -------------------------------------------------------------
            # SETUP: Identify test edition, churches, events, participants
            # -------------------------------------------------------------
            cur.execute("SELECT id FROM public.editions WHERE year = 2026 LIMIT 1")
            edition_id = cur.fetchone()[0]

            cur.execute("SELECT id, code, name FROM public.churches WHERE code = 'CH01' LIMIT 1")
            ch1_row = cur.fetchone()
            ch1_id, ch1_code, ch1_name = ch1_row

            cur.execute("SELECT id, code, name FROM public.churches WHERE code = 'CH02' LIMIT 1")
            ch2_row = cur.fetchone()
            ch2_id, ch2_code, ch2_name = ch2_row

            cur.execute("SELECT id, code, name, min_participants, max_participants, max_entries_per_church FROM public.events WHERE code = 'EV01' LIMIT 1")
            ev01_row = cur.fetchone()
            ev01_id, ev01_code, ev01_name, ev01_min, ev01_max, ev01_quota = ev01_row

            cur.execute("SELECT id, code, name FROM public.events WHERE code = 'EV02' LIMIT 1")
            ev02_id, ev02_code, ev02_name = cur.fetchone()

            cur.execute("SELECT id, code, name, min_participants, max_participants, max_entries_per_church FROM public.events WHERE code = 'EV15' LIMIT 1")
            ev15_row = cur.fetchone()
            ev15_id, ev15_code, ev15_name, ev15_min, ev15_max, ev15_quota = ev15_row

            cur.execute("SELECT id, code, name, min_participants, max_participants FROM public.events WHERE code = 'EV16' LIMIT 1")
            ev16_row = cur.fetchone()
            ev16_id, ev16_code, ev16_name, ev16_min, ev16_max = ev16_row

            # Clean any leftover test records
            cur.execute("DELETE FROM public.registrations WHERE chest_number LIKE 'TEST%' OR chest_number IN ('001', '002', '003', '004', '005', '010', '011', '012', '013', 'G01', 'G02', 'G99')")
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('001', '002', '003', '004', '005', '010', '011', '012', '013')")
            conn.commit()

            # Insert test contestants for Church 1
            cur.execute("""
                INSERT INTO public.participants (edition_id, church_id, chest_number, name, name_malayalam, gender, age_category)
                VALUES 
                    (%s, %s, '001', 'David Paul', 'ഡേവിഡ് പോൾ', 'M', 'JUNIOR'),
                    (%s, %s, '002', 'Joshua Samuel', 'ജോഷ്വ സാമുവൽ', 'M', 'JUNIOR'),
                    (%s, %s, '003', 'Reuben George', 'റൂബൻ ജോർജ്ജ്', 'M', 'JUNIOR'),
                    (%s, %s, '004', 'Benjamin Thomas', 'ബഞ്ചമിൻ തോമസ്', 'M', 'JUNIOR'),
                    (%s, %s, '005', 'Ethan Kurian', 'ഈഥൻ കുര്യൻ', 'M', 'JUNIOR')
                RETURNING chest_number, id;
            """, (edition_id, ch1_id, edition_id, ch1_id, edition_id, ch1_id, edition_id, ch1_id, edition_id, ch1_id))
            ch1_parts = dict(cur.fetchall())
            p1, p2, p3, p4, p5 = ch1_parts['001'], ch1_parts['002'], ch1_parts['003'], ch1_parts['004'], ch1_parts['005']

            # Insert test contestants for Church 2
            cur.execute("""
                INSERT INTO public.participants (edition_id, church_id, chest_number, name, name_malayalam, gender, age_category)
                VALUES 
                    (%s, %s, '010', 'Hannah Varghese', 'ഹന്ന വർഗീസ്', 'F', 'JUNIOR'),
                    (%s, %s, '011', 'Miriam Philip', 'മിറിയം ഫിലിപ്പ്', 'F', 'JUNIOR'),
                    (%s, %s, '012', 'Leah Mathew', 'ലിയ മാത്യു', 'F', 'JUNIOR'),
                    (%s, %s, '013', 'Sarah John', 'സാറ ജോൺ', 'F', 'JUNIOR')
                RETURNING chest_number, id;
            """, (edition_id, ch2_id, edition_id, ch2_id, edition_id, ch2_id, edition_id, ch2_id))
            ch2_parts = dict(cur.fetchall())
            p10, p11, p12, p13 = ch2_parts['010'], ch2_parts['011'], ch2_parts['012'], ch2_parts['013']
            conn.commit()

            print(f"Setup complete: Edition 2026, 2 Churches, 5 Events, 9 Test Participants.")

            # -------------------------------------------------------------
            # SECTION 1: INDIVIDUAL REGISTRATION CREATION & CHEST NUMBER
            # -------------------------------------------------------------
            print("\n1. Individual Registration Creation & String Chest Number Formatting:")

            # Act as SUPER_ADMIN
            set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)

            # 1.1 Create individual registration via RPC
            cur.execute("""
                SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
            """, (edition_id, ev01_id, ch1_id, p1, '001'))
            res1 = cur.fetchone()[0]
            conn.commit()

            assert_test(res1.get('success') is True, "Individual registration RPC returned success=True")
            reg1_id = res1.get('registration_id')
            assert_test(reg1_id is not None, f"Registration record created with UUID: {reg1_id}")

            # 1.2 Verify record in registrations table with exact leading zeros preserved
            cur.execute("""
                SELECT chest_number, participant_id, church_id, event_id 
                FROM public.registrations 
                WHERE id = %s;
            """, (reg1_id,))
            reg_row = cur.fetchone()
            assert_test(
                reg_row[0] == '001' and reg_row[1] == p1 and reg_row[2] == ch1_id and reg_row[3] == ev01_id,
                "Registration stores string chest_number '001' preserving leading zero and participant reference"
            )

            # 1.3 Verify audit log entry
            cur.execute("""
                SELECT action, model_name, object_id, object_repr 
                FROM public.audit_logs 
                WHERE object_id = %s;
            """, (str(reg1_id),))
            audit_entry = cur.fetchone()
            assert_test(
                audit_entry is not None and audit_entry[0] == 'REGISTRATION_CREATED' and audit_entry[1] == 'Registration',
                "Audit log entry REGISTRATION_CREATED recorded with correct metadata"
            )

            # -------------------------------------------------------------
            # SECTION 2: INDIVIDUAL REGISTRATION INTEGRITY CONSTRAINTS
            # -------------------------------------------------------------
            print("\n2. Individual Registration Integrity Constraints & Quotas:")

            # Temporarily configure EV02 with quota of 2 to independently verify unique indexes before trigger cutoff
            cur.execute("UPDATE public.events SET max_entries_per_church = 2 WHERE id = %s;", (ev02_id,))
            conn.commit()

            # Register first contestant for Church 2 in EV02
            cur.execute("""
                SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
            """, (edition_id, ev02_id, ch2_id, p10, '010'))
            res_p10 = cur.fetchone()[0]
            conn.commit()
            reg_p10_id = res_p10.get('registration_id')

            # 2.1 Duplicate individual registration in same event (idx_unique_event_participant)
            # Under quota 2, quota passes (1 < 2), but idx_unique_event_participant blocks p10
            try:
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev02_id, ch2_id, p10, '019'))
                conn.commit()
                assert_test(False, "Duplicate registration for same participant in same event should be rejected")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test(True, "Duplicate individual registration rejected by idx_unique_event_participant")

            # 2.2 Duplicate chest number in same event (idx_unique_event_chest)
            # Under quota 2, quota passes (1 < 2), but idx_unique_event_chest blocks duplicate chest '010'
            try:
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev02_id, ch2_id, p11, '010'))
                conn.commit()
                assert_test(False, "Duplicate chest number in same event should be rejected")
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test(True, "Duplicate chest number '010' rejected by idx_unique_event_chest")

            # 2.3 Church affiliation mismatch
            try:
                # p1 belongs to Church 1, but registering under Church 2
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev02_id, ch2_id, p1, '001'))
                conn.commit()
                assert_test(False, "Church affiliation mismatch should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Church Affiliation Mismatch" in str(e), "Church affiliation mismatch rejected with informative error")

            # 2.4 Event type validation (cannot register individual in GROUP event via create_individual_registration)
            try:
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev15_id, ch1_id, p2, '002'))
                conn.commit()
                assert_test(False, "Registering individual into group event should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Event Error: Competition is a group event" in str(e), "Group event rejected by individual registration RPC")

            # Register second valid contestant for Church 2 in EV02 to reach quota limit (2)
            cur.execute("""
                SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
            """, (edition_id, ev02_id, ch2_id, p11, '011'))
            res_p11 = cur.fetchone()[0]
            conn.commit()
            reg_p11_id = res_p11.get('registration_id')

            # 2.5 Church entry quota enforcement (trg_enforce_church_entry_quota)
            # Church 2 already has 2 registered entries in EV02. Registering p12 must be blocked by the trigger.
            try:
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev02_id, ch2_id, p12, '012'))
                conn.commit()
                assert_test(False, "Church entry quota violation should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Quota Exceeded" in str(e), f"Church entry quota enforcement trigger blocked excess registration")

            # Clean EV02 test registrations and restore quota
            cur.execute("DELETE FROM public.registrations WHERE id IN (%s, %s);", (reg_p10_id, reg_p11_id))
            cur.execute("UPDATE public.events SET max_entries_per_church = 1 WHERE id = %s;", (ev02_id,))
            conn.commit()

            # -------------------------------------------------------------
            # SECTION 3: GROUP REGISTRATION CREATION & ATOMIC ROSTERS
            # -------------------------------------------------------------
            print("\n3. Group Registration Creation & Team Roster Management:")

            # 3.1 Create group registration for Church 1 in EV15 ('Group Song', min=4, max=12)
            cur.execute("""
                SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
            """, (edition_id, ev15_id, ch1_id, 'St. Peter Parish Choir', 'G01', [p1, p2, p3, p4]))
            res_grp = cur.fetchone()[0]
            conn.commit()

            assert_test(res_grp.get('success') is True, "Group registration RPC executed successfully")
            grp_reg_id = res_grp.get('registration_id')
            assert_test(grp_reg_id is not None, f"Group registration created with UUID: {grp_reg_id}")
            assert_test(res_grp.get('member_count') == 4, "Group member count correctly reported as 4")

            # 3.2 Verify group registration record (participant_id IS NULL)
            cur.execute("""
                SELECT group_name, chest_number, participant_id, church_id 
                FROM public.registrations 
                WHERE id = %s;
            """, (grp_reg_id,))
            g_row = cur.fetchone()
            assert_test(
                g_row[0] == 'St. Peter Parish Choir' and g_row[1] == 'G01' and g_row[2] is None and g_row[3] == ch1_id,
                "Group registration record stores group_name, team chest_number 'G01', and NULL participant_id"
            )

            # 3.3 Verify member roster in group_registration_members
            cur.execute("""
                SELECT participant_id 
                FROM public.group_registration_members 
                WHERE registration_id = %s 
                ORDER BY created_at;
            """, (grp_reg_id,))
            member_ids = [r[0] for r in cur.fetchall()]
            assert_test(
                set(member_ids) == {p1, p2, p3, p4},
                "All 4 team members enrolled atomically in group_registration_members"
            )

            # 3.4 Verify audit log for group registration
            cur.execute("""
                SELECT action, model_name, object_id, object_repr 
                FROM public.audit_logs 
                WHERE object_id = %s;
            """, (str(grp_reg_id),))
            g_audit = cur.fetchone()
            assert_test(
                g_audit is not None and g_audit[0] == 'GROUP_REGISTRATION_CREATED' and g_audit[3] == 'St. Peter Parish Choir',
                "Audit log entry GROUP_REGISTRATION_CREATED recorded with group representation"
            )

            # -------------------------------------------------------------
            # SECTION 4: GROUP REGISTRATION BOUNDS & CROSS-TEAM INTEGRITY
            # -------------------------------------------------------------
            print("\n4. Group Bounds, Church Affiliation & Cross-Team Collision Prevention:")

            # 4.1 Group event type check (cannot call create_group_registration on individual event EV01)
            try:
                cur.execute("""
                    SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
                """, (edition_id, ev01_id, ch1_id, 'Invalid Solo Group', 'G99', [p1, p2]))
                conn.commit()
                assert_test(False, "Group registration on individual event should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Competition is an individual event" in str(e), "Individual event rejected by group registration RPC")

            # 4.2 Team size under minimum (EV15 requires min 4, provide 3)
            try:
                cur.execute("""
                    SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
                """, (edition_id, ev15_id, ch2_id, 'Small Choir', 'G02', [p10, p11, p12]))
                conn.commit()
                assert_test(False, "Team size under minimum should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Team size under minimum" in str(e), "Team size under minimum bounds rejected (< 4 members)")

            # 4.3 Team size over maximum (EV16 'Quartet' requires min 4, max 4; provide 5)
            try:
                cur.execute("""
                    SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
                """, (edition_id, ev16_id, ch1_id, 'Oversized Quartet', 'G03', [p1, p2, p3, p4, p5]))
                conn.commit()
                assert_test(False, "Team size over maximum should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Team size exceeds maximum" in str(e), "Team size exceeding maximum bounds rejected (> 4 members)")

            # 4.4 Group participant church affiliation consistency
            # Church 2 registering team, but accidentally includes p5 from Church 1
            try:
                cur.execute("""
                    SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
                """, (edition_id, ev15_id, ch2_id, 'Cross Church Team', 'G02', [p10, p11, p12, p5]))
                conn.commit()
                assert_test(False, "Cross-church participant in group should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Church Affiliation Error" in str(e), "Non-member church participant in group team rejected")

            # 4.5 Cross-team duplicate member enrollment trigger (trg_prevent_duplicate_group_membership)
            # Church 2 registers Team B in EV15 with [p10, p11, p12, p13].
            cur.execute("""
                SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
            """, (edition_id, ev15_id, ch2_id, 'Bethel Youth Choir', 'G02', [p10, p11, p12, p13]))
            res_grp2 = cur.fetchone()[0]
            conn.commit()
            assert_test(res_grp2.get('success') is True, "Second church team successfully registered in EV15")
            grp2_reg_id = res_grp2.get('registration_id')

            # Now, attempt to add participant p1 (who is in 'St. Peter Parish Choir') into Team B directly
            try:
                cur.execute("""
                    INSERT INTO public.group_registration_members (registration_id, participant_id)
                    VALUES (%s, %s);
                """, (grp2_reg_id, p1))
                conn.commit()
                assert_test(False, "Enrolling participant in multiple teams for same event should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test(
                    "Membership Collision" in str(e) and "St. Peter Parish Choir" in str(e),
                    "Cross-team duplicate enrollment blocked by trigger trg_prevent_duplicate_group_membership"
                )

            # 4.6 Church quota on group events (EV15 allows max 1 team per church)
            # Church 1 tries to register a second team for EV15
            try:
                cur.execute("""
                    SELECT public.create_group_registration(%s, %s, %s, %s, %s, %s);
                """, (edition_id, ev15_id, ch1_id, 'Second Team Church 1', 'G09', [p1, p2, p3, p4]))
                conn.commit()
                assert_test(False, "Second group team exceeding church quota should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Quota Exceeded" in str(e), "Church quota enforcement trigger blocked second group team")

            # -------------------------------------------------------------
            # SECTION 5: STAGE SHEET & PRINTABLE ROSTER QUERY ACCURACY
            # -------------------------------------------------------------
            print("\n5. Stage Sheet Data Retrieval & Roster Integrity:")

            # 5.1 Query event stage sheet roster for EV15
            cur.execute("""
                SELECT 
                    r.id,
                    r.chest_number,
                    r.group_name,
                    c.name AS church_name,
                    c.code AS church_code,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', p.id,
                                'chest_number', p.chest_number,
                                'name', p.name,
                                'name_malayalam', p.name_malayalam
                            ) ORDER BY p.chest_number
                        ) FILTER (WHERE p.id IS NOT NULL),
                        '[]'::json
                    ) AS members
                FROM public.registrations r
                JOIN public.churches c ON c.id = r.church_id
                LEFT JOIN public.group_registration_members grm ON grm.registration_id = r.id
                LEFT JOIN public.participants p ON p.id = grm.participant_id
                WHERE r.event_id = %s
                GROUP BY r.id, r.chest_number, r.group_name, c.name, c.code
                ORDER BY r.chest_number ASC;
            """, (ev15_id,))
            roster_rows = cur.fetchall()

            assert_test(len(roster_rows) == 2, "Stage sheet fetches both registered teams for EV15")
            team1, team2 = roster_rows[0], roster_rows[1]
            assert_test(team1[1] == 'G01' and team1[2] == 'St. Peter Parish Choir' and len(team1[5]) == 4,
                        "Team G01 roster contains 4 contestants with chest numbers and Malayalam names")
            assert_test(team2[1] == 'G02' and team2[2] == 'Bethel Youth Choir' and len(team2[5]) == 4,
                        "Team G02 roster contains 4 contestants from Church 2")

            # -------------------------------------------------------------
            # SECTION 6: REGISTRATION DELETION & CASCADE
            # -------------------------------------------------------------
            print("\n6. Registration Deletion & Roster Member Cascading:")

            # 6.1 Delete team 2 registration
            cur.execute("DELETE FROM public.registrations WHERE id = %s;", (grp2_reg_id,))
            conn.commit()

            # Verify group registration removed
            cur.execute("SELECT COUNT(*) FROM public.registrations WHERE id = %s;", (grp2_reg_id,))
            assert_test(cur.fetchone()[0] == 0, "Group registration record deleted successfully")

            # Verify members cascaded
            cur.execute("SELECT COUNT(*) FROM public.group_registration_members WHERE registration_id = %s;", (grp2_reg_id,))
            assert_test(cur.fetchone()[0] == 0, "Group members cascaded and deleted automatically on registration delete")

            # -------------------------------------------------------------
            # SECTION 7: RLS SECURITY & ROLE-BASED ACCESS CONTROL
            # -------------------------------------------------------------
            print("\n7. Row Level Security & RBAC Enforcement on Registrations:")

            # 7.1 Anon role: Public CAN read registrations
            set_role_and_user(cur, "anon")
            cur.execute("SELECT COUNT(*) FROM public.registrations WHERE id = %s;", (reg1_id,))
            assert_test(cur.fetchone()[0] == 1, "Public (anon) can read registered entries for badges/schedules")

            # 7.2 Anon role: Public CANNOT insert registration directly
            try:
                cur.execute("""
                    INSERT INTO public.registrations (edition_id, event_id, church_id, participant_id, chest_number)
                    VALUES (%s, %s, %s, %s, '099');
                """, (edition_id, ev02_id, ch1_id, p5))
                conn.commit()
                assert_test(False, "Anon direct insert to registrations should be blocked by RLS")
            except psycopg.Error:
                conn.rollback()
                assert_test(True, "Anon direct insert to registrations blocked by RLS")

            # 7.3 Anon role: Public CANNOT execute RPC without admin permissions
            try:
                set_role_and_user(cur, "anon")
                cur.execute("""
                    SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
                """, (edition_id, ev02_id, ch1_id, p5, '005'))
                conn.commit()
                assert_test(False, "Anon call to create_individual_registration should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                assert_test("Access Denied" in str(e), "Anon registration RPC call rejected with 'Access Denied'")

            # 7.4 RESULT_ADMIN role: Can register contestants and groups
            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)
            cur.execute("""
                SELECT public.create_individual_registration(%s, %s, %s, %s, %s);
            """, (edition_id, ev02_id, ch2_id, p11, '011'))
            res_admin_reg = cur.fetchone()[0]
            conn.commit()
            assert_test(res_admin_reg.get('success') is True, "RESULT_ADMIN successfully created individual registration via RPC")
            admin_reg_id = res_admin_reg.get('registration_id')

            # 7.5 RESULT_ADMIN role: Can delete registration
            cur.execute("DELETE FROM public.registrations WHERE id = %s RETURNING id;", (admin_reg_id,))
            del_row = cur.fetchone()
            conn.commit()
            assert_test(del_row is not None and str(del_row[0]) == str(admin_reg_id), "RESULT_ADMIN authorized to delete registration")

            # -------------------------------------------------------------
            # TEARDOWN: Clean up test registrations and participants
            # -------------------------------------------------------------
            print("\n8. Test Cleanup & Teardown:")
            set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
            cur.execute("DELETE FROM public.registrations WHERE id IN (%s, %s);", (reg1_id, grp_reg_id))
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('001', '002', '003', '004', '005', '010', '011', '012', '013');")
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM public.registrations WHERE chest_number IN ('001', 'G01', 'G02');")
            assert_test(cur.fetchone()[0] == 0, "All test registrations cleanly purged with 0 orphaned records")

            cur.execute("RESET ROLE;")

    finally:
        conn.close()

    print(f"\n=======================================================")
    print(f"  PHASE 5 TEST SUITE RESULTS: {passed_tests}/{total_tests} ASSERTIONS PASSED")
    print(f"=======================================================\n")


if __name__ == "__main__":
    run_tests()
