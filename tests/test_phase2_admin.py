import io
from django.test import TestCase, Client
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model

from apps.churches.models import Church
from apps.participants.models import Participant
from apps.events.models import Edition, EventCategory, EventDivision, EventSection, Event
from apps.registrations.models import Registration, GroupRegistrationMember
from apps.audit.models import AuditLog

User = get_user_model()


class ZimrahPhase2AdminTests(TestCase):
    def setUp(self):
        self.client = Client()

        # Users with distinct roles
        self.super_admin = User.objects.create_user(
            username='super_boss',
            password='Password123!',
            role=User.Role.SUPER_ADMIN,
            is_staff=True
        )
        self.result_admin = User.objects.create_user(
            username='result_officer',
            password='Password123!',
            role=User.Role.RESULT_ADMIN,
            is_staff=True
        )
        self.publisher = User.objects.create_user(
            username='publisher_user',
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
        self.church_munro = Church.objects.create(
            code="CH01",
            name="St. Mathias CSI Church, Munroethuruth",
            name_malayalam="സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്",
            district="Adoor Clergy District",
            is_active=True
        )
        self.church_adoor = Church.objects.create(
            code="CH02",
            name="Holy Trinity CSI Church, Adoor",
            name_malayalam="ഹോളി ട്രിനിറ്റി സി.എസ്.ഐ ചർച്ച്, അടൂർ",
            district="Adoor Clergy District",
            is_active=True
        )

        # Event Hierarchy
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
        self.sec_jb = EventSection.objects.create(
            edition=self.edition,
            code="JB",
            name="Junior Boys",
            name_malayalam="ജൂനിയർ ബോയ്സ്"
        )

        # Events
        self.event_solo = Event.objects.create(
            edition=self.edition,
            code="EV01",
            name="Solo Eastern - Junior Boys",
            name_malayalam="സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്",
            category=self.cat_stage,
            division=self.div_music,
            section=self.sec_jb,
            event_type=Event.EventType.INDIVIDUAL,
            min_participants=1,
            max_participants=1
        )
        self.event_quartet = Event.objects.create(
            edition=self.edition,
            code="EV16",
            name="Quartet",
            name_malayalam="ക്വാർട്ടറ്റ്",
            category=self.cat_stage,
            division=self.div_music,
            event_type=Event.EventType.GROUP,
            min_participants=4,
            max_participants=4
        )

        # Participants with leading zeros
        self.p1 = Participant.objects.create(
            edition=self.edition,
            chest_number="001",
            name="Aaron Samuel",
            gender="M",
            church=self.church_munro,
            age_category="JUNIOR"
        )
        self.p2 = Participant.objects.create(
            edition=self.edition,
            chest_number="002",
            name="Joel Mathew",
            gender="M",
            church=self.church_munro,
            age_category="JUNIOR"
        )
        self.p3 = Participant.objects.create(
            edition=self.edition,
            chest_number="003",
            name="Titus George",
            gender="M",
            church=self.church_munro,
            age_category="JUNIOR"
        )
        self.p4 = Participant.objects.create(
            edition=self.edition,
            chest_number="004",
            name="Kiran Varghese",
            gender="M",
            church=self.church_munro,
            age_category="JUNIOR"
        )
        self.p_adoor = Participant.objects.create(
            edition=self.edition,
            chest_number="010",
            name="Mathew Thomas",
            gender="M",
            church=self.church_adoor,
            age_category="JUNIOR"
        )

    # 1. Authentication Tests
    def test_anonymous_redirect(self):
        resp = self.client.get(reverse('portal_dashboard'))
        self.assertEqual(resp.status_code, 302)
        self.assertIn(reverse('portal_login'), resp.url)

    def test_portal_login_and_logout(self):
        login_resp = self.client.post(reverse('portal_login'), {
            'username': 'super_boss',
            'password': 'Password123!'
        })
        self.assertEqual(login_resp.status_code, 302)
        self.assertRedirects(login_resp, reverse('portal_dashboard'))

        # Check authenticated dashboard access
        dash_resp = self.client.get(reverse('portal_dashboard'))
        self.assertEqual(dash_resp.status_code, 200)
        self.assertContains(dash_resp, "super_boss")
        self.assertContains(dash_resp, "Total Churches")

        # Test logout
        logout_resp = self.client.get(reverse('portal_logout'))
        self.assertEqual(logout_resp.status_code, 302)
        self.assertRedirects(logout_resp, reverse('portal_login'))

    # 2. Role Permissions Tests
    def test_super_admin_can_add_church(self):
        self.client.login(username='super_boss', password='Password123!')
        resp = self.client.get(reverse('portal_church_add'))
        self.assertEqual(resp.status_code, 200)

    def test_result_admin_denied_church_add(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.get(reverse('portal_church_add'))
        # Result admin redirected to dashboard
        self.assertEqual(resp.status_code, 302)
        self.assertRedirects(resp, reverse('portal_dashboard'))

    # 3. Church Management Tests
    def test_church_list_and_search(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.get(reverse('portal_church_list'), {'q': 'Munroethuruth'})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "St. Mathias CSI Church")
        self.assertNotContains(resp, "Holy Trinity CSI Church")

    def test_church_add_and_duplicate_code_prevention(self):
        self.client.login(username='super_boss', password='Password123!')
        # Duplicate code CH01 should fail validation
        resp = self.client.post(reverse('portal_church_add'), {
            'code': 'CH01',
            'name': 'Duplicate Parish',
            'district': 'Adoor'
        })
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "already assigned")

        # Unique code CH99 should succeed
        post_resp = self.client.post(reverse('portal_church_add'), {
            'code': 'CH99',
            'name': 'Bethel CSI Church',
            'district': 'Adoor',
            'is_active': True
        })
        self.assertEqual(post_resp.status_code, 302)
        self.assertTrue(Church.objects.filter(code='CH99').exists())

    def test_church_toggle_status(self):
        self.client.login(username='super_boss', password='Password123!')
        church = Church.objects.get(code='CH01')
        self.assertTrue(church.is_active)

        self.client.post(reverse('portal_church_toggle_status', kwargs={'pk': church.pk}))
        church.refresh_from_db()
        self.assertFalse(church.is_active)

    # 4. Participant Management Tests
    def test_participant_add_preserves_leading_zeros(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.post(reverse('portal_participant_add'), {
            'edition': self.edition.pk,
            'chest_number': '007',
            'name': 'James Bond',
            'gender': 'M',
            'church': self.church_munro.pk,
            'age_category': 'SENIOR'
        })
        self.assertEqual(resp.status_code, 302)
        p = Participant.objects.get(chest_number='007')
        self.assertEqual(p.chest_number, '007')  # Preserved as string '007'

    def test_participant_search_by_chest_number(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.get(reverse('portal_participant_list'), {'q': '001'})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Aaron Samuel")
        self.assertNotContains(resp, "Joel Mathew")

    # 5. CSV Import Tests
    def test_participant_csv_import(self):
        self.client.login(username='result_officer', password='Password123!')
        csv_content = (
            "chest_number,name,name_malayalam,gender,church_code,age_category,phone\n"
            "041,Reeba Thomas,റീബാ തോമസ്,F,CH01,JUNIOR,9988776601\n"
            "042,Rohan George,രോഹൻ ജോർജ്,M,CH02,SENIOR,9988776602\n"
        )
        csv_file = SimpleUploadedFile(
            "import_test.csv",
            csv_content.encode('utf-8-sig'),
            content_type="text/csv"
        )

        resp = self.client.post(reverse('portal_participant_import'), {
            'edition': self.edition.pk,
            'csv_file': csv_file
        })
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "2 Participants Successfully Enrolled")
        self.assertTrue(Participant.objects.filter(chest_number='041').exists())
        p42 = Participant.objects.get(chest_number='042')
        self.assertEqual(p42.name, "Rohan George")
        self.assertEqual(p42.chest_number, "042")

    def test_participant_sample_csv_download(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.get(reverse('portal_participant_sample_csv'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn("chest_number", resp.content.decode('utf-8'))

    # 6. Registration Management Tests
    def test_individual_registration_successful(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.post(reverse('portal_registration_add'), {
            'edition': self.edition.pk,
            'event': self.event_solo.pk,
            'church': self.church_munro.pk,
            'participant': self.p1.pk,
            'chest_number': '001'
        })
        self.assertEqual(resp.status_code, 302)
        self.assertTrue(Registration.objects.filter(event=self.event_solo, participant=self.p1).exists())

    def test_duplicate_registration_rejected(self):
        # Register p1 first time
        Registration.objects.create(
            edition=self.edition,
            event=self.event_solo,
            church=self.church_munro,
            participant=self.p1,
            chest_number="001"
        )

        self.client.login(username='result_officer', password='Password123!')
        # Register p1 second time for same event
        resp = self.client.post(reverse('portal_registration_add'), {
            'edition': self.edition.pk,
            'event': self.event_solo.pk,
            'church': self.church_munro.pk,
            'participant': self.p1.pk,
            'chest_number': '001'
        })
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "already registered")

    def test_church_membership_violation_rejected(self):
        self.client.login(username='result_officer', password='Password123!')
        # Try registering p_adoor (from CH02) under church_munro (CH01)
        resp = self.client.post(reverse('portal_registration_add'), {
            'edition': self.edition.pk,
            'event': self.event_solo.pk,
            'church': self.church_munro.pk,
            'participant': self.p_adoor.pk,
            'chest_number': '010'
        })
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Church Membership Mismatch")

    def test_group_registration_with_all_members_from_same_church(self):
        self.client.login(username='result_officer', password='Password123!')
        resp = self.client.post(reverse('portal_registration_group_add'), {
            'edition': self.edition.pk,
            'event': self.event_quartet.pk,
            'church': self.church_munro.pk,
            'group_name': 'Munro Quartet Team',
            'chest_number': 'Q01',
            'member_ids': [self.p1.pk, self.p2.pk, self.p3.pk, self.p4.pk]
        })
        self.assertEqual(resp.status_code, 302)
        group_reg = Registration.objects.get(chest_number='Q01')
        self.assertEqual(group_reg.members.count(), 4)
        self.assertEqual(group_reg.church, self.church_munro)

    def test_group_registration_with_member_from_different_church_rejected(self):
        self.client.login(username='result_officer', password='Password123!')
        # Member p_adoor is from CH02, while church is CH01
        resp = self.client.post(reverse('portal_registration_group_add'), {
            'edition': self.edition.pk,
            'event': self.event_quartet.pk,
            'church': self.church_munro.pk,
            'group_name': 'Invalid Mixed Team',
            'chest_number': 'Q02',
            'member_ids': [self.p1.pk, self.p2.pk, self.p3.pk, self.p_adoor.pk]
        })
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Church Membership Violation")

    def test_audit_log_created_on_actions(self):
        self.client.login(username='super_boss', password='Password123!')
        self.client.post(reverse('portal_church_add'), {
            'code': 'CH88',
            'name': 'Audit Test Church',
            'district': 'Adoor'
        })
        self.assertTrue(AuditLog.objects.filter(action='CHURCH_CREATED').exists())
