from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.views.decorators.http import require_POST

from .models import Church
from .forms import ChurchForm
from apps.accounts.decorators import admin_required, role_required
from apps.audit.utils import log_activity


@admin_required
def church_list(request):
    query = request.GET.get('q', '').strip()
    status_filter = request.GET.get('status', 'all')

    churches = Church.objects.annotate(
        participant_count=Count('participants', distinct=True),
        registration_count=Count('registrations', distinct=True)
    ).order_by('code')

    if query:
        churches = churches.filter(
            Q(code__icontains=query) |
            Q(name__icontains=query) |
            Q(name_malayalam__icontains=query) |
            Q(vicar_name__icontains=query)
        )

    if status_filter == 'active':
        churches = churches.filter(is_active=True)
    elif status_filter == 'inactive':
        churches = churches.filter(is_active=False)

    paginator = Paginator(churches, 15)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'page_obj': page_obj,
        'query': query,
        'status_filter': status_filter,
        'total_churches': churches.count(),
    }
    return render(request, 'portal/churches/list.html', context)


@admin_required
@role_required(['SUPER_ADMIN'])
def church_add(request):
    if request.method == 'POST':
        form = ChurchForm(request.POST)
        if form.is_valid():
            church = form.save()
            log_activity(request, 'CHURCH_CREATED', church, {'code': church.code, 'name': church.name})
            messages.success(request, f"Church '{church.code} - {church.name}' added successfully.")
            return redirect('portal_church_detail', pk=church.pk)
    else:
        form = ChurchForm()

    return render(request, 'portal/churches/form.html', {'form': form, 'title': 'Add Church'})


@admin_required
def church_detail(request, pk):
    church = get_object_or_404(
        Church.objects.annotate(
            participant_count=Count('participants', distinct=True),
            registration_count=Count('registrations', distinct=True)
        ),
        pk=pk
    )
    participants = church.participants.order_by('chest_number')[:20]
    registrations = church.registrations.select_related('event', 'participant').order_by('event__code')

    context = {
        'church': church,
        'participants': participants,
        'registrations': registrations,
    }
    return render(request, 'portal/churches/detail.html', context)


@admin_required
@role_required(['SUPER_ADMIN'])
def church_edit(request, pk):
    church = get_object_or_404(Church, pk=pk)
    if request.method == 'POST':
        form = ChurchForm(request.POST, instance=church)
        if form.is_valid():
            old_code = church.code
            church = form.save()
            log_activity(request, 'CHURCH_UPDATED', church, {'code': church.code, 'name': church.name})
            messages.success(request, f"Church '{church.code} - {church.name}' updated successfully.")
            return redirect('portal_church_detail', pk=church.pk)
    else:
        form = ChurchForm(instance=church)

    return render(request, 'portal/churches/form.html', {'form': form, 'title': f'Edit Church: {church.code}', 'church': church})


@admin_required
@role_required(['SUPER_ADMIN'])
@require_POST
def church_toggle_status(request, pk):
    church = get_object_or_404(Church, pk=pk)
    church.is_active = not church.is_active
    church.save()
    status_str = "Activated" if church.is_active else "Deactivated"
    log_activity(request, f'CHURCH_{status_str.upper()}', church, {'is_active': church.is_active})
    messages.success(request, f"Church {church.code} is now {status_str.lower()}.")
    return redirect('portal_church_detail', pk=church.pk)
