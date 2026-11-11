import os
from decimal import Decimal
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse, Http404
from django.conf import settings
from django.db.models import Q, Prefetch

from apps.events.models import Event, EventCategory, EventDivision, Edition
from apps.results.models import EventResult, ResultEntry
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.championships.services import ChampionshipService
from zimrah.cache_service import CacheService


def get_current_edition():
    cached_id = CacheService.get('edition', 'current_id')
    if cached_id:
        edition = Edition.objects.filter(id=cached_id, is_active=True).first()
        if edition:
            return edition
    edition = Edition.objects.filter(is_active=True).first() or Edition.objects.order_by('-year').first()
    if edition:
        CacheService.set('edition', 'current_id', edition.id, timeout=300)
    return edition


def public_home_view(request):
    """
    Public Homepage for ZIMRAH 2026 – Song of Praise.
    Displays festival info, stage & literary event breakdown, live statistics,
    latest published results ticker, and championship previews.
    """
    edition = get_current_edition()
    summary = ChampionshipService.get_live_summary(edition=edition)

    # Divisions for quick filtering
    divisions = EventDivision.objects.filter(edition=edition).order_by('division_number')

    # Categories
    categories = EventCategory.objects.all().order_by('id')

    # Literary and Stage events breakdown
    literary_events = Event.objects.filter(
        edition=edition,
        category__name__icontains='literary'
    ).select_related('division', 'result').order_by('code')

    stage_events = Event.objects.filter(
        edition=edition,
        category__name__icontains='stage'
    ).select_related('division', 'result').order_by('division__division_number', 'code')

    # Top 5 Church Standings
    church_standings = ChampionshipService.get_church_standings(edition=edition)
    top_churches = church_standings[:5]

    # Top 5 Individual Standings (Junior & Senior overall)
    ind_standings = ChampionshipService.get_individual_standings(edition=edition, only_with_points=True)
    top_individuals = ind_standings[:5]

    # Latest 4 published results with details
    latest_results = EventResult.objects.filter(
        event__edition=edition,
        status=EventResult.Status.PUBLISHED
    ).select_related('event', 'event__division', 'event__category').prefetch_related(
        Prefetch('entries', queryset=ResultEntry.objects.filter(position=1).select_related('church'))
    ).order_by('-published_at')[:4]

    context = {
        'edition': edition,
        'summary': summary,
        'divisions': divisions,
        'categories': categories,
        'literary_events': literary_events,
        'stage_events': stage_events,
        'top_churches': top_churches,
        'top_individuals': top_individuals,
        'latest_results': latest_results,
    }
    return render(request, 'public/home.html', context)


def public_results_list_view(request):
    """
    Public directory of all competitions and published results.
    Filterable by category, division, status (published vs. awaited), and search query.
    """
    edition = get_current_edition()
    category_id = request.GET.get('category', '').strip()
    division_num = request.GET.get('division', '').strip()
    status_filter = request.GET.get('status', '').strip().lower()
    search_query = request.GET.get('q', '').strip()

    events_qs = Event.objects.filter(
        edition=edition
    ).select_related('division', 'category', 'result').prefetch_related(
        Prefetch('result__entries', queryset=ResultEntry.objects.filter(position__isnull=False).select_related('church').order_by('position'))
    ).order_by('division__division_number', 'code')

    if category_id:
        events_qs = events_qs.filter(category__id=category_id)
    if division_num:
        events_qs = events_qs.filter(division__division_number=division_num)
    if status_filter == 'published':
        events_qs = events_qs.filter(result__status=EventResult.Status.PUBLISHED)
    elif status_filter == 'awaited':
        events_qs = events_qs.exclude(result__status=EventResult.Status.PUBLISHED)

    if search_query:
        events_qs = events_qs.filter(
            Q(code__icontains=search_query) |
            Q(name__icontains=search_query) |
            Q(name_malayalam__icontains=search_query)
        )

    divisions = EventDivision.objects.filter(edition=edition).order_by('division_number')
    categories = EventCategory.objects.all().order_by('id')

    context = {
        'edition': edition,
        'events': events_qs,
        'divisions': divisions,
        'categories': categories,
        'selected_category': category_id,
        'selected_division': division_num,
        'selected_status': status_filter,
        'search_query': search_query,
        'total_count': events_qs.count(),
    }
    return render(request, 'public/results_list.html', context)


def public_result_detail_view(request, code):
    """
    Public scorecard page for a specific event code.
    Displays top 3 podium winners, full official scorecard, and social share links.
    If unpublished, displays a graceful 'Results Awaited' interface with live polling.
    """
    edition = get_current_edition()
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division'),
        code__iexact=code
    )

    event_result = EventResult.objects.filter(
        event=event,
        status=EventResult.Status.PUBLISHED
    ).prefetch_related(
        Prefetch('entries', queryset=ResultEntry.objects.select_related('church', 'participant').prefetch_related('participants__participant').order_by('position', '-total_points', 'chest_number'))
    ).first()

    is_published = event_result is not None
    entries = []
    top_positions = {'first': None, 'second': None, 'third': None}

    if is_published:
        entries = list(event_result.entries.all())
        for e in entries:
            if e.position == 1 and not top_positions['first']:
                top_positions['first'] = e
            elif e.position == 2 and not top_positions['second']:
                top_positions['second'] = e
            elif e.position == 3 and not top_positions['third']:
                top_positions['third'] = e

    full_url = request.build_absolute_uri()

    context = {
        'edition': edition,
        'event': event,
        'event_result': event_result,
        'is_published': is_published,
        'entries': entries,
        'top_positions': top_positions,
        'full_url': full_url,
    }
    return render(request, 'public/result_detail.html', context)


def public_church_championship_view(request):
    """
    Public Church Championship standings page with 5-level tie-breaking resolution.
    """
    edition = get_current_edition()
    search = request.GET.get('search', '').strip()
    standings = ChampionshipService.get_church_standings(edition=edition, search=search)

    top_three = standings[:3] if len(standings) >= 3 else standings

    context = {
        'edition': edition,
        'standings': standings,
        'top_three': top_three,
        'search': search,
        'total_churches': len(standings),
    }
    return render(request, 'public/church_championship.html', context)


def public_individual_championship_view(request):
    """
    Public Individual Championship page (Kalathilakam / Kalaprathibha).
    Filterable by category (Junior, Senior, Overall) and searchable.
    """
    edition = get_current_edition()
    category = request.GET.get('category', '').strip().upper()
    search = request.GET.get('search', '').strip()
    show_all = request.GET.get('all') in ('1', 'true')

    standings = ChampionshipService.get_individual_standings(
        edition=edition,
        category=category if category in ('JUNIOR', 'SENIOR') else None,
        search=search,
        only_with_points=not show_all
    )

    top_three = standings[:3] if len(standings) >= 3 else standings

    context = {
        'edition': edition,
        'standings': standings,
        'top_three': top_three,
        'selected_category': category,
        'search': search,
        'show_all': show_all,
        'total_count': len(standings),
    }
    return render(request, 'public/individual_championship.html', context)


def public_search_view(request):
    """
    Unified public search across competitions, chest numbers, participants, and churches.
    """
    edition = get_current_edition()
    query = request.GET.get('q', '').strip()

    events = []
    participants = []
    churches = []
    result_entries = []

    if query:
        # Match events
        events = Event.objects.filter(
            edition=edition
        ).filter(
            Q(code__icontains=query) |
            Q(name__icontains=query) |
            Q(name_malayalam__icontains=query)
        ).select_related('division', 'category', 'result')[:15]

        # Match participants
        participants = Participant.objects.filter(
            edition=edition
        ).filter(
            Q(chest_number__icontains=query) |
            Q(name__icontains=query) |
            Q(church__name__icontains=query)
        ).select_related('church')[:15]

        # Match churches
        churches = Church.objects.filter(
            is_active=True
        ).filter(
            Q(name__icontains=query) |
            Q(code__icontains=query) |
            Q(district__icontains=query)
        )[:10]

        # Match published scorecard entries
        result_entries = ResultEntry.objects.filter(
            event_result__status=EventResult.Status.PUBLISHED,
            event_result__event__edition=edition
        ).filter(
            Q(chest_number__icontains=query) |
            Q(participant_name__icontains=query)
        ).select_related('event_result__event', 'church')[:20]

    has_results = bool(events or participants or churches or result_entries)

    context = {
        'edition': edition,
        'query': query,
        'events': events,
        'participants': participants,
        'churches': churches,
        'result_entries': result_entries,
        'has_results': has_results,
    }
    return render(request, 'public/search.html', context)


def pwa_manifest_view(request):
    """Serves manifest.json from root scope."""
    manifest_path = os.path.join(settings.BASE_DIR, 'static', 'manifest.json')
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='application/manifest+json')
    raise Http404()


def pwa_service_worker_view(request):
    """Serves sw.js from root domain scope so it can control all public routes."""
    sw_path = os.path.join(settings.BASE_DIR, 'static', 'sw.js')
    if os.path.exists(sw_path):
        with open(sw_path, 'r', encoding='utf-8') as f:
            response = HttpResponse(f.read(), content_type='application/javascript')
            response['Service-Worker-Allowed'] = '/'
            return response
    raise Http404()
