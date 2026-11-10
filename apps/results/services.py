from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from .models import EventResult, ResultEntry, ResultParticipant
from apps.events.models import Event
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.championships.models import PointLedger
from apps.audit.models import AuditLog


def sanitize_decimal(value, default=Decimal('0.00')):
    """Safely converts string or float value to Decimal with 2 decimal places."""
    if value is None or value == '':
        return default
    try:
        return Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(f"Invalid decimal value: '{value}'")


class ResultService:
    @staticmethod
    @transaction.atomic
    def save_result_draft(event, entries_data, user=None, notes=""):
        """
        Saves or updates event results in DRAFT state.
        Recalculates total_points securely on the backend: Total = Grade Points + Position Points.
        """
        # Lock or get existing EventResult
        event_result, created = EventResult.objects.select_for_update().get_or_create(
            event=event,
            defaults={'status': EventResult.Status.DRAFT, 'created_by': user, 'notes': notes}
        )

        if not created and notes:
            event_result.notes = notes
            event_result.save(update_fields=['notes', 'updated_at'])

        # Keep track of existing entries if updating
        existing_entries = {e.id: e for e in event_result.entries.all()}
        updated_entry_ids = []

        for item in entries_data:
            entry_id = item.get('id')
            position = item.get('position')
            position = int(position) if position not in (None, '', 'None') else None

            chest_number = str(item.get('chest_number', '')).strip()
            participant_name = str(item.get('participant_name', '')).strip()
            church_id = item.get('church_id') or item.get('church')
            participant_id = item.get('participant_id') or item.get('participant')
            grade = str(item.get('grade', '')).strip().upper() or ''
            remarks = str(item.get('remarks', '')).strip()

            grade_pts = sanitize_decimal(item.get('grade_points', '0.00'))
            position_pts = sanitize_decimal(item.get('position_points', '0.00'))

            # Mandatory backend calculation: never trust client total_points
            calc_total = grade_pts + position_pts

            if not chest_number or not participant_name:
                raise ValidationError("Chest number and participant name are required for every entry.")

            church = Church.objects.get(pk=church_id)
            participant = Participant.objects.filter(pk=participant_id).first() if participant_id else None

            if entry_id and int(entry_id) in existing_entries:
                entry = existing_entries[int(entry_id)]
                entry.position = position
                entry.chest_number = chest_number
                entry.participant_name = participant_name
                entry.church = church
                entry.participant = participant
                entry.grade = grade
                entry.grade_points = grade_pts
                entry.position_points = position_pts
                entry.total_points = calc_total
                entry.remarks = remarks
                entry.save()
                updated_entry_ids.append(entry.id)
            else:
                entry = ResultEntry.objects.create(
                    event_result=event_result,
                    position=position,
                    chest_number=chest_number,
                    participant_name=participant_name,
                    church=church,
                    participant=participant,
                    grade=grade,
                    grade_points=grade_pts,
                    position_points=position_pts,
                    total_points=calc_total,
                    remarks=remarks
                )
                updated_entry_ids.append(entry.id)

            # Handle group participants if provided
            group_members_data = item.get('group_members', [])
            if group_members_data:
                # Clear and re-assign
                entry.participants.all().delete()
                for member_item in group_members_data:
                    m_part_id = member_item.get('participant_id') or member_item.get('participant')
                    m_role = member_item.get('role', '')
                    m_pts = sanitize_decimal(member_item.get('points_allocated', '0.00'))
                    if m_part_id:
                        ResultParticipant.objects.create(
                            result_entry=entry,
                            participant_id=m_part_id,
                            role=m_role,
                            points_allocated=m_pts
                        )

        # Remove deleted entries
        to_delete_ids = set(existing_entries.keys()) - set(updated_entry_ids)
        if to_delete_ids:
            ResultEntry.objects.filter(id__in=to_delete_ids).delete()

        action_name = "RESULT_DRAFT_CREATED" if created else "RESULT_DRAFT_UPDATED"
        AuditLog.objects.create(
            user=user,
            action=action_name,
            model_name="EventResult",
            object_id=str(event_result.id),
            object_repr=f"Result for {event.code} ({event.name})",
            changes={'status': 'DRAFT', 'entries_count': len(updated_entry_ids)}
        )

        return event_result

    @staticmethod
    @transaction.atomic
    def publish_result(event_result, user=None):
        """
        Publishes verified result entries.
        Generates immutable Point Ledger entries for Church and Individual leaderboards.
        Guarantees church points are credited once per team result.
        """
        # Re-fetch with row lock
        result = EventResult.objects.select_for_update().get(pk=event_result.pk)

        if result.status == EventResult.Status.PUBLISHED:
            raise ValidationError("This event result is already published.")

        if not result.entries.exists():
            raise ValidationError("Cannot publish an event result with zero entries.")

        event = result.event
        edition = event.edition

        # Deactivate any legacy ledger entries for this result
        PointLedger.objects.filter(result_entry__event_result=result).update(is_active=False)

        # Generate fresh active Point Ledger records
        for entry in result.entries.all():
            if entry.total_points > Decimal('0.00'):
                # 1. Church Championship Point Ledger (awarded once per entry)
                PointLedger.objects.create(
                    edition=edition,
                    result_entry=entry,
                    event=event,
                    church=entry.church,
                    participant=None,
                    target=PointLedger.Target.CHURCH,
                    points=entry.total_points,
                    is_active=True
                )

                # 2. Individual Championship Point Ledger
                if event.event_type == Event.EventType.INDIVIDUAL:
                    if event.contributes_to_individual and entry.participant:
                        PointLedger.objects.create(
                            edition=edition,
                            result_entry=entry,
                            event=event,
                            church=entry.church,
                            participant=entry.participant,
                            target=PointLedger.Target.INDIVIDUAL,
                            points=entry.total_points,
                            is_active=True
                        )
                else:
                    # Group Event: check if explicit participant allocation was configured
                    for rp in entry.participants.all():
                        if rp.points_allocated > Decimal('0.00'):
                            PointLedger.objects.create(
                                edition=edition,
                                result_entry=entry,
                                event=event,
                                church=entry.church,
                                participant=rp.participant,
                                target=PointLedger.Target.INDIVIDUAL,
                                points=rp.points_allocated,
                                is_active=True
                            )

        # Mark Result as PUBLISHED
        result.status = EventResult.Status.PUBLISHED
        result.published_by = user
        result.published_at = timezone.now()
        result.save(update_fields=['status', 'published_by', 'published_at', 'updated_at'])

        # Audit Trail
        AuditLog.objects.create(
            user=user,
            action="RESULT_PUBLISHED",
            model_name="EventResult",
            object_id=str(result.id),
            object_repr=f"Result for {event.code}",
            changes={'status': {'old': 'DRAFT', 'new': 'PUBLISHED'}, 'entries_published': result.entries.count()}
        )

        return result

    @staticmethod
    @transaction.atomic
    def unpublish_result(event_result, user=None, reason=""):
        """
        Unpublishes an event result, reverting status to DRAFT.
        Immediately deactivates all active point ledger entries so they vanish from leaderboards.
        """
        result = EventResult.objects.select_for_update().get(pk=event_result.pk)

        if result.status != EventResult.Status.PUBLISHED:
            raise ValidationError("This result is not currently published.")

        # Deactivate all active ledger points
        deactivated_count = PointLedger.objects.filter(
            result_entry__event_result=result,
            is_active=True
        ).update(is_active=False)

        prev_published_at = result.published_at.isoformat() if result.published_at else None

        result.status = EventResult.Status.DRAFT
        result.published_by = None
        result.published_at = None
        result.save(update_fields=['status', 'published_by', 'published_at', 'updated_at'])

        AuditLog.objects.create(
            user=user,
            action="RESULT_UNPUBLISHED",
            model_name="EventResult",
            object_id=str(result.id),
            object_repr=f"Result for {result.event.code}",
            changes={
                'status': {'old': 'PUBLISHED', 'new': 'DRAFT'},
                'deactivated_ledger_count': deactivated_count,
                'reason': reason,
                'prev_published_at': prev_published_at
            }
        )

        return result

    @staticmethod
    @transaction.atomic
    def correct_published_result(event_result, new_entries_data, user=None, reason=""):
        """
        Applies corrections to an already published result.
        Captures previous scores vs. new scores in audit log and updates Point Ledger atomically.
        """
        result = EventResult.objects.select_for_update().get(pk=event_result.pk)
        event = result.event
        edition = event.edition

        # Capture old scores for audit trail
        old_scores = {
            e.chest_number: {
                'participant': e.participant_name,
                'position': e.position,
                'grade': e.grade,
                'total_points': str(e.total_points)
            }
            for e in result.entries.all()
        }

        # Save new entries with secure recalculation
        ResultService.save_result_draft(event, new_entries_data, user=user, notes=result.notes)

        # Deactivate old ledger entries and re-post updated ledger points
        PointLedger.objects.filter(result_entry__event_result=result).update(is_active=False)

        new_scores = {}
        for entry in result.entries.all():
            new_scores[entry.chest_number] = {
                'participant': entry.participant_name,
                'position': entry.position,
                'grade': entry.grade,
                'total_points': str(entry.total_points)
            }

            if entry.total_points > Decimal('0.00'):
                # Church points
                PointLedger.objects.create(
                    edition=edition,
                    result_entry=entry,
                    event=event,
                    church=entry.church,
                    target=PointLedger.Target.CHURCH,
                    points=entry.total_points,
                    is_active=True
                )

                # Individual points
                if event.event_type == Event.EventType.INDIVIDUAL:
                    if event.contributes_to_individual and entry.participant:
                        PointLedger.objects.create(
                            edition=edition,
                            result_entry=entry,
                            event=event,
                            church=entry.church,
                            participant=entry.participant,
                            target=PointLedger.Target.INDIVIDUAL,
                            points=entry.total_points,
                            is_active=True
                        )
                else:
                    for rp in entry.participants.all():
                        if rp.points_allocated > Decimal('0.00'):
                            PointLedger.objects.create(
                                edition=edition,
                                result_entry=entry,
                                event=event,
                                church=entry.church,
                                participant=rp.participant,
                                target=PointLedger.Target.INDIVIDUAL,
                                points=rp.points_allocated,
                                is_active=True
                            )

        # Ensure result stays published
        result.status = EventResult.Status.PUBLISHED
        result.updated_at = timezone.now()
        result.save(update_fields=['status', 'updated_at'])

        AuditLog.objects.create(
            user=user,
            action="RESULT_CORRECTED",
            model_name="EventResult",
            object_id=str(result.id),
            object_repr=f"Result for {event.code}",
            changes={
                'reason': reason,
                'old_scores': old_scores,
                'new_scores': new_scores
            }
        )

        return result
