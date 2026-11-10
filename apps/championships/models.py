from decimal import Decimal
from django.db import models


class PointLedger(models.Model):
    class Target(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'Individual Championship'
        CHURCH = 'CHURCH', 'Church Championship'

    edition = models.ForeignKey(
        'events.Edition',
        on_delete=models.CASCADE,
        related_name="point_ledgers"
    )
    result_entry = models.ForeignKey(
        'results.ResultEntry',
        on_delete=models.CASCADE,
        related_name="ledger_entries",
        help_text="The published result entry that originated this point allocation."
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.PROTECT,
        related_name="ledger_entries"
    )
    church = models.ForeignKey(
        'churches.Church',
        on_delete=models.PROTECT,
        related_name="ledger_entries"
    )
    participant = models.ForeignKey(
        'participants.Participant',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
        help_text="Participant credited (applicable only for individual target)."
    )
    target = models.CharField(
        max_length=20,
        choices=Target.choices,
        db_index=True,
        help_text="Whether this point counts toward the Church or Individual leaderboard."
    )
    points = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Points earned."
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Flag indicating if the points actively count toward the leaderboard (deactivated if result is unpublished or superseded)."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Point Ledger Entry"
        verbose_name_plural = "Point Ledger Entries"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["edition", "target", "is_active"]),
            models.Index(fields=["church", "is_active"]),
            models.Index(fields=["participant", "is_active"]),
        ]

    def __str__(self):
        dest = self.participant.name if self.participant else self.church.name
        return f"{self.target}: {dest} +{self.points} pts from {self.event.code}"
