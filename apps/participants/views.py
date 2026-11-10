import csv
import io
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.db import transaction

from .models import Participant
from .forms import ParticipantForm, ParticipantCSVImportForm
from apps.events.models import Edition
from apps.churches.models import Church
from apps.accounts.decorators import admin_required, role_required
from apps.audit.utils import log_activity


@admin_required
def participant_list(request):
    query = request.GET.get('q', '').strip()
    church_id = request.GET.get('church', '')
    age_filter = request.GET.get('age', '')

    participants = Participant.objects.select_related('church', 'edition').order_by('chest_number')

    if query:
        participants = participants.filter(
            Q(chest_number__icontains=query) |
            Q(name__icontains=query) |
            Q(name_malayalam__icontains=query) |
            Q(phone__icontains=query)
        )

    if church_id:
        participants = participants.filter(church_id=church_id)

    if age_filter:
        participants = participants.filter(age_category=age_filter)

    paginator = Paginator(participants, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    churches = Church.objects.filter(is_active=True).order_by('code')

    context = {
        'page_obj': page_obj,
        'query': query,
        'church_id': church_id,
        'age_filter': age_filter,
        'churches': churches,
        'total_participants': participants.count(),
    }
    return render(request, 'portal/participants/list.html', context)


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
def participant_add(request):
    if request.method == 'POST':
        form = ParticipantForm(request.POST)
        if form.is_valid():
            participant = form.save()
            log_activity(
                request,
                'PARTICIPANT_CREATED',
                participant,
                {'chest_number': participant.chest_number, 'name': participant.name, 'church': participant.church.code}
            )
            messages.success(request, f"Participant #{participant.chest_number} ({participant.name}) added successfully.")
            return redirect('portal_participant_detail', pk=participant.pk)
    else:
        form = ParticipantForm()

    return render(request, 'portal/participants/form.html', {'form': form, 'title': 'Add Participant'})


@admin_required
def participant_detail(request, pk):
    participant = get_object_or_404(Participant.objects.select_related('church', 'edition'), pk=pk)
    registrations = participant.registrations.select_related('event', 'event__category', 'event__division').order_by('event__code')

    context = {
        'participant': participant,
        'registrations': registrations,
    }
    return render(request, 'portal/participants/detail.html', context)


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
def participant_edit(request, pk):
    participant = get_object_or_404(Participant, pk=pk)
    if request.method == 'POST':
        form = ParticipantForm(request.POST, instance=participant)
        if form.is_valid():
            participant = form.save()
            log_activity(
                request,
                'PARTICIPANT_UPDATED',
                participant,
                {'chest_number': participant.chest_number, 'name': participant.name}
            )
            messages.success(request, f"Participant #{participant.chest_number} updated successfully.")
            return redirect('portal_participant_detail', pk=participant.pk)
    else:
        form = ParticipantForm(instance=participant)

    return render(request, 'portal/participants/form.html', {'form': form, 'title': f'Edit Participant #{participant.chest_number}', 'participant': participant})


@admin_required
@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])
def participant_import_csv(request):
    if request.method == 'POST':
        form = ParticipantCSVImportForm(request.POST, request.FILES)
        if form.is_valid():
            csv_file = request.FILES['csv_file']
            edition = form.cleaned_data['edition']

            try:
                # Read with UTF-8 / UTF-8-sig to handle Excel BOM and Malayalam script cleanly
                file_data = csv_file.read()
                try:
                    decoded_file = file_data.decode('utf-8-sig')
                except UnicodeDecodeError:
                    decoded_file = file_data.decode('latin-1')

                io_string = io.StringIO(decoded_file)
                reader = csv.DictReader(io_string)

                created_count = 0
                errors = []
                row_idx = 1

                church_cache = {c.code.upper(): c for c in Church.objects.all()}

                with transaction.atomic():
                    for row in reader:
                        row_idx += 1
                        # Clean keys and values
                        cleaned_row = {k.strip().lower() if k else '': v.strip() if v else '' for k, v in row.items()}

                        chest_no = cleaned_row.get('chest_number') or cleaned_row.get('chest_no') or cleaned_row.get('chest')
                        name = cleaned_row.get('name') or cleaned_row.get('full_name')
                        name_mal = cleaned_row.get('name_malayalam', '')
                        gender = (cleaned_row.get('gender') or 'M').upper()[:1]
                        church_code = (cleaned_row.get('church_code') or cleaned_row.get('church') or '').upper()
                        age_cat = (cleaned_row.get('age_category') or cleaned_row.get('category') or 'OPEN').upper()
                        phone = cleaned_row.get('phone', '')

                        if not chest_no or not name:
                            errors.append(f"Row {row_idx}: Missing chest_number or name.")
                            continue

                        # Check church code
                        church = church_cache.get(church_code)
                        if not church:
                            errors.append(f"Row {row_idx}: Church code '{church_code}' not found.")
                            continue

                        # Check chest number collision within edition
                        if Participant.objects.filter(edition=edition, chest_number=chest_no).exists():
                            errors.append(f"Row {row_idx}: Chest number '{chest_no}' already exists in {edition.name}.")
                            continue

                        if gender not in ['M', 'F']:
                            gender = 'M'

                        if age_cat not in ['JUNIOR', 'SENIOR', 'OPEN']:
                            age_cat = 'OPEN'

                        # Create participant preserving chest_no leading zero
                        Participant.objects.create(
                            edition=edition,
                            chest_number=str(chest_no),
                            name=name,
                            name_malayalam=name_mal,
                            gender=gender,
                            church=church,
                            age_category=age_cat,
                            phone=phone
                        )
                        created_count += 1

                if created_count > 0:
                    log_activity(
                        request,
                        'PARTICIPANTS_IMPORTED_CSV',
                        edition,
                        {'count': created_count, 'filename': csv_file.name}
                    )
                    messages.success(request, f"Successfully imported {created_count} participants into {edition.name}!")

                if errors:
                    messages.warning(request, f"{len(errors)} rows were skipped due to errors. See details below.")

                return render(request, 'portal/participants/import_result.html', {
                    'created_count': created_count,
                    'errors': errors,
                    'edition': edition
                })

            except Exception as e:
                messages.error(request, f"Failed to process CSV file: {str(e)}")
    else:
        form = ParticipantCSVImportForm()

    return render(request, 'portal/participants/import.html', {'form': form})


@admin_required
def participant_sample_csv(request):
    """Generates and downloads a sample CSV template for participant import."""
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="zimrah_participants_sample.csv"'
    response.write(u'\ufeff'.encode('utf8'))  # Write UTF-8 BOM for Microsoft Excel

    writer = csv.writer(response)
    writer.writerow(['chest_number', 'name', 'name_malayalam', 'gender', 'church_code', 'age_category', 'phone'])
    writer.writerow(['001', 'Aaron Samuel', 'ആരോൺ സാമുവൽ', 'M', 'CH01', 'JUNIOR', '9876543210'])
    writer.writerow(['002', 'Sherin Mathew', 'ഷെറിൻ മാത്യു', 'F', 'CH01', 'SENIOR', '9876543211'])
    writer.writerow(['003', 'Joel Thomas', 'ജോയൽ തോമസ്', 'M', 'CH02', 'JUNIOR', '9876543212'])
    return response
