from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count

from .models import Event, EventCategory, EventDivision, EventSection, Edition
from .forms import EventForm
from apps.accounts.decorators import admin_required, role_required
from apps.audit.utils import log_activity


@admin_required
def event_list(request):
    query = request.GET.get('q', '').strip()
    category_id = request.GET.get('category', '')
    division_id = request.GET.get('division', '')
    type_filter = request.GET.get('type', '')

    events = Event.objects.select_related(
        'edition', 'category', 'division', 'section'
    ).annotate(
        reg_count=Count('registrations', distinct=True)
    ).order_by('code')

    if query:
        events = events.filter(
            Q(code__icontains=query) |
            Q(name__icontains=query) |
            Q(name_malayalam__icontains=query)
        )

    if category_id:
        events = events.filter(category_id=category_id)

    if division_id:
        events = events.filter(division_id=division_id)

    if type_filter:
        events = events.filter(event_type=type_filter)

    categories = EventCategory.objects.all().order_by('name')
    divisions = EventDivision.objects.all().order_by('division_number')

    paginator = Paginator(events, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'page_obj': page_obj,
        'query': query,
        'category_id': category_id,
        'division_id': division_id,
        'type_filter': type_filter,
        'categories': categories,
        'divisions': divisions,
        'total_events': events.count(),
    }
    return render(request, 'portal/events/list.html', context)


@admin_required
def event_detail(request, pk):
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division', 'section'),
        pk=pk
    )
    registrations = event.registrations.select_related('church', 'participant').prefetch_related('members__participant').order_by('chest_number')

    context = {
        'event': event,
        'registrations': registrations,
        'total_registrations': registrations.count(),
    }
    return render(request, 'portal/events/detail.html', context)


@admin_required
@role_required(['SUPER_ADMIN'])
def event_add(request):
    if request.method == 'POST':
        form = EventForm(request.POST)
        if form.is_valid():
            ev = form.save()
            log_activity(request, 'EVENT_CREATED', ev, {'code': ev.code, 'name': ev.name})
            messages.success(request, f"Event '{ev.code} - {ev.name}' added successfully.")
            return redirect('portal_event_detail', pk=ev.pk)
    else:
        form = EventForm()

    return render(request, 'portal/events/form.html', {'form': form, 'title': 'Add New Event'})


@admin_required
@role_required(['SUPER_ADMIN'])
def event_edit(request, pk):
    ev = get_object_or_404(Event, pk=pk)
    if request.method == 'POST':
        form = EventForm(request.POST, instance=ev)
        if form.is_valid():
            ev = form.save()
            log_activity(request, 'EVENT_UPDATED', ev, {'code': ev.code, 'name': ev.name})
            messages.success(request, f"Event '{ev.code}' updated successfully.")
            return redirect('portal_event_detail', pk=ev.pk)
    else:
        form = EventForm(instance=ev)

    return render(request, 'portal/events/form.html', {'form': form, 'title': f'Edit Event: {ev.code}', 'event': ev})
