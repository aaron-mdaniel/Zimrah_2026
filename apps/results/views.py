import json
from decimal import Decimal
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError

from .models import EventResult, ResultEntry, ResultParticipant
from .services import ResultService
from apps.events.models import Event, EventCategory, EventDivision
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.registrations.models import Registration
from apps.audit.models import AuditLog
from apps.accounts.decorators import admin_required, role_required


@admin_required
def result_list(request):
    """Event results overview showing publication status for all 34 events."""
    query = request.GET.get('q', '').strip()
    status_filter = request.GET.get('status', '')
    category_id = request.GET.get('category', '')
    division_id = request.GET.get('division', '')

    events = Event.objects.select_related(
        'edition', 'category', 'division', 'section', 'result', 'result__published_by'
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

    if status_filter == 'PUBLISHED':
        events = events.filter(result__status=EventResult.Status.PUBLISHED)
    elif status_filter == 'DRAFT':
        events = events.filter(result__status=EventResult.Status.DRAFT)
    elif status_filter == 'PENDING':
        events = events.filter(result__isnull=True)

    categories = EventCategory.objects.all().order_by('name')
    divisions = EventDivision.objects.all().order_by('division_number')

    paginator = Paginator(events, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'page_obj': page_obj,
        'query': query,
        'status_filter': status_filter,
        'category_id': category_id,
        'division_id': division_id,
        'categories': categories,
        'divisions': divisions,
    }
    return render(request, 'portal/results/list.html', context)


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER'])
def result_entry_view(request, event_id):
    """Multi-row result entry interface with automatic backend total calculation."""
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division', 'section'),
        pk=event_id
    )
    result = getattr(event, 'result', None)

    # If result is already published, redirect to correction view
    if result and result.status == EventResult.Status.PUBLISHED:
        messages.info(request, f"Event {event.code} is already published. Use the Result Correction view to modify published scores.")
        return redirect('portal_result_correct', event_id=event.id)

    churches = Church.objects.filter(is_active=True).order_by('code')
    participants = Participant.objects.filter(edition=event.edition).select_related('church').order_by('chest_number')

    if request.method == 'POST':
        action = request.POST.get('action', 'save_draft')
        notes = request.POST.get('notes', '')

        # Extract rows from POST data
        chest_numbers = request.POST.getlist('chest_number[]')
        participant_names = request.POST.getlist('participant_name[]')
        church_ids = request.POST.getlist('church_id[]')
        participant_ids = request.POST.getlist('participant_id[]')
        positions = request.POST.getlist('position[]')
        grades = request.POST.getlist('grade[]')
        grade_points_list = request.POST.getlist('grade_points[]')
        position_points_list = request.POST.getlist('position_points[]')
        remarks_list = request.POST.getlist('remarks[]')
        entry_ids = request.POST.getlist('entry_id[]')

        entries_data = []
        for i in range(len(chest_numbers)):
            chest = chest_numbers[i].strip() if i < len(chest_numbers) else ''
            p_name = participant_names[i].strip() if i < len(participant_names) else ''
            if not chest and not p_name:
                continue

            c_id = church_ids[i] if i < len(church_ids) else None
            p_id = participant_ids[i] if i < len(participant_ids) else None
            p_id = int(p_id) if p_id and p_id.isdigit() else None
            pos = positions[i] if i < len(positions) else None
            grd = grades[i] if i < len(grades) else ''
            gp = grade_points_list[i] if i < len(grade_points_list) else '0.00'
            pp = position_points_list[i] if i < len(position_points_list) else '0.00'
            rem = remarks_list[i] if i < len(remarks_list) else ''
            e_id = entry_ids[i] if i < len(entry_ids) and entry_ids[i].isdigit() else None

            entries_data.append({
                'id': e_id,
                'chest_number': chest,
                'participant_name': p_name,
                'church_id': c_id,
                'participant_id': p_id,
                'position': pos,
                'grade': grd,
                'grade_points': gp,
                'position_points': pp,
                'remarks': rem
            })

        if not entries_data:
            messages.error(request, "Please enter at least one contestant score entry.")
        else:
            try:
                saved_result = ResultService.save_result_draft(
                    event=event,
                    entries_data=entries_data,
                    user=request.user,
                    notes=notes
                )
                messages.success(request, f"Draft results for {event.code} ({len(entries_data)} entries) saved successfully.")
                if action == 'save_preview':
                    return redirect('portal_result_preview', event_id=event.id)
                return redirect('portal_result_entry', event_id=event.id)
            except Exception as e:
                messages.error(request, f"Failed to save results: {str(e)}")

    # Pre-populate existing entries or registered contestants
    existing_entries = result.entries.select_related('church', 'participant').order_by('position', '-total_points') if result else []

    # If no existing entries, check registrations for convenient 1-click loading
    registrations = event.registrations.select_related('church', 'participant').order_by('chest_number')

    context = {
        'event': event,
        'result': result,
        'existing_entries': existing_entries,
        'registrations': registrations,
        'churches': churches,
        'participants': participants,
    }
    return render(request, 'portal/results/entry_form.html', context)


@admin_required
def result_preview_view(request, event_id):
    """Preview of competition result before publishing or verification."""
    event = get_object_or_404(
        Event.objects.select_related('edition', 'category', 'division', 'section'),
        pk=event_id
    )
    result = get_object_or_404(
        EventResult.objects.select_related('published_by', 'created_by').prefetch_related(
            'entries__church', 'entries__participant', 'entries__participants__participant'
        ),
        event=event
    )

    entries = result.entries.all().order_by('position', '-total_points', 'chest_number')

    can_publish = request.user.role in [request.user.Role.SUPER_ADMIN, request.user.Role.PUBLISHER] or request.user.is_superuser

    context = {
        'event': event,
        'result': result,
        'entries': entries,
        'can_publish': can_publish,
    }
    return render(request, 'portal/results/preview.html', context)


@admin_required
@role_required(['SUPER_ADMIN', 'PUBLISHER'])
@require_POST
def result_publish_action(request, event_id):
    """Publishes verified result and generates Point Ledger records."""
    event = get_object_or_404(Event, pk=event_id)
    result = get_object_or_404(EventResult, event=event)

    try:
        ResultService.publish_result(result, user=request.user)
        messages.success(request, f"Result for {event.code} – {event.name} has been published successfully! Championship points are now active.")
    except Exception as e:
        messages.error(request, f"Publication failed: {str(e)}")

    return redirect('portal_result_preview', event_id=event.id)


@admin_required
@role_required(['SUPER_ADMIN', 'PUBLISHER'])
@require_POST
def result_unpublish_action(request, event_id):
    """Unpublishes result, reverting to DRAFT and deactivating Point Ledger."""
    event = get_object_or_404(Event, pk=event_id)
    result = get_object_or_404(EventResult, event=event)
    reason = request.POST.get('reason', 'Administrative unpublish request').strip()

    try:
        ResultService.unpublish_result(result, user=request.user, reason=reason)
        messages.warning(request, f"Result for {event.code} unpublished. All points have been deactivated from public leaderboards.")
    except Exception as e:
        messages.error(request, f"Unpublish failed: {str(e)}")

    return redirect('portal_result_preview', event_id=event.id)


@admin_required
@role_required(['SUPER_ADMIN', 'PUBLISHER'])
def result_correct_view(request, event_id):
    """Allows correcting an already published result with mandatory reason and audit diff."""
    event = get_object_or_404(Event, pk=event_id)
    result = get_object_or_404(EventResult, event=event)

    if result.status != EventResult.Status.PUBLISHED:
        return redirect('portal_result_entry', event_id=event.id)

    churches = Church.objects.filter(is_active=True).order_by('code')
    participants = Participant.objects.filter(edition=event.edition).select_related('church').order_by('chest_number')

    if request.method == 'POST':
        reason = request.POST.get('reason', '').strip()
        if not reason:
            messages.error(request, "A reason for score correction is mandatory for audit compliance.")
        else:
            chest_numbers = request.POST.getlist('chest_number[]')
            participant_names = request.POST.getlist('participant_name[]')
            church_ids = request.POST.getlist('church_id[]')
            participant_ids = request.POST.getlist('participant_id[]')
            positions = request.POST.getlist('position[]')
            grades = request.POST.getlist('grade[]')
            grade_points_list = request.POST.getlist('grade_points[]')
            position_points_list = request.POST.getlist('position_points[]')
            remarks_list = request.POST.getlist('remarks[]')
            entry_ids = request.POST.getlist('entry_id[]')

            entries_data = []
            for i in range(len(chest_numbers)):
                chest = chest_numbers[i].strip() if i < len(chest_numbers) else ''
                p_name = participant_names[i].strip() if i < len(participant_names) else ''
                if not chest and not p_name:
                    continue

                c_id = church_ids[i] if i < len(church_ids) else None
                p_id = participant_ids[i] if i < len(participant_ids) else None
                p_id = int(p_id) if p_id and p_id.isdigit() else None
                pos = positions[i] if i < len(positions) else None
                grd = grades[i] if i < len(grades) else ''
                gp = grade_points_list[i] if i < len(grade_points_list) else '0.00'
                pp = position_points_list[i] if i < len(position_points_list) else '0.00'
                rem = remarks_list[i] if i < len(remarks_list) else ''
                e_id = entry_ids[i] if i < len(entry_ids) and entry_ids[i].isdigit() else None

                entries_data.append({
                    'id': e_id,
                    'chest_number': chest,
                    'participant_name': p_name,
                    'church_id': c_id,
                    'participant_id': p_id,
                    'position': pos,
                    'grade': grd,
                    'grade_points': gp,
                    'position_points': pp,
                    'remarks': rem
                })

            try:
                ResultService.correct_published_result(
                    event_result=result,
                    new_entries_data=entries_data,
                    user=request.user,
                    reason=reason
                )
                messages.success(request, f"Published result for {event.code} corrected successfully. Leaderboard points updated.")
                return redirect('portal_result_preview', event_id=event.id)
            except Exception as e:
                messages.error(request, f"Correction failed: {str(e)}")

    entries = result.entries.select_related('church', 'participant').order_by('position', '-total_points')
    context = {
        'event': event,
        'result': result,
        'entries': entries,
        'churches': churches,
        'participants': participants,
    }
    return render(request, 'portal/results/correct_form.html', context)


@admin_required
@role_required(['SUPER_ADMIN'])
@require_POST
def result_delete_draft_action(request, event_id):
    """Deletes draft results (only if status is DRAFT)."""
    event = get_object_or_404(Event, pk=event_id)
    result = get_object_or_404(EventResult, event=event)

    if result.status == EventResult.Status.PUBLISHED:
        messages.error(request, "Cannot delete a published result. Unpublish it first.")
        return redirect('portal_result_preview', event_id=event.id)

    result.delete()
    messages.success(request, f"Draft results for {event.code} deleted.")
    return redirect('portal_result_list')


@admin_required
def result_history_view(request, event_id):
    """Audit history view detailing who created, published, unpublished, and corrected scores."""
    event = get_object_or_404(Event, pk=event_id)
    result = getattr(event, 'result', None)

    audit_logs = AuditLog.objects.filter(
        model_name="EventResult",
        object_id=str(result.id) if result else "-1"
    ).select_related('user').order_by('-timestamp')

    context = {
        'event': event,
        'result': result,
        'audit_logs': audit_logs,
    }
    return render(request, 'portal/results/history.html', context)
