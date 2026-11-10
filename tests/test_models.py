from decimal import Decimal
from django.test import TestCase
from django.db import IntegrityError
from django.contrib.auth import get_user_model

from apps.events.models import Edition, EventCategory, EventDivision, EventSection, Event
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.registrations.models import Registration, GroupRegistrationMember
from apps.results.models import EventResult, ResultEntry, ResultParticipant
from apps.championships.models import PointLedger
from apps.audit.models import AuditLog

User = get_user_model()


class ZimrahPhase1ModelTests(TestCase):
    def setUp(self):
        # 1. Festival Edition
        self.edition = Edition.objects.create(
            year=2026,
            name="ZIMRAH 2026",
            theme="Song of Praise",
            organizer="CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement"
        )

        # 2. Churches
        self.church_munro = Church.objects.create(
            code="CH01",
            name="St. Mathias CSI Church, Munroethuruth",
            name_malayalam="സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്",
            district="Adoor Clergy District",
            vicar_name="Rev. John Philip",
            contact_phone="9876543210"
        )
        self.church_adoor = Church.objects.create(
            code="CH02",
            name="Holy Trinity CSI Church, Adoor",
            name_malayalam="ഹോളി ട്രിനിറ്റി സി.എസ്.ഐ ചർച്ച്, അടൂർ",
            district="Adoor Clergy District"
        )

        # 3. Category & Division
        self.cat_stage = EventCategory.objects.create(
            edition=self.edition,
            name="Stage Events",
            name_malayalam="സ്റ്റേജ് മത്സരങ്ങൾ",
            venue="St. Mathias CSI Church Munroethuruth"
        )
        self.div_music = EventDivision.objects.create(
            edition=self.edition,
            division_number=1,
            name="Music",
            name_malayalam="സംഗീതം (16 ഇനങ്ങൾ)"
        )
        self.sec_jb = EventSection.objects.create(
            edition=self.edition,
            code="JB",
            name="Junior Boys",
            name_malayalam="ജൂനിയർ ബോയ്സ്"
        )

        # 4. Events (Individual and Group)
        self.solo_eastern = Event.objects.create(
            edition=self.edition,
            code="EV01",
            name="Solo Eastern - Junior Boys",
            name_malayalam="സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്",
            category=self.cat_stage,
            division=self.div_music,
            section=self.sec_jb,
            event_type=Event.EventType.INDIVIDUAL,
            contributes_to_individual=True,
            contributes_to_church=True
        )
        self.group_song = Event.objects.create(
            edition=self.edition,
            code="EV15",
            name="Group Song",
            name_malayalam="സംഘഗാനം",
            category=self.cat_stage,
            division=self.div_music,
            event_type=Event.EventType.GROUP,
            duration_minutes=5,
            duration_display="5 മിനിറ്റ്",
            min_participants=4,
            max_participants=12,
            contributes_to_individual=False,
            contributes_to_church=True
        )

        # 5. Participants
        self.part_1 = Participant.objects.create(
            edition=self.edition,
            chest_number="101",
            name="Aaron Samuel",
            name_malayalam="ആരോൺ സാമുവൽ",
            gender=Participant.Gender.MALE,
            church=self.church_munro,
            age_category=Participant.AgeCategory.JUNIOR,
            phone="9988776655"
        )
        self.part_2 = Participant.objects.create(
            edition=self.edition,
            chest_number="102",
            name="Joel Mathew",
            name_malayalam="ജോയൽ മാത്യു",
            gender=Participant.Gender.MALE,
            church=self.church_munro,
            age_category=Participant.AgeCategory.JUNIOR
        )

        # 6. Admin User
        self.admin_user = User.objects.create_user(
            username="result_admin",
            password="secretpassword",
            role=User.Role.RESULT_ADMIN
        )

    def test_church_creation(self):
        self.assertEqual(Church.objects.count(), 2)
        church = Church.objects.get(code="CH01")
        self.assertEqual(church.name, "St. Mathias CSI Church, Munroethuruth")
        self.assertEqual(str(church), "CH01 - St. Mathias CSI Church, Munroethuruth")

    def test_church_code_uniqueness(self):
        with self.assertRaises(IntegrityError):
            Church.objects.create(
                code="CH01",
                name="Duplicate Church",
                district="Adoor Clergy District"
            )

    def test_edition_and_event_creation(self):
        self.assertEqual(self.edition.year, 2026)
        self.assertEqual(self.solo_eastern.code, "EV01")
        self.assertEqual(self.solo_eastern.event_type, Event.EventType.INDIVIDUAL)
        self.assertTrue(self.solo_eastern.contributes_to_individual)
        self.assertTrue(self.solo_eastern.contributes_to_church)
        self.assertFalse(self.group_song.contributes_to_individual)
        self.assertTrue(self.group_song.contributes_to_church)

    def test_unique_event_code_per_edition(self):
        with self.assertRaises(IntegrityError):
            Event.objects.create(
                edition=self.edition,
                code="EV01",  # Duplicate code
                name="Another Solo",
                name_malayalam="മറ്റൊരു സോളോ",
                category=self.cat_stage
            )

    def test_participant_creation(self):
        self.assertEqual(Participant.objects.count(), 2)
        part = Participant.objects.get(chest_number="101")
        self.assertEqual(part.church, self.church_munro)
        self.assertEqual(part.name, "Aaron Samuel")

    def test_unique_chest_number_per_edition(self):
        with self.assertRaises(IntegrityError):
            Participant.objects.create(
                edition=self.edition,
                chest_number="101",  # Duplicate chest number
                name="Different Name",
                gender=Participant.Gender.MALE,
                church=self.church_adoor
            )

    def test_registrations_individual_and_group(self):
        # Individual registration
        reg_indiv = Registration.objects.create(
            edition=self.edition,
            event=self.solo_eastern,
            church=self.church_munro,
            participant=self.part_1,
            chest_number="101"
        )
        self.assertEqual(reg_indiv.participant, self.part_1)

        # Group registration
        reg_group = Registration.objects.create(
            edition=self.edition,
            event=self.group_song,
            church=self.church_munro,
            group_name="Munroethuruth Youth Choir",
            chest_number="G01"
        )
        member1 = GroupRegistrationMember.objects.create(
            registration=reg_group,
            participant=self.part_1,
            role="Vocalist"
        )
        member2 = GroupRegistrationMember.objects.create(
            registration=reg_group,
            participant=self.part_2,
            role="Guitarist"
        )
        self.assertEqual(reg_group.members.count(), 2)

    def test_result_and_decimal_scoring(self):
        # Create draft event result
        res = EventResult.objects.create(
            event=self.solo_eastern,
            status=EventResult.Status.DRAFT,
            created_by=self.admin_user
        )

        # Add result entry with decimal scores
        entry = ResultEntry.objects.create(
            event_result=res,
            position=1,
            chest_number="101",
            participant_name="Aaron Samuel",
            church=self.church_munro,
            participant=self.part_1,
            grade="A",
            grade_points=Decimal("5.00"),
            position_points=Decimal("5.00")
        )

        # Check automated calculation: Total Points = Grade Points + Position Points
        self.assertEqual(entry.total_points, Decimal("10.00"))

        # Verify decimal precision and update
        entry.grade_points = Decimal("3.50")
        entry.position_points = Decimal("4.25")
        entry.save()
        self.assertEqual(entry.total_points, Decimal("7.75"))

    def test_group_result_participants(self):
        res = EventResult.objects.create(
            event=self.group_song,
            status=EventResult.Status.DRAFT,
            created_by=self.admin_user
        )
        group_entry = ResultEntry.objects.create(
            event_result=res,
            position=1,
            chest_number="G01",
            participant_name="Munroethuruth Choir",
            church=self.church_munro,
            grade="A",
            grade_points=Decimal("5.00"),
            position_points=Decimal("5.00")
        )
        self.assertEqual(group_entry.total_points, Decimal("10.00"))

        # Link individual group participants
        rp1 = ResultParticipant.objects.create(
            result_entry=group_entry,
            participant=self.part_1,
            role="Leader"
        )
        rp2 = ResultParticipant.objects.create(
            result_entry=group_entry,
            participant=self.part_2,
            role="Singer"
        )
        self.assertEqual(group_entry.participants.count(), 2)

    def test_point_ledger_storage(self):
        res = EventResult.objects.create(
            event=self.solo_eastern,
            status=EventResult.Status.PUBLISHED,
            published_by=self.admin_user
        )
        entry = ResultEntry.objects.create(
            event_result=res,
            position=1,
            chest_number="101",
            participant_name="Aaron Samuel",
            church=self.church_munro,
            participant=self.part_1,
            grade="A",
            grade_points=Decimal("5.00"),
            position_points=Decimal("5.00")
        )

        # Post ledger entries for Church and Individual
        church_ledger = PointLedger.objects.create(
            edition=self.edition,
            result_entry=entry,
            event=self.solo_eastern,
            church=self.church_munro,
            target=PointLedger.Target.CHURCH,
            points=entry.total_points,
            is_active=True
        )
        indiv_ledger = PointLedger.objects.create(
            edition=self.edition,
            result_entry=entry,
            event=self.solo_eastern,
            church=self.church_munro,
            participant=self.part_1,
            target=PointLedger.Target.INDIVIDUAL,
            points=entry.total_points,
            is_active=True
        )

        self.assertEqual(church_ledger.points, Decimal("10.00"))
        self.assertEqual(indiv_ledger.points, Decimal("10.00"))
        self.assertTrue(church_ledger.is_active)
        self.assertTrue(indiv_ledger.is_active)

    def test_audit_log_tracking(self):
        log = AuditLog.objects.create(
            user=self.admin_user,
            action="RESULT_PUBLISHED",
            model_name="EventResult",
            object_id="1",
            object_repr="Result for EV01",
            changes={"status": {"old": "DRAFT", "new": "PUBLISHED"}},
            ip_address="127.0.0.1"
        )
        self.assertEqual(log.user.username, "result_admin")
        self.assertEqual(log.changes["status"]["new"], "PUBLISHED")
        self.assertIn("EV01", str(log))

    def test_user_roles(self):
        super_user = User.objects.create_user(
            username="head_admin",
            password="pass",
            role=User.Role.SUPER_ADMIN
        )
        publisher = User.objects.create_user(
            username="publisher_user",
            password="pass",
            role=User.Role.PUBLISHER
        )
        result_admin = self.admin_user

        self.assertTrue(super_user.is_super_admin)
        self.assertTrue(super_user.is_publisher)
        self.assertTrue(super_user.is_result_admin)

        self.assertFalse(publisher.is_super_admin)
        self.assertTrue(publisher.is_publisher)
        self.assertTrue(publisher.is_result_admin)

        self.assertFalse(result_admin.is_super_admin)
        self.assertFalse(result_admin.is_publisher)
        self.assertTrue(result_admin.is_result_admin)
