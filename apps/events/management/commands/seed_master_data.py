import datetime
from django.core.management.base import BaseCommand
from apps.events.models import Edition, EventCategory, EventDivision, EventSection, Event
from apps.churches.models import Church


class Command(BaseCommand):
    help = "Seeds initial master data for ZIMRAH 2026 including all 34 competition events from official documents."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding ZIMRAH 2026 master data..."))

        # 1. Edition
        edition, created = Edition.objects.get_or_create(
            year=2026,
            defaults={
                'name': 'ZIMRAH 2026',
                'theme': 'Song of Praise',
                'organizer': 'CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement',
                'start_date': datetime.date(2026, 11, 8),
                'end_date': datetime.date(2026, 11, 14),
                'is_active': True,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created Edition: {edition}"))
        else:
            self.stdout.write(f"Edition exists: {edition}")

        # 2. Categories
        cat_literary, _ = EventCategory.objects.get_or_create(
            edition=edition,
            name="Literary Events",
            defaults={
                'name_malayalam': "സാഹിത്യ മത്സരങ്ങൾ",
                'date': datetime.date(2026, 11, 8),
                'venue': "Thazhathmon, TVM"
            }
        )
        cat_stage, _ = EventCategory.objects.get_or_create(
            edition=edition,
            name="Stage Events",
            defaults={
                'name_malayalam': "സ്റ്റേജ് മത്സരങ്ങൾ",
                'date': datetime.date(2026, 11, 14),
                'venue': "St. Mathias CSI Church, Munroethuruth"
            }
        )

        # 3. Divisions
        div_1, _ = EventDivision.objects.get_or_create(
            edition=edition,
            division_number=1,
            defaults={
                'name': "Music",
                'name_malayalam': "സംഗീതം (16 ഇനങ്ങൾ)"
            }
        )
        div_2, _ = EventDivision.objects.get_or_create(
            edition=edition,
            division_number=2,
            defaults={
                'name': "Fine Arts",
                'name_malayalam': "ഫൈൻ ആർട്സ് (3 ഇനങ്ങൾ)"
            }
        )
        div_3, _ = EventDivision.objects.get_or_create(
            edition=edition,
            division_number=3,
            defaults={
                'name': "Theater",
                'name_malayalam': "തീയറ്റർ മത്സരങ്ങൾ (5 ഇനങ്ങൾ)"
            }
        )
        div_4, _ = EventDivision.objects.get_or_create(
            edition=edition,
            division_number=4,
            defaults={
                'name': "Writing & Elocution",
                'name_malayalam': "രചന പ്രസംഗ മത്സരങ്ങൾ (10 ഇനങ്ങൾ)"
            }
        )

        # 4. Sections
        sections_data = [
            ("JB", "Junior Boys", "ജൂനിയർ ബോയ്സ്"),
            ("JG", "Junior Girls", "ജൂനിയർ ഗേൾസ്"),
            ("SB", "Senior Boys", "സീനിയർ ബോയ്സ്"),
            ("SG", "Senior Girls", "സീനിയർ ഗേൾസ്"),
            ("JUNIOR", "Junior", "ജൂനിയർ"),
            ("SENIOR", "Senior", "സീനിയർ"),
            ("OPEN", "Open", "പൊതു വിഭാഗം"),
        ]
        sec_map = {}
        for code, name, name_mal in sections_data:
            sec, _ = EventSection.objects.get_or_create(
                edition=edition,
                code=code,
                defaults={'name': name, 'name_malayalam': name_mal}
            )
            sec_map[code] = sec

        # 5. Events Definition (Exact transcription of 34 events)
        events_data = [
            # Division 1: Music (16 items) - Stage Events
            {
                'code': 'EV01', 'name': 'Solo Eastern - Junior Boys', 'name_mal': 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['JB'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV02', 'name': 'Solo Eastern - Junior Girls', 'name_mal': 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['JG'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV03', 'name': 'Solo Eastern - Senior Boys', 'name_mal': 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ബോയ്സ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['SB'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV04', 'name': 'Solo Eastern - Senior Girls', 'name_mal': 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ഗേൾസ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['SG'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV05', 'name': 'Solo Western - Junior Boys', 'name_mal': 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['JB'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV06', 'name': 'Solo Western - Junior Girls', 'name_mal': 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['JG'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV07', 'name': 'Solo Western - Senior Boys', 'name_mal': 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ബോയ്സ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['SB'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV08', 'name': 'Solo Western - Senior Girls', 'name_mal': 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ഗേൾസ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['SG'], 'type': Event.EventType.INDIVIDUAL,
                'duration': None, 'display': '', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV09', 'name': 'Light Music - Girls', 'name_mal': 'ലളിതഗാനം - ഗേൾസ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV10', 'name': 'Light Music - Boys', 'name_mal': 'ലളിതഗാനം - ബോയ്സ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV11', 'name': 'Classical Music', 'name_mal': 'ശാസ്ത്രീയ സംഗീതം',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV12', 'name': 'Organ Recital', 'name_mal': 'ഓർഗൻ റിസൈറ്റൽ',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV13', 'name': 'Instrumental Music (Percussion)', 'name_mal': 'ഉപകരണ സംഗീതം (പെർക്യൂഷൻ)',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 8, 'display': '3+5 മിനിറ്റ്സ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV14', 'name': 'Instrumental Music (Violin)', 'name_mal': 'ഉപകരണ സംഗീതം (വയലിൻ)',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV15', 'name': 'Group Song', 'name_mal': 'സമൂഹഗാനം',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.GROUP,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 4, 'max_p': 12, 'indiv': False
            },
            {
                'code': 'EV16', 'name': 'Quartet', 'name_mal': 'ക്വാർട്ടറ്റ്',
                'cat': cat_stage, 'div': div_1, 'sec': sec_map['OPEN'], 'type': Event.EventType.GROUP,
                'duration': None, 'display': '', 'min_p': 4, 'max_p': 4, 'indiv': False
            },

            # Division 2: Fine Arts (3 items) - Literary / Off-stage
            {
                'code': 'EV17', 'name': 'Pencil Drawing', 'name_mal': 'പെൻസിൽ ഡ്രോയിംഗ്',
                'cat': cat_literary, 'div': div_2, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 60, 'display': '60 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV18', 'name': 'Water Colour', 'name_mal': 'വാട്ടർ കളർ',
                'cat': cat_literary, 'div': div_2, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 75, 'display': '75 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV19', 'name': 'Cartoon', 'name_mal': 'കാർട്ടൂൺ',
                'cat': cat_literary, 'div': div_2, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 30, 'display': '30 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },

            # Division 3: Theater Competitions (5 items) - Stage Events
            {
                'code': 'EV20', 'name': 'Fancy Dress', 'name_mal': 'ഫാൻസി ഡ്രസ്സ്',
                'cat': cat_stage, 'div': div_3, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV21', 'name': 'Mono Act', 'name_mal': 'മോണോ ആക്ട്',
                'cat': cat_stage, 'div': div_3, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV22', 'name': 'Mimicry', 'name_mal': 'മിമിക്രി',
                'cat': cat_stage, 'div': div_3, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV23', 'name': 'Tableau', 'name_mal': 'ടാബ്ലോ',
                'cat': cat_stage, 'div': div_3, 'sec': sec_map['OPEN'], 'type': Event.EventType.GROUP,
                'duration': 6, 'display': '6 മിനിറ്റ്', 'min_p': 4, 'max_p': 15, 'indiv': False
            },
            {
                'code': 'EV24', 'name': 'Mime', 'name_mal': 'മൈം',
                'cat': cat_stage, 'div': div_3, 'sec': sec_map['OPEN'], 'type': Event.EventType.GROUP,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 4, 'max_p': 10, 'indiv': False
            },

            # Division 4: Writing & Elocution (10 items) - Literary Events
            {
                'code': 'EV25', 'name': 'Poetry Writing (English)', 'name_mal': 'പദ്യരചന (ഇംഗ്ലീഷ്)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 30, 'display': '30 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV26', 'name': 'Poetry Writing (Malayalam)', 'name_mal': 'പദ്യരചന (മലയാളം)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 30, 'display': '30 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV27', 'name': 'Short Story Writing (English)', 'name_mal': 'കഥാരചന (ഇംഗ്ലീഷ്)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 60, 'display': '60 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV28', 'name': 'Short Story Writing (Malayalam)', 'name_mal': 'കഥാരചന (മലയാളം)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['OPEN'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 60, 'display': '60 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV29', 'name': 'Essay Writing - Junior (Malayalam)', 'name_mal': 'ഉപന്യാസ രചന ജൂനിയർ (മലയാളം)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['JUNIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 60, 'display': '60 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV30', 'name': 'Essay Writing - Senior (English)', 'name_mal': 'ഉപന്യാസ രചന സീനിയർ (ഇംഗ്ലീഷ്)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['SENIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 60, 'display': '60 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV31', 'name': 'Elocution - Junior (Malayalam)', 'name_mal': 'പ്രസംഗം ജൂനിയർ (മലയാളം)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['JUNIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV32', 'name': 'Elocution - Senior (Malayalam)', 'name_mal': 'പ്രസംഗം സീനിയർ (മലയാളം)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['SENIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV33', 'name': 'Elocution - Junior (English)', 'name_mal': 'പ്രസംഗം ജൂനിയർ (ഇംഗ്ലീഷ്)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['JUNIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
            {
                'code': 'EV34', 'name': 'Elocution - Senior (English)', 'name_mal': 'പ്രസംഗം സീനിയർ (ഇംഗ്ലീഷ്)',
                'cat': cat_literary, 'div': div_4, 'sec': sec_map['SENIOR'], 'type': Event.EventType.INDIVIDUAL,
                'duration': 5, 'display': '5 മിനിറ്റ്', 'min_p': 1, 'max_p': 1, 'indiv': True
            },
        ]

        for item in events_data:
            ev, created_ev = Event.objects.update_or_create(
                edition=edition,
                code=item['code'],
                defaults={
                    'name': item['name'],
                    'name_malayalam': item['name_mal'],
                    'category': item['cat'],
                    'division': item['div'],
                    'section': item['sec'],
                    'event_type': item['type'],
                    'duration_minutes': item['duration'],
                    'duration_display': item['display'],
                    'min_participants': item['min_p'],
                    'max_participants': item['max_p'],
                    'contributes_to_individual': item['indiv'],
                    'contributes_to_church': True,
                }
            )
            state = "Created" if created_ev else "Updated"
            self.stdout.write(f"  {state} {ev.code}: {ev.name}")

        # 6. Sample Churches for Adoor Clergy District
        churches_sample = [
            ("CH01", "St. Mathias CSI Church, Munroethuruth", "സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്", "Rev. John Philip", "9447100001"),
            ("CH02", "Holy Trinity CSI Church, Adoor", "ഹോളി ട്രിനിറ്റി സി.എസ്.ഐ ചർച്ച്, അടൂർ", "Rev. Thomas Mathew", "9447100002"),
            ("CH03", "St. Thomas CSI Church, Kannamkode", "സെന്റ് തോമസ് സി.എസ്.ഐ ചർച്ച്, കണ്ണങ്കോട്", "Rev. P. K. George", "9447100003"),
            ("CH04", "All Saints CSI Church, Thazhathmon", "ഓൾ സെയിന്റ്സ് സി.എസ്.ഐ ചർച്ച്, താഴത്തുമൺ", "Rev. Abraham Varghese", "9447100004"),
            ("CH05", "Christ Church CSI, Anandappally", "ക്രൈസ്റ്റ് ചർച്ച് സി.എസ്.ഐ, ആനന്ദപ്പള്ളി", "Rev. Jacob Koshy", "9447100005"),
            ("CH06", "St. Mark CSI Church, Peringanadu", "സെന്റ് മാർക്ക് സി.എസ്.ഐ ചർച്ച്, പെരിങ്ങനാട്", "Rev. Sam George", "9447100006"),
            ("CH07", "St. Luke CSI Church, Kadampanad", "സെന്റ് ലൂക്ക് സി.എസ്.ഐ ചർച്ച്, കടമ്പനാട്", "Rev. Varghese Philip", "9447100007"),
            ("CH08", "St. Stephen CSI Church, Parakode", "സെന്റ് സ്റ്റീഫൻ സി.എസ്.ഐ ചർച്ച്, പറക്കോട്", "Rev. Sunny Varghese", "9447100008"),
        ]

        for code, name, name_mal, vicar, phone in churches_sample:
            ch, _ = Church.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'name_malayalam': name_mal,
                    'district': "Adoor Clergy District",
                    'vicar_name': vicar,
                    'contact_phone': phone,
                    'is_active': True,
                }
            )
            self.stdout.write(f"  Church {ch.code}: {ch.name}")

        self.stdout.write(self.style.SUCCESS("All master data seeded successfully!"))
