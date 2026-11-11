from decimal import Decimal
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import User
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.events.models import Edition, EventCategory, EventDivision, Event
from apps.results.models import EventResult, ResultEntry, ResultParticipant
from apps.results.services import ResultService
from apps.championships.models import PointLedger
from apps.championships.services import ChampionshipService

from django.core.cache import cache


class Phase5PublicAndChampionshipTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()

        # Users
        self.admin_user = User.objects.create_superuser(
            username="admin",
            password="adminpassword123",
            role=User.Role.SUPER_ADMIN
        )

        # Master Data
        self.edition = Edition.objects.create(name="ZIMRAH 2026", year=2026, is_active=True)
        self.cat_stage = EventCategory.objects.create(edition=self.edition, name="Stage Events")
        self.cat_literary = EventCategory.objects.create(edition=self.edition, name="Literary Events")

        self.div1 = EventDivision.objects.create(edition=self.edition, division_number=1, name="സംഗീതം")
        self.div4 = EventDivision.objects.create(edition=self.edition, division_number=4, name="രചന പ്രസംഗ മത്സരങ്ങൾ")

        # Churches
        self.church_a = Church.objects.create(name="St. Thomas CSI Church", code="STC01", district="Adoor Clergy District", is_active=True)
        self.church_b = Church.objects.create(name="Holy Trinity CSI Church", code="HTC02", district="Adoor Clergy District", is_active=True)
        self.church_c = Church.objects.create(name="St. Pauls CSI Church", code="SPC03", district="Adoor Clergy District", is_active=True)

        # Participants
        self.p_john = Participant.objects.create(
            edition=self.edition, church=self.church_a, chest_number="001", name="John Mathew",
            age_category=Participant.AgeCategory.JUNIOR, gender=Participant.Gender.MALE
        )
        self.p_sarah = Participant.objects.create(
            edition=self.edition, church=self.church_b, chest_number="002", name="Sarah Philip",
            age_category=Participant.AgeCategory.SENIOR, gender=Participant.Gender.FEMALE
        )
        self.p_david = Participant.objects.create(
            edition=self.edition, church=self.church_c, chest_number="003", name="David Thomas",
            age_category=Participant.AgeCategory.JUNIOR, gender=Participant.Gender.MALE
        )

        # Competitions: 1 Individual, 1 Group, 1 Literary
        self.event_solo = Event.objects.create(
            edition=self.edition, category=self.cat_stage, division=self.div1,
            code="EV01", name="Solo Song", name_malayalam="സോളോ",
            event_type=Event.EventType.INDIVIDUAL, contributes_to_individual=True
        )
        self.event_choir = Event.objects.create(
            edition=self.edition, category=self.cat_stage, division=self.div1,
            code="EV15", name="Group Choir", name_malayalam="ഗ്രൂപ്പ് ഗാനം",
            event_type=Event.EventType.GROUP, contributes_to_individual=False
        )
        self.event_essay = Event.objects.create(
            edition=self.edition, category=self.cat_literary, division=self.div4,
            code="EV29", name="Essay Writing", name_malayalam="പ്രബന്ധരചന",
            event_type=Event.EventType.INDIVIDUAL, contributes_to_individual=True
        )

    def test_single_winner_and_points_calculation(self):
        """Test publishing result for an individual event updates Church and Individual points."""
        entries_data = [
            {
                'position': 1,
                'chest_number': '001',
                'participant_name': 'John Mathew',
                'church': self.church_a.id,
                'participant': self.p_john.id,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
            },
            {
                'position': 2,
                'chest_number': '002',
                'participant_name': 'Sarah Philip',
                'church': self.church_b.id,
                'participant': self.p_sarah.id,
                'grade': 'B',
                'grade_points': '3.00',
                'position_points': '3.00',
            }
        ]
        draft = ResultService.save_result_draft(self.event_solo, entries_data, user=self.admin_user)
        ResultService.publish_result(draft, user=self.admin_user)

        # Church Standings Check
        church_standings = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(church_standings[0]['church_name'], "St. Thomas CSI Church")
        self.assertEqual(church_standings[0]['total_points'], Decimal('10.00'))
        self.assertEqual(church_standings[0]['rank'], 1)

        self.assertEqual(church_standings[1]['church_name'], "Holy Trinity CSI Church")
        self.assertEqual(church_standings[1]['total_points'], Decimal('6.00'))
        self.assertEqual(church_standings[1]['rank'], 2)

        # Individual Standings Check
        ind_standings = ChampionshipService.get_individual_standings(edition=self.edition)
        self.assertEqual(ind_standings[0]['participant_name'], "John Mathew")
        self.assertEqual(ind_standings[0]['total_points'], Decimal('10.00'))
        self.assertEqual(ind_standings[0]['rank'], 1)

    def test_group_points_do_not_inflate_individual_scores(self):
        """
        Verify group event points belong strictly to the Church and do not inflate
        individual contestant leaderboard scores.
        """
        entries_data = [
            {
                'position': 1,
                'chest_number': 'GRP-01',
                'participant_name': 'Adoor Parish Choir',
                'church': self.church_a.id,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '10.00',
                'group_members': [
                    {'participant': self.p_john.id, 'role': 'Lead Vocalist', 'points_allocated': '0.00'}
                ]
            }
        ]
        draft = ResultService.save_result_draft(self.event_choir, entries_data, user=self.admin_user)
        ResultService.publish_result(draft, user=self.admin_user)

        # Church gets the 15.00 points
        church_standings = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(church_standings[0]['church_name'], "St. Thomas CSI Church")
        self.assertEqual(church_standings[0]['total_points'], Decimal('15.00'))

        # John Mathew must have 0.00 points in Individual Championship because group points belong to church
        ind_standings = ChampionshipService.get_individual_standings(edition=self.edition)
        john_score = next(p for p in ind_standings if p['participant_name'] == "John Mathew")
        self.assertEqual(john_score['total_points'], Decimal('0.00'))

    def test_tie_breaking_hierarchy(self):
        """
        Test tie resolution: Total Points -> 1st Places -> 2nd Places -> 3rd Places -> Grade A -> Equal Rank.
        Church A: 10 pts (one 1st place, Grade B)
        Church B: 10 pts (two 2nd places, two Grade A)
        Church A must rank higher than Church B because 1st places outrank 2nd places.
        """
        # Event 1: Solo Song -> Church A wins 1st (10 pts)
        entries_solo = [
            {
                'position': 1,
                'chest_number': '001',
                'participant_name': 'John Mathew',
                'church': self.church_a.id,
                'participant': self.p_john.id,
                'grade': 'B',
                'grade_points': '0.00',
                'position_points': '10.00',
            }
        ]
        r1 = ResultService.save_result_draft(self.event_solo, entries_solo, user=self.admin_user)
        ResultService.publish_result(r1, user=self.admin_user)

        # Event 2: Essay Writing -> Church B gets 2nd (5 pts)
        entries_essay = [
            {
                'position': 2,
                'chest_number': '002',
                'participant_name': 'Sarah Philip',
                'church': self.church_b.id,
                'participant': self.p_sarah.id,
                'grade': 'A',
                'grade_points': '0.00',
                'position_points': '5.00',
            }
        ]
        r2 = ResultService.save_result_draft(self.event_essay, entries_essay, user=self.admin_user)
        ResultService.publish_result(r2, user=self.admin_user)

        # Event 3: Group Choir -> Church B gets 2nd (5 pts)
        entries_choir = [
            {
                'position': 2,
                'chest_number': 'GRP-02',
                'participant_name': 'Trinity Choir',
                'church': self.church_b.id,
                'grade': 'A',
                'grade_points': '0.00',
                'position_points': '5.00',
            }
        ]
        r3 = ResultService.save_result_draft(self.event_choir, entries_choir, user=self.admin_user)
        ResultService.publish_result(r3, user=self.admin_user)

        # Both Church A and Church B have 10.00 total points!
        # Church A has one 1st place, Church B has zero 1st places.
        standings = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(standings[0]['church_name'], "St. Thomas CSI Church")
        self.assertEqual(standings[0]['rank'], 1)
        self.assertEqual(standings[0]['total_points'], Decimal('10.00'))
        self.assertEqual(standings[0]['first_places'], 1)

        self.assertEqual(standings[1]['church_name'], "Holy Trinity CSI Church")
        self.assertEqual(standings[1]['rank'], 2)
        self.assertEqual(standings[1]['total_points'], Decimal('10.00'))
        self.assertEqual(standings[1]['first_places'], 0)

    def test_public_homepage(self):
        """Test homepage loads with festival branding, summary, and response 200."""
        response = self.client.get(reverse('public_home'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "ZIMRAH 2026")
        self.assertContains(response, "Song of Praise")
        self.assertContains(response, "Thazhathmon")
        self.assertContains(response, "Munroethuruth")
        self.assertContains(response, "Church Championship")
        self.assertContains(response, "Individual Championship")

    def test_public_results_list(self):
        """Test public results list loads with 34 events, category/division filters."""
        response = self.client.get(reverse('public_results_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "EV01")
        self.assertContains(response, "EV15")
        self.assertContains(response, "EV29")

        # Test filter by category
        response_stage = self.client.get(reverse('public_results_list') + f"?category={self.cat_stage.id}")
        self.assertEqual(response_stage.status_code, 200)
        self.assertContains(response_stage, "EV01")
        self.assertNotContains(response_stage, "EV29")

    def test_public_result_detail_published_and_awaited(self):
        """Test result detail shows 'Results Awaited' when unpublished and full scorecard when published."""
        # 1. Unpublished Event
        response_awaited = self.client.get(reverse('public_result_detail', kwargs={'code': 'EV01'}))
        self.assertEqual(response_awaited.status_code, 200)
        self.assertContains(response_awaited, "Results Awaited")
        self.assertContains(response_awaited, "Listening for live publication updates")

        # 2. Publish Event
        entries_data = [
            {
                'position': 1,
                'chest_number': '001',
                'participant_name': 'John Mathew',
                'church': self.church_a.id,
                'participant': self.p_john.id,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
            }
        ]
        draft = ResultService.save_result_draft(self.event_solo, entries_data, user=self.admin_user)
        ResultService.publish_result(draft, user=self.admin_user)

        # 3. View Published Scorecard
        response_pub = self.client.get(reverse('public_result_detail', kwargs={'code': 'EV01'}))
        self.assertEqual(response_pub.status_code, 200)
        self.assertContains(response_pub, "Result Published")
        self.assertContains(response_pub, "John Mathew")
        self.assertContains(response_pub, "10.00 pts")
        self.assertContains(response_pub, "Winners Podium")

    def test_public_championship_pages(self):
        """Test public Church and Individual championship views."""
        # Church Championship
        resp_church = self.client.get(reverse('public_church_championship'))
        self.assertEqual(resp_church.status_code, 200)
        self.assertContains(resp_church, "Church Championship")
        self.assertContains(resp_church, "St. Thomas CSI Church")

        # Individual Championship
        resp_ind = self.client.get(reverse('public_individual_championship'))
        self.assertEqual(resp_ind.status_code, 200)
        self.assertContains(resp_ind, "Individual Championship")
        self.assertContains(resp_ind, "Kalathilakam")

    def test_public_search(self):
        """Test search by chest number, name, event, and church."""
        # Search chest number
        resp = self.client.get(reverse('public_search') + "?q=001")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "John Mathew")

        # Search event code
        resp_ev = self.client.get(reverse('public_search') + "?q=EV01")
        self.assertEqual(resp_ev.status_code, 200)
        self.assertContains(resp_ev, "സോളോ")

    def test_pwa_endpoints(self):
        """Test PWA manifest and service worker URLs return valid headers and content."""
        resp_manifest = self.client.get(reverse('pwa_manifest'))
        self.assertEqual(resp_manifest.status_code, 200)
        self.assertIn("application/manifest+json", resp_manifest['Content-Type'])
        self.assertContains(resp_manifest, "ZIMRAH 2026")

        resp_sw = self.client.get(reverse('pwa_service_worker'))
        self.assertEqual(resp_sw.status_code, 200)
        self.assertIn("application/javascript", resp_sw['Content-Type'])
        self.assertEqual(resp_sw['Service-Worker-Allowed'], '/')

    def test_championship_and_live_apis(self):
        """Test championship REST API endpoints."""
        # Church API
        resp_c = self.client.get(reverse('api_championship_church'))
        self.assertEqual(resp_c.status_code, 200)
        self.assertIn('results', resp_c.data)

        # Individual API
        resp_i = self.client.get(reverse('api_championship_individual'))
        self.assertEqual(resp_i.status_code, 200)
        self.assertIn('results', resp_i.data)

        # Live Summary API
        resp_live = self.client.get(reverse('api_live_summary'))
        self.assertEqual(resp_live.status_code, 200)
        self.assertIn('total_events', resp_live.data)
        self.assertIn('published_results', resp_live.data)
