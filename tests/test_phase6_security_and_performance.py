from decimal import Decimal
from django.test import TestCase, Client, override_settings
from django.urls import reverse

from apps.accounts.models import User
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.events.models import Edition, EventCategory, EventDivision, Event
from apps.results.models import EventResult, ResultEntry
from apps.results.services import ResultService
from apps.championships.services import ChampionshipService
from zimrah.cache_service import CacheService


class Phase6SecurityAndPerformanceTestCase(TestCase):
    def setUp(self):
        self.client = Client()

        # Regular non-admin user
        self.regular_user = User.objects.create_user(
            username="viewer",
            password="userpassword123"
        )

        # Admin user
        self.admin_user = User.objects.create_superuser(
            username="admin",
            password="adminpassword123",
            role=User.Role.SUPER_ADMIN
        )

        # Master Data
        self.edition = Edition.objects.create(name="ZIMRAH 2026", year=2026, is_active=True)
        self.cat_stage = EventCategory.objects.create(edition=self.edition, name="Stage Events")
        self.div1 = EventDivision.objects.create(edition=self.edition, division_number=1, name="സംഗീതം")

        self.church = Church.objects.create(name="St. Thomas CSI Church", code="STC01", district="Adoor", is_active=True)
        self.participant = Participant.objects.create(
            edition=self.edition, church=self.church, chest_number="001", name="John Mathew",
            age_category=Participant.AgeCategory.JUNIOR, gender=Participant.Gender.MALE
        )

        self.event = Event.objects.create(
            edition=self.edition, category=self.cat_stage, division=self.div1,
            code="EV01", name="Solo Song", name_malayalam="സോളോ",
            event_type=Event.EventType.INDIVIDUAL, contributes_to_individual=True
        )

    def test_unauthorized_admin_portal_access_blocked(self):
        """Verify unauthenticated requests to portal endpoints redirect to login."""
        endpoints = [
            reverse('portal_dashboard'),
            reverse('portal_result_list'),
            reverse('portal_church_list'),
            reverse('portal_participant_list'),
            reverse('portal_registration_list'),
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302, f"Failed for {url}")
            self.assertIn('/portal/login/', response.url)

    def test_draft_results_not_exposed_to_public(self):
        """Verify that draft event results are NEVER exposed to the public or APIs."""
        entries_data = [
            {
                'position': 1,
                'chest_number': '001',
                'participant_name': 'John Mathew',
                'church': self.church.id,
                'participant': self.participant.id,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
            }
        ]
        # Create draft but DO NOT publish
        draft = ResultService.save_result_draft(self.event, entries_data, user=self.admin_user)
        self.assertEqual(draft.status, EventResult.Status.DRAFT)

        # 1. Public Event Detail should display 'Results Awaited'
        resp_detail = self.client.get(reverse('public_result_detail', kwargs={'code': 'EV01'}))
        self.assertEqual(resp_detail.status_code, 200)
        self.assertContains(resp_detail, "Results Awaited")
        self.assertNotContains(resp_detail, "Winners Podium")
        self.assertNotContains(resp_detail, "Official Scorecard")

        # 2. Public Results API should return 404 (not published)
        resp_api_detail = self.client.get(reverse('api_results_detail', kwargs={'code': 'EV01'}))
        self.assertEqual(resp_api_detail.status_code, 404)

        # 3. Championship Points must be 0.00
        standings = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(standings[0]['total_points'], Decimal('0.00'))

    def test_security_headers_present(self):
        """Verify security headers (CSP, nosniff, frame-ancestors, X-Frame-Options) are applied."""
        response = self.client.get(reverse('public_home'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('Content-Security-Policy', response.headers)
        self.assertIn("default-src 'self'", response.headers['Content-Security-Policy'])
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('X-Frame-Options'), 'DENY')
        self.assertEqual(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')

    def test_sql_injection_resilience(self):
        """Verify search handles SQL injection attempts safely."""
        malicious_inputs = [
            "' OR '1'='1",
            "'; DROP TABLE events_event; --",
            "\" UNION SELECT username, password FROM accounts_user --",
            "<script>alert('XSS')</script>",
        ]
        for query in malicious_inputs:
            resp = self.client.get(reverse('public_search') + f"?q={query}")
            self.assertEqual(resp.status_code, 200)
            # Event table must still exist and be intact
            self.assertTrue(Event.objects.exists())

    def test_cache_service_and_atomic_invalidation(self):
        """Verify generation-based caching and instant cache invalidation on result publishing."""
        CacheService.invalidate_all()
        gen_initial = CacheService.get_generation()

        # Set a test key
        CacheService.set("test_ns", "key1", "Initial Cached Value", timeout=60)
        self.assertEqual(CacheService.get("test_ns", "key1"), "Initial Cached Value")

        # Invalidate
        CacheService.invalidate_all()
        gen_after = CacheService.get_generation()
        self.assertGreater(gen_after, gen_initial)

        # After invalidation, old key must return None (cache bust)
        self.assertIsNone(CacheService.get("test_ns", "key1"))

    def test_publish_unpublish_invalidates_championship_cache(self):
        """Verify publishing and unpublishing triggers cache purging."""
        # 1. Warm church standings cache (0.00 pts)
        standings_before = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(standings_before[0]['total_points'], Decimal('0.00'))

        # 2. Publish results -> automatically calls CacheService.invalidate_all()
        entries_data = [
            {
                'position': 1,
                'chest_number': '001',
                'participant_name': 'John Mathew',
                'church': self.church.id,
                'participant': self.participant.id,
                'grade': 'A',
                'grade_points': '5.00',
                'position_points': '5.00',
            }
        ]
        draft = ResultService.save_result_draft(self.event, entries_data, user=self.admin_user)
        ResultService.publish_result(draft, user=self.admin_user)

        # 3. Fresh standings must reflect 10.00 pts immediately (no stale cache)
        standings_after = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(standings_after[0]['total_points'], Decimal('10.00'))

        # 4. Unpublish results -> automatically calls CacheService.invalidate_all()
        ResultService.unpublish_result(draft, user=self.admin_user, reason="Score re-verification")

        # 5. Standings must revert to 0.00 pts immediately
        standings_reverted = ChampionshipService.get_church_standings(edition=self.edition)
        self.assertEqual(standings_reverted[0]['total_points'], Decimal('0.00'))

    def test_query_efficiency_no_n_plus_one(self):
        """Verify results directory query count remains constant regardless of entries count."""
        # Fixed query count (5 queries: Edition, Count, Divisions, Categories, Events+Joins) - Zero N+1
        with self.assertNumQueries(5):
            response = self.client.get(reverse('public_results_list'))
            self.assertEqual(response.status_code, 200)
