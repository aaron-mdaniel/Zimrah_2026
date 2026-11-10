from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.db import transaction
from django.views.decorators.http import require_POST
from django.http import JsonResponse

from .models import Registration, GroupRegistrationMember
from .forms import IndividualRegistrationForm, GroupRegistrationForm
from apps.events.models import Event, Edition
from apps.participants.models import Participant
from apps.churches.models import Church
from apps.accounts.decorators import admin_required, role_required
from apps.audit.utils import log_activity


@admin_required
def registration_list(request):
    """Event-wise registration dashboard showing total counts per competition."""
    query = request.GET.get('q', '').strip()
    category_id = request.GET.get('category', '')
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

    if type_filter:
        events = events.filter(event_type=type_filter)

    total_registrations = Registration.objects.count()

    context = {
        'events': events,
        'query': query,
        'category_id': category_id,
        'type_filter': type_filter,
        'total_registrations': total_registrations,
    }
    return render(request, 'portal/registrations/list.html', context)


@admin_required
def registration_event_detail(request, event_id):
    """Displays all registrations for a specific competition event."""
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division', 'section'),
        pk=event_id
    )
    registrations = event.registrations.select_related(
        'church', 'participant'
    ).prefetch_related('members__participant').order_by('chest_number')

    context = {
        'event': event,
        'registrations': registrations,
        'total_registrations': registrations.count(),
    }
    return render(request, 'portal/registrations/event_detail.html', context)


@admin_required
def registration_event_print(request, event_id):
    """Printable official registration roster sheet for organizers and judges."""
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division', 'section'),
        pk=event_id
    )
    registrations = event.registrations.select_related(
        'church', 'participant'
    ).prefetch_related('members__participant').order_by('chest_number')

    context = {
        'event': event,
        'registrations': registrations,
    }
    return render(request, 'portal/registrations/event_print.html', context)


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
def registration_add(request):
    """Registers an individual participant for a solo competition."""
    if request.method == 'POST':
        form = IndividualRegistrationForm(request.POST)
        if form.is_valid():
            reg = form.save()
            log_activity(
                request,
                'REGISTRATION_CREATED',
                reg,
                {'event': reg.event.code, 'participant': reg.participant.name, 'church': reg.church.code}
            )
            messages.success(
                request,
                f"Successfully registered {reg.participant.name} (#{reg.chest_number}) for {reg.event.code} ({reg.event.name})."
            )
            return redirect('portal_registration_event_detail', event_id=reg.event.pk)
    else:
        initial = {}
        event_id = request.GET.get('event')
        if event_id:
            initial['event'] = event_id
        form = IndividualRegistrationForm(initial=initial)

    return render(request, 'portal/registrations/individual_form.html', {'form': form})


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
def registration_group_add(request):
    """Registers a church team with multiple members for a group competition."""
    if request.method == 'POST':
        form = GroupRegistrationForm(request.POST)
        if form.is_valid():
            edition = form.cleaned_data['edition']
            event = form.cleaned_data['event']
            church = form.cleaned_data['church']
            group_name = form.cleaned_data['group_name']
            chest_number = form.cleaned_data['chest_number']
            members = form.cleaned_data['member_ids']

            with transaction.atomic():
                reg = Registration.objects.create(
                    edition=edition,
                    event=event,
                    church=church,
                    group_name=group_name,
                    chest_number=chest_number
                )
                for member in members:
                    GroupRegistrationMember.objects.create(
                        registration=reg,
                        participant=member
                    )

            log_activity(
                request,
                'GROUP_REGISTRATION_CREATED',
                reg,
                {'event': reg.event.code, 'group_name': group_name, 'church': church.code, 'members_count': len(members)}
            )
            messages.success(
                request,
                f"Successfully registered team '{group_name}' (#{chest_number}) with {len(members)} participants for {event.code}."
            )
            return redirect('portal_registration_event_detail', event_id=event.pk)
    else:
        initial = {}
        event_id = request.GET.get('event')
        if event_id:
            initial['event'] = event_id
        form = GroupRegistrationForm(initial=initial)

    return render(request, 'portal/registrations/group_form.html', {'form': form})


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
@require_POST
def registration_delete(request, pk):
    reg = get_object_or_404(Registration.objects.select_related('event'), pk=pk)
    event_id = reg.event.id
    target_str = reg.participant.name if reg.participant else reg.group_name
    log_activity(request, 'REGISTRATION_DELETED', reg, {'target': target_str, 'event': reg.event.code})
    reg.delete()
    messages.success(request, f"Registration for '{target_str}' has been removed.")
    return redirect('portal_registration_event_detail', event_id=event_id)


@admin_required
def get_church_participants_api(request, church_id):
    """AJAX endpoint to dynamically fetch participants for a selected church in registration forms."""
    participants = Participant.objects.filter(church_id=church_id).order_by('chest_number').values('id', 'chest_number', 'name', 'gender', 'age_category')
    return JsonResponse({'participants': list(participants)})
