"""
ZIMRAH 2026 – Phase 6: Result Management Integration Test Suite
Validates:
1. Multi-row draft result creation with decimal grade points and position points.
2. Server-side authoritative score recalculation (Total = Grade Points + Position Points, malicious client values overwritten).
3. Fractional decimal precision scoring without float drift (e.g. 3.50 + 2.25 = 5.75).
4. Public visitor (anon) RLS isolation: Draft results and entries are 100% invisible to anonymous users.
5. Role-based access control: anon and RESULT_ADMIN are blocked from publishing.
6. Successful publication by PUBLISHER / SUPER_ADMIN:
   - Status updated to PUBLISHED, published_by and published_at set.
   - Point Ledger entries generated: Church points credited once per entry.
   - Individual points credited to participant profile.
   - Group event awards church points once; individual allocation config supported.
7. Public visibility after publishing: anon can view published result, entries, and active ledger.
8. Duplicate publication prevention and draft mutation blocking on published results.
9. Unpublish lifecycle: reverts to DRAFT, clears publication metadata, deactivates ledger points, hides from public, audits unpublish.
10. Published score correction: enforces mandatory reason, records old vs new score diffs in audit log, updates ledger atomically.
11. Draft deletion: SUPER_ADMIN only, blocked if published.
12. Audit log trail completeness across all state transitions.
"""

import sys
import psycopg
import json
from decimal import Decimal

DB_HOST = "127.0.0.1"
DB_PORT = 5432
DB_USER = "postgres"
DB_PASS = "password"
TEST_DB = "zimrah_supabase_test"

UUID_SUPER_ADMIN = "11111111-1111-1111-1111-111111111111"
UUID_RESULT_ADMIN = "22222222-2222-2222-2222-222222222222"
UUID_PUBLISHER = "33333333-3333-3333-3333-333333333333"

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

    print("\n--- Running ZIMRAH 2026 Result Management Integration Tests ---")

    try:
        with conn.cursor() as cur:
            # -------------------------------------------------------------
            # SETUP: Identify test edition, churches, events, participants
            # -------------------------------------------------------------
            cur.execute("SELECT id FROM public.editions WHERE year = 2026 LIMIT 1")
            edition_id = cur.fetchone()[0]

            cur.execute("SELECT id, code, name FROM public.churches WHERE code = 'CH01' LIMIT 1")
            ch1_id, ch1_code, ch1_name = cur.fetchone()

            cur.execute("SELECT id, code, name FROM public.churches WHERE code = 'CH02' LIMIT 1")
            ch2_id, ch2_code, ch2_name = cur.fetchone()

            cur.execute("SELECT id, code, name FROM public.events WHERE code = 'EV01' LIMIT 1")
            ev01_id, ev01_code, ev01_name = cur.fetchone()

            cur.execute("SELECT id, code, name FROM public.events WHERE code = 'EV16' LIMIT 1")
            ev16_id, ev16_code, ev16_name = cur.fetchone()

            # Clean any leftover test records for these events
            cur.execute("DELETE FROM public.point_ledger WHERE event_id IN (%s, %s);", (ev01_id, ev16_id))
            cur.execute("DELETE FROM public.event_results WHERE event_id IN (%s, %s);", (ev01_id, ev16_id))
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('001', '002', '003', '004', '010');")
            conn.commit()

            # Insert test contestants
            cur.execute("""
                INSERT INTO public.participants (edition_id, church_id, chest_number, name, name_malayalam, gender, age_category)
                VALUES 
                    (%s, %s, '001', 'Aaron Samuel', 'ആരോൺ സാമുവൽ', 'M', 'JUNIOR'),
                    (%s, %s, '002', 'Joel Mathew', 'ജോയൽ മാത്യു', 'M', 'JUNIOR'),
                    (%s, %s, '003', 'Titus George', 'ടൈറ്റസ് ജോർജ്ജ്', 'M', 'JUNIOR'),
                    (%s, %s, '004', 'Kiran Varghese', 'കിരൺ വർഗീസ്', 'M', 'JUNIOR'),
                    (%s, %s, '010', 'Mathew Thomas', 'മാത്യു തോമസ്', 'M', 'JUNIOR')
                RETURNING chest_number, id;
            """, (edition_id, ch1_id, edition_id, ch1_id, edition_id, ch1_id, edition_id, ch1_id, edition_id, ch2_id))
            parts = dict(cur.fetchall())
            p1, p2, p3, p4, p10 = parts['001'], parts['002'], parts['003'], parts['004'], parts['010']
            conn.commit()

            print(f"Setup complete: Edition 2026, 2 Churches, 2 Events (Solo EV01 & Quartet EV16), 5 Participants.")

            # -------------------------------------------------------------
            # SECTION 1: RESULT DRAFT CREATION & SERVER-SIDE SCORE RECALCULATION
            # -------------------------------------------------------------
            print("\n1. Draft Result Creation & Authoritative Server Recalculation:")

            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)

            # 1.1 Submit draft with malicious client total_points (999.00)
            draft_entries = [
                {
                    'chest_number': '001',
                    'participant_name': 'Aaron Samuel',
                    'church_id': str(ch1_id),
                    'participant_id': str(p1),
                    'position': 1,
                    'grade': 'A',
                    'grade_points': '5.00',
                    'position_points': '3.00',
                    'total_points': '999.00',  # Malicious / client manipulated value
                    'remarks': 'First place performance'
                },
                {
                    'chest_number': '010',
                    'participant_name': 'Mathew Thomas',
                    'church_id': str(ch2_id),
                    'participant_id': str(p10),
                    'position': 2,
                    'grade': 'B',
                    'grade_points': '3.50',
                    'position_points': '2.25',
                    'total_points': '0.00',  # Omitted or wrong client value
                    'remarks': 'Second place'
                }
            ]

            cur.execute("""
                SELECT public.save_result_draft(%s, %s::jsonb, 'Preliminary judge notes');
            """, (ev01_id, json.dumps(draft_entries)))
            draft_res = cur.fetchone()[0]
            conn.commit()

            assert_test(draft_res.get('success') is True, "Result draft saved successfully via RPC")
            result1_id = draft_res.get('event_result_id')
            assert_test(result1_id is not None, f"EventResult record created with UUID: {result1_id}")

            # 1.2 Verify server authoritative calculation: Total Points = Grade Points + Position Points
            cur.execute("""
                SELECT chest_number, grade_points, position_points, total_points 
                FROM public.result_entries 
                WHERE event_result_id = %s 
                ORDER BY position ASC;
            """, (result1_id,))
            rows = cur.fetchall()

            assert_test(len(rows) == 2, "Both result entries saved successfully")
            entry1, entry2 = rows[0], rows[1]
            assert_test(
                entry1[0] == '001' and entry1[1] == Decimal('5.00') and entry1[2] == Decimal('3.00') and entry1[3] == Decimal('8.00'),
                "Server securely recalculated Total Points: 5.00 + 3.00 = 8.00 (tampered 999.00 client input overwritten)"
            )
            assert_test(
                entry2[0] == '010' and entry2[1] == Decimal('3.50') and entry2[2] == Decimal('2.25') and entry2[3] == Decimal('5.75'),
                "Fractional decimal precision preserved without float drift: 3.50 + 2.25 = 5.75"
            )

            # 1.3 Verify EventResult status is DRAFT
            cur.execute("SELECT status, notes FROM public.event_results WHERE id = %s;", (result1_id,))
            er_row = cur.fetchone()
            assert_test(er_row[0] == 'DRAFT' and er_row[1] == 'Preliminary judge notes', "EventResult status is DRAFT")

            # 1.4 Verify audit log entry (as SUPER_ADMIN)
            set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
            cur.execute("SELECT action, model_name FROM public.audit_logs WHERE object_id = %s;", (str(result1_id),))
            audit_draft = cur.fetchone()
            assert_test(audit_draft is not None and audit_draft[0] == 'RESULT_DRAFT_CREATED', "Audit log entry RESULT_DRAFT_CREATED recorded")

            # -------------------------------------------------------------
            # SECTION 2: PUBLIC RLS ISOLATION (DRAFT RESULTS INVISIBLE)
            # -------------------------------------------------------------
            print("\n2. Public RLS Visibility Isolation (Draft Results Inaccessible):")

            set_role_and_user(cur, "anon")

            # 2.1 Public cannot see draft EventResult
            cur.execute("SELECT COUNT(*) FROM public.event_results WHERE id = %s;", (result1_id,))
            assert_test(cur.fetchone()[0] == 0, "Public visitor (anon) CANNOT view DRAFT EventResult via RLS")

            # 2.2 Public cannot see draft ResultEntries
            cur.execute("SELECT COUNT(*) FROM public.result_entries WHERE event_result_id = %s;", (result1_id,))
            assert_test(cur.fetchone()[0] == 0, "Public visitor (anon) CANNOT view DRAFT ResultEntries via RLS")

            # 2.3 Point ledger has 0 active points while result is DRAFT
            cur.execute("SELECT COUNT(*) FROM public.point_ledger WHERE is_active = TRUE AND event_id = %s;", (ev01_id,))
            assert_test(cur.fetchone()[0] == 0, "Point Ledger has 0 active records while result is in DRAFT state")

            # -------------------------------------------------------------
            # SECTION 3: ROLE-BASED ACCESS CONTROL ON PUBLISHING
            # -------------------------------------------------------------
            print("\n3. Role-Based Access Control on Result Publishing:")

            # 3.1 Anon cannot publish
            set_role_and_user(cur, "anon")
            try:
                cur.execute("SELECT public.publish_result(%s);", (ev01_id,))
                conn.commit()
                assert_test(False, "Anon should not be allowed to publish results")
            except psycopg.Error as e:
                conn.rollback()
                assert_test("Access Denied" in str(e), "Public visitor (anon) blocked from publishing result ('Access Denied')")

            # 3.2 RESULT_ADMIN cannot publish
            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)
            try:
                cur.execute("SELECT public.publish_result(%s);", (ev01_id,))
                conn.commit()
                assert_test(False, "RESULT_ADMIN should not be allowed to publish results")
            except psycopg.Error as e:
                conn.rollback()
                assert_test("Access Denied: Only SUPER_ADMIN and PUBLISHER" in str(e),
                            "RESULT_ADMIN blocked from publishing results (only SUPER_ADMIN / PUBLISHER authorized)")

            # -------------------------------------------------------------
            # SECTION 4: SUCCESSFUL RESULT PUBLISHING & ATOMIC LEDGER GENERATION
            # -------------------------------------------------------------
            print("\n4. Result Publishing & Atomic Championship Point Ledger Generation:")

            # 4.1 PUBLISHER publishes result
            set_role_and_user(cur, "authenticated", UUID_PUBLISHER)
            cur.execute("SELECT public.publish_result(%s);", (ev01_id,))
            pub_res = cur.fetchone()[0]
            conn.commit()

            assert_test(pub_res.get('success') is True, "PUBLISHER successfully published result via RPC")
            assert_test(pub_res.get('status') == 'PUBLISHED', "Returned status is PUBLISHED")
            assert_test(pub_res.get('entries_count') == 2, "Reported 2 entries published")
            assert_test(pub_res.get('ledger_records_created') == 4, "Reported 4 Point Ledger records created (2 Church + 2 Individual)")

            # 4.2 Verify EventResult updated
            cur.execute("SELECT status, published_by, published_at FROM public.event_results WHERE id = %s;", (result1_id,))
            pub_row = cur.fetchone()
            assert_test(pub_row[0] == 'PUBLISHED', "EventResult status in DB updated to PUBLISHED")
            assert_test(str(pub_row[1]) == UUID_PUBLISHER, "published_by accurately records the publisher UUID")
            assert_test(pub_row[2] is not None, "published_at timestamp populated")

            # 4.3 Verify Point Ledger records
            cur.execute("""
                SELECT target, church_id, participant_id, points, is_active 
                FROM public.point_ledger 
                WHERE event_id = %s AND is_active = TRUE 
                ORDER BY target, points DESC;
            """, (ev01_id,))
            ledgers = cur.fetchall()

            assert_test(len(ledgers) == 4, "Exactly 4 active Point Ledger records exist")
            church_points = [l for l in ledgers if l[0] == 'CHURCH']
            indiv_points = [l for l in ledgers if l[0] == 'INDIVIDUAL']

            assert_test(len(church_points) == 2, "2 Church championship ledger entries generated")
            assert_test(church_points[0][1] == ch1_id and church_points[0][3] == Decimal('8.00'),
                        "Church 1 credited with 8.00 points from 1st place solo entry")
            assert_test(church_points[1][1] == ch2_id and church_points[1][3] == Decimal('5.75'),
                        "Church 2 credited with 5.75 points from 2nd place solo entry")

            assert_test(len(indiv_points) == 2, "2 Individual championship ledger entries generated")
            assert_test(indiv_points[0][2] == p1 and indiv_points[0][3] == Decimal('8.00'),
                        "Participant Aaron Samuel (001) credited with 8.00 individual points")
            assert_test(indiv_points[1][2] == p10 and indiv_points[1][3] == Decimal('5.75'),
                        "Participant Mathew Thomas (010) credited with 5.75 individual points")

            # 4.4 Verify audit log
            set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
            cur.execute("""
                SELECT action, changes 
                FROM public.audit_logs 
                WHERE object_id = %s AND action = 'RESULT_PUBLISHED';
            """, (str(result1_id),))
            pub_audit = cur.fetchone()
            assert_test(pub_audit is not None and pub_audit[1]['status']['new'] == 'PUBLISHED',
                        "Audit log RESULT_PUBLISHED recorded with state transition")

            # -------------------------------------------------------------
            # SECTION 5: PUBLIC VISIBILITY AFTER PUBLISHING
            # -------------------------------------------------------------
            print("\n5. Public Visitor Visibility of Published Scores:")

            set_role_and_user(cur, "anon")

            # 5.1 Public can read published EventResult
            cur.execute("SELECT status FROM public.event_results WHERE id = %s;", (result1_id,))
            res_anon = cur.fetchone()
            assert_test(res_anon is not None and res_anon[0] == 'PUBLISHED',
                        "Public visitor (anon) can read published EventResult via RLS")

            # 5.2 Public can read published ResultEntries
            cur.execute("SELECT COUNT(*) FROM public.result_entries WHERE event_result_id = %s;", (result1_id,))
            assert_test(cur.fetchone()[0] == 2, "Public visitor (anon) can read both ResultEntries for published event")

            # 5.3 Public can read active Point Ledger records
            cur.execute("SELECT COUNT(*) FROM public.point_ledger WHERE event_id = %s AND is_active = TRUE;", (ev01_id,))
            assert_test(cur.fetchone()[0] == 4, "Public visitor (anon) can read all 4 active Point Ledger records")

            # -------------------------------------------------------------
            # SECTION 6: DUPLICATE PUBLISH & MUTATION BLOCKING
            # -------------------------------------------------------------
            print("\n6. Duplicate Publication & Published Result Mutation Protections:")

            set_role_and_user(cur, "authenticated", UUID_PUBLISHER)

            # 6.1 Duplicate publish rejected
            try:
                cur.execute("SELECT public.publish_result(%s);", (ev01_id,))
                conn.commit()
                assert_test(False, "Duplicate publish call should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_PUBLISHER)
                assert_test("already published" in str(e), "Duplicate publication blocked with 'already published' error")

            # 6.2 save_result_draft on published result rejected
            try:
                cur.execute("SELECT public.save_result_draft(%s, %s::jsonb);", (ev01_id, json.dumps(draft_entries)))
                conn.commit()
                assert_test(False, "save_result_draft on published result should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_PUBLISHER)
                assert_test("Use score correction" in str(e), "Draft update on published result blocked; correction workflow required")

            # -------------------------------------------------------------
            # SECTION 7: GROUP RESULT & SINGLE CHURCH POINT ATTRIBUTION
            # -------------------------------------------------------------
            print("\n7. Group Event Result & Single Church Credit Rule:")

            # Create group result for EV16 (Quartet - 4 members)
            group_entries = [
                {
                    'chest_number': 'Q01',
                    'participant_name': 'Munroethuruth Quartet Team',
                    'church_id': str(ch1_id),
                    'position': 1,
                    'grade': 'A',
                    'grade_points': '5.00',
                    'position_points': '5.00',
                    'remarks': 'Outstanding performance',
                    'group_members': [
                        {'participant_id': str(p1), 'role': 'Tenor', 'points_allocated': '2.50'},
                        {'participant_id': str(p2), 'role': 'Lead', 'points_allocated': '2.50'},
                        {'participant_id': str(p3), 'role': 'Baritone', 'points_allocated': '0.00'},
                        {'participant_id': str(p4), 'role': 'Bass', 'points_allocated': '0.00'},
                    ]
                }
            ]

            cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Quartet result');", (ev16_id, json.dumps(group_entries)))
            res_quartet = cur.fetchone()[0]
            conn.commit()
            q_res_id = res_quartet.get('event_result_id')

            # Publish Quartet result
            cur.execute("SELECT public.publish_result(%s);", (ev16_id,))
            q_pub = cur.fetchone()[0]
            conn.commit()
            assert_test(q_pub.get('success') is True, "Quartet group result published successfully")

            # Church points: Exactly 1 entry of 10.00 pts (NOT 4 x 10.00 = 40.00 pts)
            cur.execute("""
                SELECT COUNT(*), SUM(points) 
                FROM public.point_ledger 
                WHERE event_id = %s AND target = 'CHURCH' AND is_active = TRUE;
            """, (ev16_id,))
            q_church = cur.fetchone()
            assert_test(q_church[0] == 1 and q_church[1] == Decimal('10.00'),
                        "Group event awards Church points exactly ONCE: 1 record for 10.00 pts (not multiplied by team size)")

            # Individual points: Exactly 2 entries of 2.50 pts each for p1 and p2 (p3 and p4 have 0.00)
            cur.execute("""
                SELECT participant_id, points 
                FROM public.point_ledger 
                WHERE event_id = %s AND target = 'INDIVIDUAL' AND is_active = TRUE 
                ORDER BY participant_id;
            """, (ev16_id,))
            q_indiv = cur.fetchall()
            assert_test(len(q_indiv) == 2, "Group event generated exactly 2 individual ledger entries for members with allocated points")
            assert_test(q_indiv[0][1] == Decimal('2.50') and q_indiv[1][1] == Decimal('2.50'),
                        "Individual member points correctly recorded at 2.50 pts each")

            # -------------------------------------------------------------
            # SECTION 8: RESULT UNPUBLISH LIFECYCLE
            # -------------------------------------------------------------
            print("\n8. Result Unpublish Workflow & Ledger Deactivation:")

            # Unpublish Quartet result
            cur.execute("SELECT public.unpublish_result(%s, 'Judge scrutiny requested');", (ev16_id,))
            unpub_res = cur.fetchone()[0]
            conn.commit()

            assert_test(unpub_res.get('success') is True and unpub_res.get('status') == 'DRAFT',
                        "Unpublish returned success with status reverted to DRAFT")
            assert_test(unpub_res.get('deactivated_ledger_count') == 3,
                        "All 3 active ledger entries for Quartet deactivated immediately")

            # Verify in DB: EventResult status is DRAFT, published_by is NULL
            cur.execute("SELECT status, published_by, published_at FROM public.event_results WHERE id = %s;", (q_res_id,))
            q_row = cur.fetchone()
            assert_test(q_row[0] == 'DRAFT' and q_row[1] is None and q_row[2] is None,
                        "EventResult metadata cleared (status DRAFT, published_by NULL, published_at NULL)")

            # Verify Point Ledger: 0 active entries
            cur.execute("SELECT COUNT(*) FROM public.point_ledger WHERE event_id = %s AND is_active = TRUE;", (ev16_id,))
            assert_test(cur.fetchone()[0] == 0, "Point Ledger has 0 active entries for unpublished event")

            # Verify public isolation: anon cannot see unpublished result
            set_role_and_user(cur, "anon")
            cur.execute("SELECT COUNT(*) FROM public.event_results WHERE id = %s;", (q_res_id,))
            assert_test(cur.fetchone()[0] == 0, "Public visitor (anon) cannot see unpublished result")

            # -------------------------------------------------------------
            # SECTION 9: PUBLISHED SCORE CORRECTION & AUDIT DIFF
            # -------------------------------------------------------------
            print("\n9. Published Result Correction & Audit Score Diffs:")

            set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)

            # Re-publish Quartet result to test correction
            cur.execute("SELECT public.publish_result(%s);", (ev16_id,))
            conn.commit()

            # 9.1 Mandatory reason check: empty reason rejected
            try:
                cur.execute("SELECT public.correct_published_result(%s, %s::jsonb, '');", (ev16_id, json.dumps(group_entries)))
                conn.commit()
                assert_test(False, "Correction without reason should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("reason for score correction is mandatory" in str(e),
                            "Correction rejected when mandatory reason is missing")

            # 9.2 Modify score: change position points from 5.00 to 3.00 (Total becomes 8.00)
            corrected_entries = [
                {
                    'chest_number': 'Q01',
                    'participant_name': 'Munroethuruth Quartet Team',
                    'church_id': str(ch1_id),
                    'position': 2,
                    'grade': 'A',
                    'grade_points': '5.00',
                    'position_points': '3.00',  # Reduced from 5.00 to 3.00
                    'remarks': 'Corrected after judge recount',
                    'group_members': [
                        {'participant_id': str(p1), 'role': 'Tenor', 'points_allocated': '2.00'},
                        {'participant_id': str(p2), 'role': 'Lead', 'points_allocated': '2.00'},
                    ]
                }
            ]

            cur.execute("""
                SELECT public.correct_published_result(%s, %s::jsonb, 'Clerical error in position points tabulation');
            """, (ev16_id, json.dumps(corrected_entries)))
            corr_res = cur.fetchone()[0]
            conn.commit()

            assert_test(corr_res.get('success') is True and corr_res.get('status') == 'PUBLISHED',
                        "Score correction applied successfully; status remains PUBLISHED")

            # Verify active church ledger point is now 8.00 (old 10.00 deactivated)
            cur.execute("""
                SELECT points FROM public.point_ledger 
                WHERE event_id = %s AND target = 'CHURCH' AND is_active = TRUE;
            """, (ev16_id,))
            active_pts = cur.fetchone()[0]
            assert_test(active_pts == Decimal('8.00'), "Active Church points updated from 10.00 to 8.00")

            # Verify Audit Log: RESULT_CORRECTED records old_scores vs new_scores diffs
            cur.execute("""
                SELECT changes 
                FROM public.audit_logs 
                WHERE object_id = %s AND action = 'RESULT_CORRECTED';
            """, (str(q_res_id),))
            corr_audit = cur.fetchone()[0]
            assert_test(corr_audit['reason'] == 'Clerical error in position points tabulation', "Audit log records exact correction reason")
            assert_test(corr_audit['old_scores']['Q01']['total_points'] == '10.00', "Audit log captured old score: 10.00 pts")
            assert_test(corr_audit['new_scores']['Q01']['total_points'] == '8.00', "Audit log captured new corrected score: 8.00 pts")

            # -------------------------------------------------------------
            # SECTION 10: DRAFT RESULT DELETION WORKFLOW
            # -------------------------------------------------------------
            print("\n10. Draft Deletion & Safety Rules:")

            # 10.1 Cannot delete a PUBLISHED result
            try:
                cur.execute("SELECT public.delete_result_draft(%s);", (ev16_id,))
                conn.commit()
                assert_test(False, "Deleting published result should be rejected")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Cannot delete a published result" in str(e), "Deletion of published result blocked (must unpublish first)")

            # 10.2 Unpublish Quartet and delete draft
            cur.execute("SELECT public.unpublish_result(%s, 'Purging draft');", (ev16_id,))
            conn.commit()

            # Non-super-admin cannot delete draft
            set_role_and_user(cur, "authenticated", UUID_RESULT_ADMIN)
            try:
                cur.execute("SELECT public.delete_result_draft(%s);", (ev16_id,))
                conn.commit()
                assert_test(False, "RESULT_ADMIN should not be able to delete draft")
            except psycopg.Error as e:
                conn.rollback()
                set_role_and_user(cur, "authenticated", UUID_SUPER_ADMIN)
                assert_test("Access Denied: Only SUPER_ADMIN" in str(e), "Only SUPER_ADMIN authorized to delete drafts")

            # SUPER_ADMIN deletes draft
            cur.execute("SELECT public.delete_result_draft(%s);", (ev16_id,))
            del_draft_res = cur.fetchone()[0]
            conn.commit()
            assert_test(del_draft_res.get('success') is True, "SUPER_ADMIN successfully deleted result draft")

            # Verify deleted from DB
            cur.execute("SELECT COUNT(*) FROM public.event_results WHERE event_id = %s;", (ev16_id,))
            assert_test(cur.fetchone()[0] == 0, "EventResult deleted from database")

            # -------------------------------------------------------------
            # TEARDOWN: Clean up EV01 test result and participants
            # -------------------------------------------------------------
            print("\n11. Test Teardown & Cleanup:")
            cur.execute("DELETE FROM public.point_ledger WHERE event_id IN (%s, %s);", (ev01_id, ev16_id))
            cur.execute("DELETE FROM public.event_results WHERE event_id IN (%s, %s);", (ev01_id, ev16_id))
            cur.execute("DELETE FROM public.participants WHERE chest_number IN ('001', '002', '003', '004', '010');")
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM public.event_results WHERE event_id IN (%s, %s);", (ev01_id, ev16_id))
            assert_test(cur.fetchone()[0] == 0, "All test records cleanly purged with 0 orphaned records")

            cur.execute("RESET ROLE;")

    finally:
        conn.close()

    print(f"\n=======================================================")
    print(f"  PHASE 6 TEST SUITE RESULTS: {passed_tests}/{total_tests} ASSERTIONS PASSED")
    print(f"=======================================================\n")


if __name__ == "__main__":
    run_tests()
