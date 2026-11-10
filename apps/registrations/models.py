from django.db import models


class Registration(models.Model):
    edition = models.ForeignKey(
        'events.Edition',
        on_delete=models.CASCADE,
        related_name="registrations"
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.PROTECT,
        related_name="registrations"
    )
    church = models.ForeignKey(
        'churches.Church',
        on_delete=models.PROTECT,
        related_name="registrations"
    )
    participant = models.ForeignKey(
        'participants.Participant',
        on_delete=models.PROTECT,
        related_name="registrations",
        null=True,
        blank=True,
        help_text="Single participant for individual competitions. Left null for church group entries."
    )
    group_name = models.CharField(
        max_length=150,
        blank=True,
        help_text="Team name for group events (e.g. 'St. Thomas Choir', 'Team A')."
    )
    chest_number = models.CharField(
        max_length=20,
        blank=True,
        db_index=True,
        help_text="Event-specific chest number or group chest number."
    )
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Registration"
        verbose_name_plural = "Registrations"
        ordering = ["event", "chest_number"]
        indexes = [
            models.Index(fields=["edition", "event"]),
            models.Index(fields=["edition", "church"]),
            models.Index(fields=["chest_number"]),
        ]

    def __str__(self):
        target = self.participant.name if self.participant else (self.group_name or f"Team {self.church.code}")
        return f"{self.event.code} - {target} ({self.church.name})"


class GroupRegistrationMember(models.Model):
    registration = models.ForeignKey(
        Registration,
        on_delete=models.CASCADE,
        related_name="members"
    )
    participant = models.ForeignKey(
        'participants.Participant',
        on_delete=models.PROTECT,
        related_name="group_registrations"
    )
    role = models.CharField(
        max_length=50,
        blank=True,
        help_text="Role in team (e.g., Lead Vocalist, Instrumentalist)."
    )

    class Meta:
        verbose_name = "Group Registration Member"
        verbose_name_plural = "Group Registration Members"
        unique_together = ("registration", "participant")

    def __str__(self):
        return f"{self.participant.name} in {self.registration}"
