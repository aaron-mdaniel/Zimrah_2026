from decimal import Decimal
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

from apps.events.models import Edition, EventCategory, EventDivision, EventSection, Event
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.registrations.models import Registration
from apps.results.models import EventResult, ResultEntry, ResultParticipant
from apps.results.services import ResultService
from apps.championships.models import PointLedger
from apps.audit.models import AuditLog

User = get_user_model()


class ZimrahPhase3ResultTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Users with distinct roles
        self.super_admin = User.objects.create_user(
            username='super_admin',
            password='Password123!',
            role=User.Role.SUPER_ADMIN,
            is_staff=True
        )
        self.result_admin = User.objects.create_user(
            username='result_admin',
            password='Password123!',
            role=User.Role.RESULT_ADMIN,
            is_staff=True
        )
        self.publisher = User.objects.create_user(
            username='publisher_officer',
            password='Password123!',
            role=User.Role.PUBLISHER,
            is_staff=True
        )

        # Festival Edition
        self.edition = Edition.objects.create(
            year=2026,
            name="ZIMRAH 2026",
            theme="Song of Praise",
            is_active=True
        )

        # Churches
        self.church1 = Church.objects.create(
            code="CH01",
            name="St. Mathias CSI Church, Munroethuruth",
            district="Adoor Clergy District",
            is_active=True
        )
        self.church2 = Church.objects.create(
            code="CH02",
            name="Holy Trinity CSI Church, Adoor",
            district="Adoor Clergy District",
            is_active=True
        )

        # Event Categories & Divisions
        self.cat_stage = EventCategory.objects.create(
            edition=self.edition,
            name="Stage Events",
            name_malayalam="സ്റ്റേജ് മത്സരങ്ങൾ"
        )
        self.div_music = EventDivision.objects.create(
            edition=self.edition,
            division_number=1,
            name="Music",
            name_malayalam="സംഗീതം"
        )
        self.sec_open = EventSection.objects.create(
            edition=self.edition,
            code="OPEN",
            name="Open",
            name_malayalam="പൊതു വിഭാഗം"
        )

        # Individual Event (Solo Eastern)
        self.event_solo = Event.objects.create(
            edition=self.edition,
            code="EV01",
            name="Solo Eastern - Junior Boys",
            name_malayalam="സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്",
            category=self.cat_stage,
            division=self.div_music,
            section=self.sec_open,
            event_type=Event.EventType.INDIVIDUAL,
            contributes_to_individual=True,
            contributes_to_church=True
        )

        # Group Event (Quartet - 4 members)
        self.event_quartet = Event.objects.create(
            edition=self.edition,
            code="EV16",
            name="Quartet",
            name_malayalam="ക്വാർട്ടറ്റ്",
            category=self.cat_stage,
            division=self.div_music,
            section=self.sec_open,
            event_type=Event.EventType.GROUP,
            min_participants=4,
            max_participants=4,
            contributes_to_individual=False,
            contributes_to_church=True
        )

        # Participants
        self.p1 = Participant.objects.create(
            edition=self.edition,
            chest_number="001",
            name="Aaron Samuel",
            gender="M",
            church=self.church1,
            age_category="JUNIOR"
        )
        self.p2 = Participant.objects.create(
            edition=self.edition,
            chest_number="002",
            name="Joel Mathew",
            gender="M",
            church=self.church1,
            age_category="JUNIOR"
        )
        self.p3 = Participant.objects.create(
            edition=self.edition,
            chest_number="003",
            name="Titus George",
            gender="M",
            church=self.church1,
            age_category="JUNIOR"
        )
        self.p4 = Participant.objects.create(
            edition=self.edition,
            chest_number="004",
            name="Kiran Varghese",
            gender="M",
            church=self.church1,
            age_category="JUNIOR"
        )
        self.p_adoor = Participant.objects.create(
            edition=self.edition,
            chest_number="010",
            name="Mathew Thomas",
            gender="M",
            church=self.church2,
            age_category="JUNIOR"
        )

    # 1. Result Creation & Backend Calculation Security Tests
    def test_backend_recalculates_total_points(self):
        """Verify server re-computes total_points and never trusts client total_points."""
        entries_data = [
            {
                'chest_number': '001',
                'participant_name': 'Aaron Samuel',
                'church_id': self.church1.id,
                'participant_id': self.p1.id,
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '3.00',
                'total_points': '999.00',  # Malicious / manipulated client value
            }
        ]

        result = ResultService.save_result_draft(
            event=self.event_solo,
            entries_data=entries_data,
            user=self.result_admin
        )

        entry = result.entries.first()
        # Backend recalculated: 5.00 + 3.00 = 8.00 (not 999.00)
        self.assertEqual(entry.total_points, Decimal('8.00'))
        self.assertEqual(entry.grade_points, Decimal('5.00'))
        self.assertEqual(entry.position_points, Decimal('3.00'))
        self.assertEqual(result.status, EventResult.Status.DRAFT)

    def test_decimal_precision_scoring(self):
        """Verifies fractional scores like 3.50 + 2.25 = 5.75 without float drift."""
        entries_data = [
            {
                'chest_number': '001',
                'participant_name': 'Aaron Samuel',
                'church_id': self.church1.id,
                'participant_id': self.p1.id,
                'position': 2,
                'grade': 'B',
                'grade_points': '3.50',
                'position_points': '2.25',
            }
        ]
        result = ResultService.save_result_draft(
            event=self.event_solo,
            entries_data=entries_data,
            user=self.result_admin
        )
        entry = result.entries.first()
        self.assertEqual(entry.total_points, Decimal('5.75'))

    # 2. Publishing Workflow Tests
    def test_publish_workflow_creates_point_ledger(self):
        """Verifies draft -> publish lifecycle and Point Ledger creation."""
        entries_data = [
            {
                'chest_number': '001',
                'participant_name': 'Aaron Samuel',
                'church_id': self.church1.id,
                'participant_id': self.p1.id,
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
            },
            {
                'chest_number': '010',
                'participant_name': 'Mathew Thomas',
                'church_id': self.church2.id,
                'participant_id': self.p_adoor.id,
                'position': 2,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '3.00',
            }
        ]

        result = ResultService.save_result_draft(
            event=self.event_solo,
            entries_data=entries_data,
            user=self.result_admin
        )

        # Draft has no active point ledger entries
        self.assertEqual(PointLedger.objects.filter(is_active=True).count(), 0)

        # Publish result
        published_result = ResultService.publish_result(result, user=self.publisher)
        self.assertEqual(published_result.status, EventResult.Status.PUBLISHED)
        self.assertEqual(published_result.published_by, self.publisher)
        self.assertIsNotNone(published_result.published_at)

        # Check Point Ledger
        church_ledgers = PointLedger.objects.filter(target=PointLedger.Target.CHURCH, is_active=True)
        indiv_ledgers = PointLedger.objects.filter(target=PointLedger.Target.INDIVIDUAL, is_active=True)

        self.assertEqual(church_ledgers.count(), 2)
        self.assertEqual(indiv_ledgers.count(), 2)

        # Verify Aaron's Church points: 10.00
        ch1_points = church_ledgers.get(church=self.church1).points
        self.assertEqual(ch1_points, Decimal('10.00'))

        # Verify Aaron's Individual points: 10.00
        p1_points = indiv_ledgers.get(participant=self.p1).points
        self.assertEqual(p1_points, Decimal('10.00'))

    def test_duplicate_publication_prevention(self):
        """Publishing an already published result raises ValidationError."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        # Second publish call should raise ValidationError
        with self.assertRaises(ValidationError):
            ResultService.publish_result(result, user=self.publisher)

    def test_unpublish_deactivates_point_ledger(self):
        """Unpublishing reverts status to DRAFT and deactivates all ledger points."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        self.assertEqual(PointLedger.objects.filter(is_active=True).count(), 2)

        # Unpublish
        ResultService.unpublish_result(result, user=self.publisher, reason="Judge scrutiny")
        self.assertEqual(result.status, EventResult.Status.DRAFT)
        self.assertIsNone(result.published_at)

        # Active ledger points are now 0
        self.assertEqual(PointLedger.objects.filter(is_active=True).count(), 0)

        # Audit log created
        self.assertTrue(AuditLog.objects.filter(action='RESULT_UNPUBLISHED').exists())

    # 3. Group Result & Single Church Credit Tests
    def test_group_result_awards_church_points_only_once(self):
        """Group event awards church points exactly once, never multiplied by member count."""
        entries_data = [
            {
                'chest_number': 'Q01',
                'participant_name': 'Munroethuruth Quartet Team',
                'church_id': self.church1.id,
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
                'group_members': [
                    {'participant_id': self.p1.id, 'role': 'Tenor', 'points_allocated': '0.00'},
                    {'participant_id': self.p2.id, 'role': 'Lead', 'points_allocated': '0.00'},
                    {'participant_id': self.p3.id, 'role': 'Baritone', 'points_allocated': '0.00'},
                    {'participant_id': self.p4.id, 'role': 'Bass', 'points_allocated': '0.00'},
                ]
            }
        ]

        result = ResultService.save_result_draft(self.event_quartet, entries_data, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        # Church championship points for church1 should be exactly 10.00 (not 4 x 10 = 40.00)
        church_ledgers = PointLedger.objects.filter(church=self.church1, target=PointLedger.Target.CHURCH, is_active=True)
        self.assertEqual(church_ledgers.count(), 1)
        self.assertEqual(church_ledgers.first().points, Decimal('10.00'))

        # Individual championship ledger entries for this group event should be 0 because points_allocated is 0.00
        indiv_ledgers = PointLedger.objects.filter(result_entry__event_result=result, target=PointLedger.Target.INDIVIDUAL, is_active=True)
        self.assertEqual(indiv_ledgers.count(), 0)

    def test_group_result_with_custom_individual_allocation(self):
        """Configurable individual points are credited to each specified participant."""
        entries_data = [
            {
                'chest_number': 'Q01',
                'participant_name': 'Munroethuruth Quartet Team',
                'church_id': self.church1.id,
                'position': 1,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
                'group_members': [
                    {'participant_id': self.p1.id, 'role': 'Tenor', 'points_allocated': '2.50'},
                    {'participant_id': self.p2.id, 'role': 'Lead', 'points_allocated': '2.50'},
                ]
            }
        ]
        result = ResultService.save_result_draft(self.event_quartet, entries_data, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        indiv_ledgers = PointLedger.objects.filter(result_entry__event_result=result, target=PointLedger.Target.INDIVIDUAL, is_active=True)
        self.assertEqual(indiv_ledgers.count(), 2)
        self.assertEqual(indiv_ledgers.first().points, Decimal('2.50'))

    # 4. Score Correction & Audit History Tests
    def test_correct_published_result_updates_ledger_atomically(self):
        """Correcting a published result modifies scores, replaces ledger points, and audits changes."""
        initial_entries = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'position': 1,
            'grade': 'A',
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, initial_entries, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        self.assertEqual(PointLedger.objects.filter(is_active=True, church=self.church1, target=PointLedger.Target.CHURCH).first().points, Decimal('10.00'))

        # Correct scores: change position to 2nd (Position points 3.00, total = 8.00)
        corrected_entries = [{
            'id': result.entries.first().id,
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'position': 2,
            'grade': 'A',
            'grade_points': '5.00',
            'position_points': '3.00'
        }]

        ResultService.correct_published_result(
            event_result=result,
            new_entries_data=corrected_entries,
            user=self.super_admin,
            reason="Clerical error correction"
        )

        # Check that active points for church1 is now 8.00
        active_ledger = PointLedger.objects.filter(is_active=True, church=self.church1, target=PointLedger.Target.CHURCH).first()
        self.assertEqual(active_ledger.points, Decimal('8.00'))

        # Check Audit log
        correction_log = AuditLog.objects.filter(action='RESULT_CORRECTED').first()
        self.assertIsNotNone(correction_log)
        self.assertEqual(correction_log.changes['reason'], "Clerical error correction")
        self.assertEqual(correction_log.changes['old_scores']['001']['total_points'], '10.00')
        self.assertEqual(correction_log.changes['new_scores']['001']['total_points'], '8.00')

    # 5. Authorization & Role Tests
    def test_result_admin_cannot_publish_result(self):
        """Result Admin role cannot trigger publication."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)

        self.client.login(username='result_admin', password='Password123!')
        resp = self.client.post(reverse('portal_result_publish', kwargs={'event_id': self.event_solo.id}))
        # Redirected with denial
        self.assertEqual(resp.status_code, 302)
        result.refresh_from_db()
        self.assertEqual(result.status, EventResult.Status.DRAFT)

    def test_publisher_can_publish_result(self):
        """Publisher role can successfully publish."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)

        self.client.login(username='publisher_officer', password='Password123!')
        resp = self.client.post(reverse('portal_result_publish', kwargs={'event_id': self.event_solo.id}))
        self.assertEqual(resp.status_code, 302)
        result.refresh_from_db()
        self.assertEqual(result.status, EventResult.Status.PUBLISHED)

    # 6. REST API Tests (Future Android App)
    def test_public_rest_api_returns_only_published_results(self):
        """REST API returns published results and excludes drafts."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)

        # While DRAFT, API returns 0 results
        resp_draft = self.client.get(reverse('api_results_list'))
        self.assertEqual(resp_draft.status_code, 200)
        self.assertEqual(len(resp_draft.json()['results']), 0)

        # After publish, API returns 1 result
        ResultService.publish_result(result, user=self.publisher)
        resp_pub = self.client.get(reverse('api_results_list'))
        self.assertEqual(resp_pub.status_code, 200)
        self.assertEqual(len(resp_pub.json()['results']), 1)
        self.assertEqual(resp_pub.json()['results'][0]['event_code'], 'EV01')

    def test_public_rest_api_detail_view(self):
        """REST API detail endpoint returns complete published scorecard."""
        entries_data = [{
            'chest_number': '001',
            'participant_name': 'Aaron Samuel',
            'church_id': self.church1.id,
            'participant_id': self.p1.id,
            'grade_points': '5.00',
            'position_points': '5.00'
        }]
        result = ResultService.save_result_draft(self.event_solo, entries_data, user=self.result_admin)
        ResultService.publish_result(result, user=self.publisher)

        resp = self.client.get(reverse('api_results_detail', kwargs={'code': 'EV01'}))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['event_code'], 'EV01')
        self.assertEqual(resp.json()['entries'][0]['total_points'], '10.00')
