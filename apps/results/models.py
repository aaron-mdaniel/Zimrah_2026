from decimal import Decimal
from django.db import models
from django.conf import settings


class EventResult(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        VERIFIED = 'VERIFIED', 'Verified'
        PUBLISHED = 'PUBLISHED', 'Published'

    event = models.OneToOneField(
        'events.Event',
        on_delete=models.PROTECT,
        related_name="result",
        help_text="The competition event for which results are recorded."
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        help_text="Publication status: DRAFT is private, PUBLISHED is publicly visible and calculated."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_results",
        null=True,
        blank=True
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="published_results",
        null=True,
        blank=True
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the result was made public."
    )
    notes = models.TextField(
        blank=True,
        help_text="Internal administrative remarks or judge panel references."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Event Result"
        verbose_name_plural = "Event Results"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Result for {self.event.code} ({self.get_status_display()})"


class ResultEntry(models.Model):
    POSITION_CHOICES = [
        (1, '1st Position'),
        (2, '2nd Position'),
        (3, '3rd Position'),
    ]

    GRADE_CHOICES = [
        ('A', 'A Grade'),
        ('B', 'B Grade'),
        ('C', 'C Grade'),
    ]

    event_result = models.ForeignKey(
        EventResult,
        on_delete=models.CASCADE,
        related_name="entries"
    )
    position = models.PositiveSmallIntegerField(
        choices=POSITION_CHOICES,
        null=True,
        blank=True,
        help_text="1st, 2nd, or 3rd position if awarded."
    )
    chest_number = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Chest number of the participant or group."
    )
    participant_name = models.CharField(
        max_length=150,
        db_index=True,
        help_text="Name of participant or group title."
    )
    church = models.ForeignKey(
        'churches.Church',
        on_delete=models.PROTECT,
        related_name="result_entries",
        help_text="Church / Parish represented."
    )
    participant = models.ForeignKey(
        'participants.Participant',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="result_entries",
        help_text="Direct link to participant profile for individual competitions."
    )
    grade = models.CharField(
        max_length=5,
        choices=GRADE_CHOICES,
        blank=True,
        help_text="Grade achieved (A, B, C)."
    )
    grade_points = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Decimal points awarded for the grade achieved."
    )
    position_points = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Decimal points awarded for 1st, 2nd, or 3rd position."
    )
    total_points = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Computed: Total Points = Grade Points + Position Points."
    )
    remarks = models.CharField(
        max_length=255,
        blank=True,
        help_text="Special mentions or tie status."
    )

    class Meta:
        verbose_name = "Result Entry"
        verbose_name_plural = "Result Entries"
        ordering = ["position", "-total_points", "chest_number"]
        indexes = [
            models.Index(fields=["event_result", "position"]),
            models.Index(fields=["church"]),
            models.Index(fields=["chest_number"]),
        ]

    def save(self, *args, **kwargs):
        # Automatically calculate Total Points = Grade Points + Position Points
        gp = self.grade_points if self.grade_points is not None else Decimal('0.00')
        pp = self.position_points if self.position_points is not None else Decimal('0.00')
        self.total_points = gp + pp
        super().save(*args, **kwargs)

    def __str__(self):
        pos = f"[{self.get_position_display()}] " if self.position else ""
        return f"{pos}{self.participant_name} (#{self.chest_number}) - {self.total_points} pts"


class ResultParticipant(models.Model):
    result_entry = models.ForeignKey(
        ResultEntry,
        on_delete=models.CASCADE,
        related_name="participants"
    )
    participant = models.ForeignKey(
        'participants.Participant',
        on_delete=models.PROTECT,
        related_name="result_participations"
    )
    role = models.CharField(
        max_length=50,
        blank=True,
        help_text="Participant role in group performance."
    )
    points_allocated = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Individual championship points credited to this participant from this group result."
    )

    class Meta:
        verbose_name = "Result Participant"
        verbose_name_plural = "Result Participants"
        unique_together = ("result_entry", "participant")

    def __str__(self):
        return f"{self.participant.name} in Result #{self.result_entry.id}"
