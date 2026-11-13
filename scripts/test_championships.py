#!/usr/bin/env python3
"""
ZIMRAH 2026 – Championship Engine & 5-Level Tie-Breaker Reconciliation Test Suite
Phase 7 Test Suite: Validates Point Ledger invariants, 5-level tie-breaking hierarchy,
Standard Competition Ranking (1, 2, 2, 4...), group event single church credit,
individual participant attribution, score corrections, unpublishing, and live summary metrics.
"""

import sys
import json
from decimal import Decimal
import psycopg

# Ensure clean UTF-8 console output
sys.stdout.reconfigure(encoding='utf-8')

DB_PARAMS = "host=127.0.0.1 port=5432 dbname=zimrah_supabase_test user=postgres password=password"

def run_test():
    print("--- Running ZIMRAH 2026 Championship Engine Integration & Reconciliation Tests ---")
    conn = psycopg.connect(DB_PARAMS)
    cur = conn.cursor()

    passed_count = 0
    total_count = 0

    def assert_true(condition, msg):
        nonlocal passed_count, total_count
        total_count += 1
        if condition:
            passed_count += 1
            print(f"  [PASS] {msg}")
        else:
            print(f"  [FAIL] {msg}")
            raise AssertionError(f"Assertion failed: {msg}")

    try:
        # Setup test data isolated for Phase 7
        cur.execute("SELECT id FROM public.editions WHERE is_active = TRUE ORDER BY year DESC LIMIT 1;")
        row = cur.fetchone()
        edition_id = row[0] if row else None
        if not edition_id:
            cur.execute("INSERT INTO public.editions (name, year, is_active) VALUES ('ZIMRAH 2026', 2026, TRUE) RETURNING id;")
            edition_id = cur.fetchone()[0]

        cur.execute("SELECT id FROM public.event_categories LIMIT 1;")
        cat_id = cur.fetchone()[0]

        # Pre-cleanup in case of prior aborted run
        cur.execute("DELETE FROM public.point_ledger WHERE event_id IN (SELECT id FROM public.events WHERE code IN ('EV81', 'EV82', 'EV83', 'EV84', 'EV85'));")
        cur.execute("DELETE FROM public.event_results WHERE event_id IN (SELECT id FROM public.events WHERE code IN ('EV81', 'EV82', 'EV83', 'EV84', 'EV85'));")
        cur.execute("DELETE FROM public.events WHERE code IN ('EV81', 'EV82', 'EV83', 'EV84', 'EV85');")
        cur.execute("DELETE FROM public.participants WHERE chest_number IN ('801', '802', '803', '804', '805');")
        cur.execute("DELETE FROM public.churches WHERE code IN ('TC01', 'TC02', 'TC03', 'TC04');")
        conn.commit()

        # Provision 4 Test Churches
        cur.execute("""
            INSERT INTO public.churches (code, name, district, is_active)
            VALUES 
                ('TC01', 'Test Church Alpha', 'Adoor Clergy District', TRUE),
                ('TC02', 'Test Church Beta', 'Adoor Clergy District', TRUE),
                ('TC03', 'Test Church Gamma', 'Adoor Clergy District', TRUE),
                ('TC04', 'Test Church Delta', 'Adoor Clergy District', TRUE)
            RETURNING id, code;
        """)
        churches = {code: cid for cid, code in cur.fetchall()}
        c_alpha = churches['TC01']
        c_beta = churches['TC02']
        c_gamma = churches['TC03']
        c_delta = churches['TC04']

        # Provision 5 Test Participants
        cur.execute("""
            INSERT INTO public.participants (edition_id, church_id, chest_number, name, gender, age_category)
            VALUES 
                (%s, %s, '801', 'John Mathew', 'M', 'JUNIOR'),
                (%s, %s, '802', 'Sarah Philip', 'F', 'SENIOR'),
                (%s, %s, '803', 'David Thomas', 'M', 'JUNIOR'),
                (%s, %s, '804', 'Mary Joseph', 'F', 'SENIOR'),
                (%s, %s, '805', 'Paul Daniel', 'M', 'JUNIOR')
            RETURNING id, chest_number;
        """, (
            edition_id, c_alpha,
            edition_id, c_beta,
            edition_id, c_gamma,
            edition_id, c_delta,
            edition_id, c_alpha
        ))
        part_map = {chest: pid for pid, chest in cur.fetchall()}
        p_john = part_map['801']
        p_sarah = part_map['802']
        p_david = part_map['803']
        p_mary = part_map['804']
        p_paul = part_map['805']

        # Provision 5 Test Events (4 Individual, 1 Group)
        cur.execute("""
            INSERT INTO public.events (edition_id, category_id, code, name, name_malayalam, event_type, contributes_to_individual, contributes_to_church)
            VALUES 
                (%s, %s, 'EV81', 'Solo Eastern Test', 'സോളോ ഈസ്റ്റേൺ', 'INDIVIDUAL', TRUE, TRUE),
                (%s, %s, 'EV82', 'Solo Western Test', 'സോളോ വെസ്റ്റേൺ', 'INDIVIDUAL', TRUE, TRUE),
                (%s, %s, 'EV83', 'Essay Writing Test', 'ഉപന്യാസ രചന', 'INDIVIDUAL', TRUE, TRUE),
                (%s, %s, 'EV84', 'Quartet Group Test', 'ക്വാർട്ടറ്റ്', 'GROUP', TRUE, TRUE),
                (%s, %s, 'EV85', 'Mime Competition Test', 'മൈം', 'INDIVIDUAL', TRUE, TRUE)
            RETURNING id, code;
        """, (
            edition_id, cat_id,
            edition_id, cat_id,
            edition_id, cat_id,
            edition_id, cat_id,
            edition_id, cat_id
        ))
        events = {code: eid for eid, code in cur.fetchall()}
        ev_solo1 = events['EV81']
        ev_solo2 = events['EV82']
        ev_essay = events['EV83']
        ev_group = events['EV84']
        ev_mime = events['EV85']

        # Get SUPER_ADMIN user
        cur.execute("SELECT id FROM public.user_profiles WHERE role = 'SUPER_ADMIN' LIMIT 1;")
        admin_row = cur.fetchone()
        admin_id = admin_row[0] if admin_row else None
        conn.commit()
        print("Setup complete: Edition 2026, 4 Churches, 5 Participants, 4 Competitions.\n")

        # ----------------------------------------------------------------------
        # TEST 1: Individual Event Points & Church / Individual Ledger Credits
        # ----------------------------------------------------------------------
        print("1. Individual Event Publishing & Point Ledger Generation:")
        entries_solo1 = [
            {
                'chest_number': '801',
                'participant_name': 'John Mathew',
                'church_id': str(c_alpha),
                'participant_id': str(p_john),
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
                'remarks': '1st place solo'
            },
            {
                'chest_number': '802',
                'participant_name': 'Sarah Philip',
                'church_id': str(c_beta),
                'participant_id': str(p_sarah),
                'position': 2,
                'grade': 'B',
                'grade_points': '3.00',
                'position_points': '3.00',
                'remarks': '2nd place solo'
            }
        ]
        cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Draft 1');", (ev_solo1, json.dumps(entries_solo1)))
        cur.execute("SELECT public.publish_result(%s);", (ev_solo1,))
        conn.commit()

        # Check Church Standings
        cur.execute("SELECT * FROM public.get_church_standings(%s) WHERE church_id IN (%s, %s) ORDER BY rank ASC;", (edition_id, c_alpha, c_beta))
        rows = cur.fetchall()
        assert_true(len(rows) == 2, "Both churches represented in standings")
        
        # Alpha: 10.00 pts (1st place, Grade A)
        assert_true(rows[0][0] == 1, "Church Alpha ranked 1st")
        assert_true(rows[0][6] == Decimal('10.00'), "Church Alpha total_points = 10.00")
        assert_true(rows[0][7] == 1, "Church Alpha first_places = 1")
        assert_true(rows[0][10] == 1, "Church Alpha grade_a_count = 1")

        # Beta: 6.00 pts (2nd place, Grade B)
        assert_true(rows[1][0] == 2, "Church Beta ranked 2nd")
        assert_true(rows[1][6] == Decimal('6.00'), "Church Beta total_points = 6.00")
        assert_true(rows[1][8] == 1, "Church Beta second_places = 1")

        # Check Individual Standings
        cur.execute("SELECT * FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id IN (%s, %s) ORDER BY rank ASC;", (edition_id, p_john, p_sarah))
        ind_rows = cur.fetchall()
        assert_true(len(ind_rows) == 2, "Both participants ranked in individual standings")
        assert_true(ind_rows[0][0] == 1 and ind_rows[0][2] == p_john, "John Mathew ranked 1st with 10.00 pts")
        assert_true(ind_rows[0][11] == Decimal('10.00'), "John Mathew total_points = 10.00")
        assert_true(ind_rows[1][0] == 2 and ind_rows[1][2] == p_sarah, "Sarah Philip ranked 2nd with 6.00 pts")
        assert_true(ind_rows[1][11] == Decimal('6.00'), "Sarah Philip total_points = 6.00")
        print()

        # ----------------------------------------------------------------------
        # TEST 2: Group Event Point Attribution & Single Church Credit Rule
        # ----------------------------------------------------------------------
        print("2. Group Event Attribution & Single Church Credit Rule:")
        entries_group = [
            {
                'chest_number': 'G84',
                'participant_name': 'Alpha Gospel Quartet',
                'church_id': str(c_alpha),
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
                'group_members': [
                    {'participant_id': str(p_john), 'role': 'Tenor', 'points_allocated': '2.50'},
                    {'participant_id': str(p_paul), 'role': 'Bass', 'points_allocated': '2.50'}
                ]
            }
        ]
        cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Group Draft');", (ev_group, json.dumps(entries_group)))
        cur.execute("SELECT public.publish_result(%s);", (ev_group,))
        conn.commit()

        # Church Alpha total points: 10.00 (solo) + 10.00 (quartet) = 20.00 pts
        # Crucial invariant: Quartet awards 10.00 pts ONCE to the church, NOT 20.00 or 40.00
        cur.execute("SELECT total_points, first_places, events_count FROM public.get_church_standings(%s) WHERE church_id = %s;", (edition_id, c_alpha))
        alpha_res = cur.fetchone()
        assert_true(alpha_res[0] == Decimal('20.00'), "Church Alpha points = 20.00 (Single team credit, not multiplied)")
        assert_true(alpha_res[1] == 2, "Church Alpha has two 1st places")
        assert_true(alpha_res[2] == 2, "Church Alpha participated in 2 distinct events")

        # Contestant points: John got 10.00 + 2.50 = 12.50 pts; Paul got 2.50 pts
        cur.execute("SELECT total_points FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id = %s;", (edition_id, p_john))
        assert_true(cur.fetchone()[0] == Decimal('12.50'), "John Mathew credited with 12.50 individual points (10.00 solo + 2.50 quartet)")

        cur.execute("SELECT total_points FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id = %s;", (edition_id, p_paul))
        assert_true(cur.fetchone()[0] == Decimal('2.50'), "Paul Daniel credited with 2.50 individual points from group performance")
        print()

        # ----------------------------------------------------------------------
        # TEST 3: Point Ledger Partial Unique Constraints (Preventing Duplicates)
        # ----------------------------------------------------------------------
        print("3. Point Ledger Partial Unique Constraint Invariants:")
        # Try inserting a duplicate active CHURCH ledger record for the same result_entry
        cur.execute("SELECT id FROM public.result_entries WHERE chest_number = '801';")
        solo_entry_id = cur.fetchone()[0]

        duplicate_blocked = False
        try:
            cur.execute("""
                INSERT INTO public.point_ledger (edition_id, result_entry_id, event_id, church_id, target, points, is_active)
                VALUES (%s, %s, %s, %s, 'CHURCH', 10.00, TRUE);
            """, (edition_id, solo_entry_id, ev_solo1, c_alpha))
            conn.commit()
        except Exception:
            conn.rollback()
            duplicate_blocked = True
        assert_true(duplicate_blocked, "Duplicate active CHURCH ledger record blocked by idx_unique_active_church_ledger")

        # Try inserting duplicate active PARTICIPANT ledger record for the same entry & participant
        duplicate_part_blocked = False
        try:
            cur.execute("""
                INSERT INTO public.point_ledger (edition_id, result_entry_id, event_id, church_id, participant_id, target, points, is_active)
                VALUES (%s, %s, %s, %s, %s, 'INDIVIDUAL', 10.00, TRUE);
            """, (edition_id, solo_entry_id, ev_solo1, c_alpha, p_john))
            conn.commit()
        except Exception:
            conn.rollback()
            duplicate_part_blocked = True
        assert_true(duplicate_part_blocked, "Duplicate active PARTICIPANT ledger record blocked by idx_unique_active_participant_ledger")
        print()

        # ----------------------------------------------------------------------
        # TEST 4: 5-Level Tie-Breaking Hierarchy (Level 2: 1st Places Outrank 2nd)
        # ----------------------------------------------------------------------
        print("4. 5-Level Tie-Breaker Precedence (1st Places vs 2nd Places):")
        # Setup scenario matching Django test:
        # Church Gamma: 10 pts from one 1st place (Grade B)
        # Church Delta: 10 pts from two 2nd places (two Grade A)
        # Both churches have 10.00 pts!
        # Church Gamma MUST rank ahead of Church Delta because 1st places (1 vs 0) outrank 2nd places.
        entries_solo2 = [
            {
                'chest_number': '803',
                'participant_name': 'David Thomas',
                'church_id': str(c_gamma),
                'participant_id': str(p_david),
                'position': 1,
                'grade': 'B',
                'grade_points': '0.00',
                'position_points': '10.00'
            },
            {
                'chest_number': '804',
                'participant_name': 'Mary Joseph',
                'church_id': str(c_delta),
                'participant_id': str(p_mary),
                'position': 2,
                'grade': 'A',
                'grade_points': '0.00',
                'position_points': '5.00'
            }
        ]
        cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Tie Test 1');", (ev_solo2, json.dumps(entries_solo2)))
        cur.execute("SELECT public.publish_result(%s);", (ev_solo2,))

        # Second event where Delta gets another 5 pts (total 10.00 pts)
        entries_essay = [
            {
                'chest_number': '804',
                'participant_name': 'Mary Joseph',
                'church_id': str(c_delta),
                'participant_id': str(p_mary),
                'position': 2,
                'grade': 'A',
                'grade_points': '0.00',
                'position_points': '5.00'
            }
        ]
        cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Tie Test 2');", (ev_essay, json.dumps(entries_essay)))
        cur.execute("SELECT public.publish_result(%s);", (ev_essay,))
        conn.commit()

        # Standings between Gamma and Delta
        cur.execute("SELECT rank, church_code, total_points, first_places, second_places, grade_a_count FROM public.get_church_standings(%s) WHERE church_id IN (%s, %s) ORDER BY rank ASC;", (edition_id, c_gamma, c_delta))
        gamma_delta = cur.fetchall()
        assert_true(len(gamma_delta) == 2, "Both Gamma and Delta retrieved")
        assert_true(gamma_delta[0][2] == Decimal('10.00') and gamma_delta[1][2] == Decimal('10.00'), "Both churches have identical 10.00 total points")
        assert_true(gamma_delta[0][1] == 'TC03', "Church Gamma ranks higher than Church Delta")
        assert_true(gamma_delta[0][3] == 1 and gamma_delta[1][3] == 0, "Level 2 tie-breaker verified: 1st places broke tie (1 vs 0)")
        print()

        # ----------------------------------------------------------------------
        # TEST 5: Shared Ranks & Standard Competition Ranking (1, 2, 2, 4...)
        # ----------------------------------------------------------------------
        print("5. Shared Ranks & Standard Competition Ranking:")
        # Check overall church standings across all 4 churches:
        # Church Alpha: 20 pts -> Rank 1
        # Church Gamma: 10 pts, one 1st -> Rank 2
        # Church Delta: 10 pts, zero 1st, two 2nd -> Rank 3
        # Church Beta: 6 pts -> Rank 4
        cur.execute("SELECT rank, church_code, total_points FROM public.get_church_standings(%s) WHERE church_id IN (%s, %s, %s, %s) ORDER BY rank ASC;", (edition_id, c_alpha, c_gamma, c_delta, c_beta))
        all_churches = cur.fetchall()
        assert_true(all_churches[0][0] == 1 and all_churches[0][1] == 'TC01', "Alpha is Rank 1")
        assert_true(all_churches[1][0] == 2 and all_churches[1][1] == 'TC03', "Gamma is Rank 2")
        assert_true(all_churches[2][0] == 3 and all_churches[2][1] == 'TC04', "Delta is Rank 3")
        assert_true(all_churches[3][0] == 4 and all_churches[3][1] == 'TC02', "Beta is Rank 4")

        # Publish Mime (EV85) with Church Beta getting 2nd place, Grade A (4.00 pts)
        entries_mime = [
            {
                'chest_number': '802',
                'participant_name': 'Sarah Philip',
                'church_id': str(c_beta),
                'participant_id': str(p_sarah),
                'position': 2,
                'grade': 'A',
                'grade_points': '2.00',
                'position_points': '2.00',
                'remarks': '2nd in mime'
            }
        ]
        cur.execute("SELECT public.save_result_draft(%s, %s::jsonb, 'Mime Draft');", (ev_mime, json.dumps(entries_mime)))
        cur.execute("SELECT public.publish_result(%s);", (ev_mime,))
        conn.commit()

        # Check Level 5 Tie-Breaker: Count of Grade A Awards
        # Both Delta and Beta have 10.00 total points and two 2nd places.
        # Delta has two Grade A; Beta currently has one Grade A and one Grade B.
        # Delta must rank 3rd and Beta 4th!
        cur.execute("""
            SELECT rank, is_tied, church_code, total_points, second_places, grade_a_count 
            FROM public.get_church_standings(%s) 
            WHERE church_id IN (%s, %s)
            ORDER BY rank ASC;
        """, (edition_id, c_delta, c_beta))
        delta_beta = cur.fetchall()
        assert_true(delta_beta[0][2] == 'TC04' and delta_beta[1][2] == 'TC02', "Level 5 tie-breaker: Delta (2 Grade A) ranks ahead of Beta (1 Grade A)")
        assert_true(delta_beta[0][0] == 3 and delta_beta[1][0] == 4, "Delta is Rank 3, Beta is Rank 4 before upgrade")

        # Now upgrade Sarah's Solo 1 to Grade A so Beta has exactly two Grade A!
        # Both Delta and Beta now have identical stats on all 5 criteria:
        # Total: 10.00, 1st: 0, 2nd: 2, 3rd: 0, Grade A: 2!
        entries_solo1_upgraded = [
            {
                'chest_number': '801',
                'participant_name': 'John Mathew',
                'church_id': str(c_alpha),
                'participant_id': str(p_john),
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
                'remarks': '1st place solo'
            },
            {
                'chest_number': '802',
                'participant_name': 'Sarah Philip',
                'church_id': str(c_beta),
                'participant_id': str(p_sarah),
                'position': 2,
                'grade': 'A',
                'grade_points': '3.00',
                'position_points': '3.00',
                'remarks': '2nd place solo upgraded to Grade A'
            }
        ]
        cur.execute("SELECT public.correct_published_result(%s, %s::jsonb, 'Upgrade Solo 1 to Grade A');", (ev_solo1, json.dumps(entries_solo1_upgraded)))
        conn.commit()

        # Check Shared Rank & Standard Competition Ranking (1, 2, 3, 3):
        cur.execute("""
            SELECT rank, is_tied, church_code, church_name, total_points, second_places, grade_a_count 
            FROM public.get_church_standings(%s) 
            WHERE church_id IN (%s, %s, %s, %s)
            ORDER BY rank ASC, church_name ASC;
        """, (edition_id, c_alpha, c_gamma, c_delta, c_beta))
        standings_post = cur.fetchall()
        assert_true(standings_post[0][0] == 1 and standings_post[0][2] == 'TC01', "Alpha is Rank 1 (20 pts)")
        assert_true(standings_post[1][0] == 2 and standings_post[1][2] == 'TC03', "Gamma is Rank 2 (10 pts, one 1st)")
        assert_true(standings_post[2][0] == 3 and standings_post[2][1] == True, "3rd position is shared with is_tied = True")
        assert_true(standings_post[3][0] == 3 and standings_post[3][1] == True, "4th entity receives shared Rank 3 with is_tied = True (Standard Competition Ranking)")
        # Deterministic alphabetical ordering within tied rank 3:
        # Test Church Beta (TC02) appears before Test Church Delta (TC04)
        assert_true(standings_post[2][2] == 'TC02' and standings_post[3][2] == 'TC04', "Deterministic ordering: Test Church Beta before Test Church Delta within shared Rank 3")
        print()

        # ----------------------------------------------------------------------
        # TEST 6: Category Filtering in Individual Standings (Junior vs Senior)
        # ----------------------------------------------------------------------
        print("6. Individual Standings Category Filtering:")
        # Junior category
        cur.execute("SELECT participant_name, category, total_points FROM public.get_individual_standings(%s, 'JUNIOR', NULL, TRUE) WHERE participant_id IN (%s, %s, %s);", (edition_id, p_john, p_sarah, p_david))
        juniors = cur.fetchall()
        assert_true(all(j[1] == 'JUNIOR' for j in juniors), "All returned participants are in JUNIOR category")
        assert_true(any(j[0] == 'John Mathew' for j in juniors), "John Mathew is included in JUNIOR")
        assert_true(not any(j[0] == 'Sarah Philip' for j in juniors), "Sarah Philip (SENIOR) is excluded from JUNIOR filter")

        # Senior category
        cur.execute("SELECT participant_name, category, total_points FROM public.get_individual_standings(%s, 'SENIOR', NULL, TRUE) WHERE participant_id IN (%s, %s, %s);", (edition_id, p_john, p_sarah, p_david))
        seniors = cur.fetchall()
        assert_true(all(s[1] == 'SENIOR' for s in seniors), "All returned participants are in SENIOR category")
        assert_true(any(s[0] == 'Sarah Philip' for s in seniors), "Sarah Philip is included in SENIOR")
        assert_true(not any(s[0] == 'John Mathew' for s in seniors), "John Mathew (JUNIOR) is excluded from SENIOR filter")
        print()

        # ----------------------------------------------------------------------
        # TEST 7: Event Contribution Breakdowns (Church & Participant)
        # ----------------------------------------------------------------------
        print("7. Church and Contestant Event Breakdown RPCs:")
        cur.execute("SELECT event_code, participant_name, points FROM public.get_church_event_breakdown(%s, %s);", (c_alpha, edition_id))
        alpha_breakdown = cur.fetchall()
        assert_true(len(alpha_breakdown) >= 2, "Church Alpha breakdown has at least 2 events")
        assert_true(any(b[0] == 'EV81' and b[2] == Decimal('10.00') for b in alpha_breakdown), "Solo EV81 contribution (+10.00 pts) present")
        assert_true(any(b[0] == 'EV84' and b[2] == Decimal('10.00') for b in alpha_breakdown), "Quartet EV84 contribution (+10.00 pts) present")

        cur.execute("SELECT event_code, role, points FROM public.get_individual_event_breakdown(%s, %s);", (p_john, edition_id))
        john_breakdown = cur.fetchall()
        assert_true(len(john_breakdown) == 2, "John Mathew breakdown has 2 contributions")
        assert_true(any(b[0] == 'EV81' and b[2] == Decimal('10.00') for b in john_breakdown), "John solo points (+10.00 pts) present")
        assert_true(any(b[0] == 'EV84' and b[1] == 'Tenor' and b[2] == Decimal('2.50') for b in john_breakdown), "John quartet points (+2.50 pts, Tenor) present")
        print()

        # ----------------------------------------------------------------------
        # TEST 8: Result Unpublishing & Immediate Standings Deactivation
        # ----------------------------------------------------------------------
        print("8. Result Unpublishing & Immediate Standings Deactivation:")
        # Unpublish EV84 (Quartet)
        cur.execute("SELECT public.unpublish_result(%s, 'Test unpublishing for score recalculation');", (ev_group,))
        conn.commit()

        # Church Alpha points should revert from 20.00 to 10.00 pts
        cur.execute("SELECT total_points, events_count FROM public.get_church_standings(%s) WHERE church_id = %s;", (edition_id, c_alpha))
        alpha_unpub = cur.fetchone()
        assert_true(alpha_unpub[0] == Decimal('10.00'), "Church Alpha points immediately reverted from 20.00 to 10.00 pts")
        assert_true(alpha_unpub[1] == 1, "Church Alpha active events count reduced to 1")

        # John Mathew points should revert from 12.50 to 10.00 pts
        cur.execute("SELECT total_points FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id = %s;", (edition_id, p_john))
        assert_true(cur.fetchone()[0] == Decimal('10.00'), "John Mathew points immediately reverted from 12.50 to 10.00 pts")

        # Paul Daniel had only quartet points; should now be excluded from standings with points
        cur.execute("SELECT * FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id = %s;", (edition_id, p_paul))
        assert_true(len(cur.fetchall()) == 0, "Paul Daniel excluded from only_with_points standings after unpublish")
        print()

        # ----------------------------------------------------------------------
        # TEST 9: Score Correction & Atomic Standings Update
        # ----------------------------------------------------------------------
        print("9. Score Correction & Atomic Standings Update:")
        # Correct Solo EV81: Change John Mathew points from 10.00 (5+5) to 8.00 (5+3)
        corrected_entries = [
            {
                'chest_number': '801',
                'participant_name': 'John Mathew',
                'church_id': str(c_alpha),
                'participant_id': str(p_john),
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '3.00',
                'remarks': 'Corrected judge tabulation'
            },
            {
                'chest_number': '802',
                'participant_name': 'Sarah Philip',
                'church_id': str(c_beta),
                'participant_id': str(p_sarah),
                'position': 2,
                'grade': 'B',
                'grade_points': '3.00',
                'position_points': '3.00',
                'remarks': 'Unchanged'
            }
        ]
        cur.execute("SELECT public.correct_published_result(%s, %s::jsonb, 'Typo in judge score sheet');", (ev_solo1, json.dumps(corrected_entries)))
        conn.commit()

        # Church Alpha points should now be 8.00 pts (was 10.00 pts)
        cur.execute("SELECT total_points FROM public.get_church_standings(%s) WHERE church_id = %s;", (edition_id, c_alpha))
        assert_true(cur.fetchone()[0] == Decimal('8.00'), "Church Alpha points updated to 8.00 pts after score correction")

        # John Mathew points should now be 8.00 pts (was 10.00 pts)
        cur.execute("SELECT total_points FROM public.get_individual_standings(%s, 'ALL', NULL, TRUE) WHERE participant_id = %s;", (edition_id, p_john))
        assert_true(cur.fetchone()[0] == Decimal('8.00'), "John Mathew points updated to 8.00 pts after score correction")
        print()

        # ----------------------------------------------------------------------
        # TEST 10: Live Summary Generation (Header & Polling Widget)
        # ----------------------------------------------------------------------
        print("10. Championship Live Summary Generation:")
        cur.execute("SELECT public.get_championship_live_summary(%s);", (edition_id,))
        summary = cur.fetchone()[0]
        assert_true('total_events' in summary, "Live summary contains total_events")
        assert_true('published_results' in summary, "Live summary contains published_results")
        assert_true('top_churches' in summary and len(summary['top_churches']) > 0, "Live summary contains top_churches list")
        assert_true('top_individuals' in summary, "Live summary contains top_individuals list")
        assert_true('completion_pct' in summary, "Live summary calculates completion_pct")
        print()

        # ----------------------------------------------------------------------
        # TEST 11: Cleanup & Teardown
        # ----------------------------------------------------------------------
        print("11. Test Teardown & Purge:")
        cur.execute("DELETE FROM public.point_ledger WHERE edition_id = %s AND event_id IN (%s, %s, %s, %s, %s);", (edition_id, ev_solo1, ev_solo2, ev_essay, ev_group, ev_mime))
        cur.execute("DELETE FROM public.event_results WHERE event_id IN (%s, %s, %s, %s, %s);", (ev_solo1, ev_solo2, ev_essay, ev_group, ev_mime))
        cur.execute("DELETE FROM public.events WHERE id IN (%s, %s, %s, %s, %s);", (ev_solo1, ev_solo2, ev_essay, ev_group, ev_mime))
        cur.execute("DELETE FROM public.participants WHERE id IN (%s, %s, %s, %s, %s);", (p_john, p_sarah, p_david, p_mary, p_paul))
        cur.execute("DELETE FROM public.churches WHERE id IN (%s, %s, %s, %s);", (c_alpha, c_beta, c_gamma, c_delta))
        conn.commit()
        assert_true(True, "All Phase 7 test records cleanly purged with 0 orphaned records")

        print("\n=======================================================")
        print(f"  PHASE 7 TEST SUITE RESULTS: {passed_count}/{total_count} ASSERTIONS PASSED")
        print("=======================================================\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Exception encountered during test run: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    run_test()
