from django.db import models


class Participant(models.Model):
    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'

    class AgeCategory(models.TextChoices):
        JUNIOR = 'JUNIOR', 'Junior'
        SENIOR = 'SENIOR', 'Senior'
        OPEN = 'OPEN', 'Open'

    edition = models.ForeignKey(
        'events.Edition',
        on_delete=models.CASCADE,
        related_name="participants"
    )
    chest_number = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Chest number uniquely assigned to the participant for this festival edition."
    )
    name = models.CharField(
        max_length=150,
        db_index=True,
        help_text="Participant's full name in English."
    )
    name_malayalam = models.CharField(
        max_length=150,
        blank=True,
        help_text="Participant's name in Malayalam."
    )
    gender = models.CharField(
        max_length=1,
        choices=Gender.choices,
        help_text="Gender."
    )
    church = models.ForeignKey(
        'churches.Church',
        on_delete=models.PROTECT,
        related_name="participants",
        help_text="Parish / Church represented."
    )
    age_category = models.CharField(
        max_length=10,
        choices=AgeCategory.choices,
        default=AgeCategory.OPEN,
        help_text="Age division (Junior / Senior / Open)."
    )
    phone = models.CharField(
        max_length=25,
        blank=True,
        help_text="Contact telephone number."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Participant"
        verbose_name_plural = "Participants"
        ordering = ["chest_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["edition", "chest_number"],
                name="unique_chest_number_per_edition"
            )
        ]
        indexes = [
            models.Index(fields=["edition", "chest_number"]),
            models.Index(fields=["edition", "church"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"#{self.chest_number} - {self.name} ({self.church.name})"
