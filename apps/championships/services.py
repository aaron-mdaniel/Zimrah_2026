from decimal import Decimal
from django.db.models import Sum, Count, Q, Value, DecimalField
from django.db.models.functions import Coalesce

from apps.championships.models import PointLedger
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.events.models import Edition


class ChampionshipService:
    """
    Core calculation and tie-breaking engine for ZIMRAH 2026.
    
    Tie-breaking hierarchy (Configurable standard):
    1. Total Points (descending)
    2. Count of 1st places (descending)
    3. Count of 2nd places (descending)
    4. Count of 3rd places (descending)
    5. Count of Grade A awards (descending)
    If all 5 match: Assign equal rank.
    """

    @staticmethod
    def get_default_edition():
        return Edition.objects.filter(is_active=True).first() or Edition.objects.order_by('-year').first()

    @staticmethod
    def get_church_standings(edition=None, search=None):
        """
        Calculates church championship rankings based on active Church Point Ledger entries.
        Includes both individual and group points credited to each church.
        Returns sorted list of dictionaries with standard competition ranks and tie flags.
        """
        if not edition:
            edition = ChampionshipService.get_default_edition()

        if not edition:
            return []

        # Annotate all active churches with their active church-target point sums and award counts
        qs = Church.objects.filter(is_active=True)
        if search:
            search = search.strip()
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(district__icontains=search))

        edition_filter = Q(ledger_entries__edition=edition, ledger_entries__target=PointLedger.Target.CHURCH, ledger_entries__is_active=True)

        annotated = qs.annotate(
            total_points=Coalesce(
                Sum('ledger_entries__points', filter=edition_filter),
                Value(Decimal('0.00')),
                output_field=DecimalField()
            ),
            first_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=1)),
            second_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=2)),
            third_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=3)),
            grade_a_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='A')),
            grade_b_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='B')),
            grade_c_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='C')),
            events_count=Count('ledger_entries__event_id', filter=edition_filter, distinct=True)
        ).order_by(
            '-total_points',
            '-first_places',
            '-second_places',
            '-third_places',
            '-grade_a_count',
            'name'
        )

        results = []
        prev_criteria = None
        current_rank = 1

        for idx, church in enumerate(annotated):
            criteria = (
                church.total_points,
                church.first_places,
                church.second_places,
                church.third_places,
                church.grade_a_count
            )

            # Standard competition ranking: If tied on all 5 criteria, share rank
            if prev_criteria is not None and criteria == prev_criteria:
                rank = current_rank
                is_tied = True
                # Also mark previous entry as tied if it was not already marked
                if results:
                    results[-1]['is_tied'] = True
            else:
                rank = idx + 1
                current_rank = rank
                is_tied = False

            prev_criteria = criteria

            results.append({
                'rank': rank,
                'is_tied': is_tied,
                'church_id': church.id,
                'church_name': church.name,
                'church_code': church.code,
                'church_location': church.district,
                'total_points': church.total_points,
                'first_places': church.first_places,
                'second_places': church.second_places,
                'third_places': church.third_places,
                'grade_a_count': church.grade_a_count,
                'grade_b_count': church.grade_b_count,
                'grade_c_count': church.grade_c_count,
                'events_count': church.events_count,
            })

        return results

    @staticmethod
    def get_individual_standings(edition=None, category=None, search=None, only_with_points=False):
        """
        Calculates individual championship rankings based on active Individual Point Ledger entries.
        Supports overall, Junior, and Senior divisions.
        """
        if not edition:
            edition = ChampionshipService.get_default_edition()

        if not edition:
            return []

        qs = Participant.objects.filter(edition=edition).select_related('church')

        if category:
            cat_upper = category.strip().upper()
            if cat_upper in (Participant.AgeCategory.JUNIOR, Participant.AgeCategory.SENIOR):
                qs = qs.filter(age_category=cat_upper)

        if search:
            search = search.strip()
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(chest_number__icontains=search) |
                Q(church__name__icontains=search)
            )

        edition_filter = Q(ledger_entries__edition=edition, ledger_entries__target=PointLedger.Target.INDIVIDUAL, ledger_entries__is_active=True)

        annotated = qs.annotate(
            total_points=Coalesce(
                Sum('ledger_entries__points', filter=edition_filter),
                Value(Decimal('0.00')),
                output_field=DecimalField()
            ),
            first_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=1)),
            second_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=2)),
            third_places=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__position=3)),
            grade_a_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='A')),
            grade_b_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='B')),
            grade_c_count=Count('ledger_entries', filter=edition_filter & Q(ledger_entries__result_entry__grade='C')),
            events_count=Count('ledger_entries__event_id', filter=edition_filter, distinct=True)
        )

        if only_with_points:
            annotated = annotated.filter(total_points__gt=Decimal('0.00'))

        annotated = annotated.order_by(
            '-total_points',
            '-first_places',
            '-second_places',
            '-third_places',
            '-grade_a_count',
            'chest_number'
        )

        results = []
        prev_criteria = None
        current_rank = 1

        for idx, p in enumerate(annotated):
            criteria = (
                p.total_points,
                p.first_places,
                p.second_places,
                p.third_places,
                p.grade_a_count
            )

            if prev_criteria is not None and criteria == prev_criteria:
                rank = current_rank
                is_tied = True
                if results:
                    results[-1]['is_tied'] = True
            else:
                rank = idx + 1
                current_rank = rank
                is_tied = False

            prev_criteria = criteria

            results.append({
                'rank': rank,
                'is_tied': is_tied,
                'participant_id': p.id,
                'participant_name': p.name,
                'chest_number': p.chest_number,
                'category': p.age_category,
                'category_display': p.get_age_category_display(),
                'gender': p.gender,
                'church_id': p.church.id,
                'church_name': p.church.name,
                'church_code': p.church.code,
                'total_points': p.total_points,
                'first_places': p.first_places,
                'second_places': p.second_places,
                'third_places': p.third_places,
                'grade_a_count': p.grade_a_count,
                'grade_b_count': p.grade_b_count,
                'grade_c_count': p.grade_c_count,
                'events_count': p.events_count,
            })

        return results

    @staticmethod
    def get_live_summary(edition=None):
        """
        Returns live statistics for the public header, ticker, and polling mechanism.
        """
        from apps.events.models import Event
        from apps.results.models import EventResult

        if not edition:
            edition = ChampionshipService.get_default_edition()

        total_events = Event.objects.filter(edition=edition).count()
        published_results = EventResult.objects.filter(
            event__edition=edition,
            status=EventResult.Status.PUBLISHED
        ).count()
        pending_results = max(0, total_events - published_results)

        # Top 3 Churches
        church_standings = ChampionshipService.get_church_standings(edition=edition)
        top_churches = church_standings[:3]

        # Top 3 Individuals
        ind_standings = ChampionshipService.get_individual_standings(edition=edition, only_with_points=True)
        top_individuals = ind_standings[:3]

        # Latest 3 published results
        latest_results = EventResult.objects.filter(
            event__edition=edition,
            status=EventResult.Status.PUBLISHED
        ).select_related('event', 'event__division', 'event__category').order_by('-published_at')[:3]

        latest_list = []
        for r in latest_results:
            first_entry = r.entries.filter(position=1).first()
            winner_str = f"{first_entry.participant_name} ({first_entry.church.code})" if first_entry else "Completed"
            latest_list.append({
                'code': r.event.code,
                'name': r.event.name,
                'name_malayalam': r.event.name_malayalam,
                'published_at': r.published_at.isoformat() if r.published_at else None,
                'winner': winner_str
            })

        return {
            'edition_name': edition.name if edition else "ZIMRAH 2026",
            'total_events': total_events,
            'published_results': published_results,
            'pending_results': pending_results,
            'completion_pct': round((published_results / total_events * 100) if total_events > 0 else 0, 1),
            'top_churches': top_churches,
            'top_individuals': top_individuals,
            'latest_results': latest_list
        }
