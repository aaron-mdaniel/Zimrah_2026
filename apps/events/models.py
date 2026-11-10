from django.db import models


class Edition(models.Model):
    year = models.PositiveIntegerField(
        unique=True,
        db_index=True,
        help_text="Kalolsavam Year (e.g. 2026)."
    )
    name = models.CharField(
        max_length=100,
        default="ZIMRAH 2026",
        help_text="Official Kalolsavam title."
    )
    theme = models.CharField(
        max_length=150,
        default="Song of Praise",
        help_text="Theme slogan of the festival."
    )
    organizer = models.CharField(
        max_length=200,
        default="CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement",
        help_text="Organizing council or youth movement."
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Marks the active festival edition for public display."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Festival Edition"
        verbose_name_plural = "Festival Editions"
        ordering = ["-year"]

    def __str__(self):
        return f"{self.name} ({self.year})"


class EventCategory(models.Model):
    edition = models.ForeignKey(
        Edition,
        on_delete=models.CASCADE,
        related_name="categories"
    )
    name = models.CharField(
        max_length=100,
        help_text="Category Name in English (e.g., Literary Events, Stage Events)."
    )
    name_malayalam = models.CharField(
        max_length=150,
        blank=True,
        help_text="Category Name in Malayalam (e.g., സാഹിത്യ മത്സരങ്ങൾ, സ്റ്റേജ് മത്സരങ്ങൾ)."
    )
    date = models.DateField(
        null=True,
        blank=True,
        help_text="Event execution date (e.g. 8 Nov 2026 or 14 Nov 2026)."
    )
    venue = models.CharField(
        max_length=200,
        blank=True,
        help_text="Event venue (e.g. Thazhathmon, TVM or St. Mathias CSI Church, Munroethuruth)."
    )

    class Meta:
        verbose_name = "Event Category"
        verbose_name_plural = "Event Categories"
        ordering = ["date", "name"]
        unique_together = ("edition", "name")

    def __str__(self):
        return f"{self.name} - {self.edition.year}"


class EventDivision(models.Model):
    edition = models.ForeignKey(
        Edition,
        on_delete=models.CASCADE,
        related_name="divisions"
    )
    division_number = models.PositiveSmallIntegerField(
        help_text="Division Number (e.g. 1, 2, 3, 4)."
    )
    name = models.CharField(
        max_length=100,
        help_text="Division Name (e.g. Music)."
    )
    name_malayalam = models.CharField(
        max_length=150,
        blank=True,
        help_text="Division Name in Malayalam (e.g. വിഭാഗം - 1: സംഗീതം)."
    )

    class Meta:
        verbose_name = "Event Division"
        verbose_name_plural = "Event Divisions"
        ordering = ["edition", "division_number"]
        unique_together = ("edition", "division_number")

    def __str__(self):
        return f"വിഭാഗം {self.division_number}: {self.name_malayalam or self.name}"


class EventSection(models.Model):
    edition = models.ForeignKey(
        Edition,
        on_delete=models.CASCADE,
        related_name="sections"
    )
    code = models.CharField(
        max_length=20,
        help_text="Short code (e.g., JB, JG, SB, SG, OPEN)."
    )
    name = models.CharField(
        max_length=100,
        help_text="Section Name in English (e.g., Junior Boys, Senior Girls, Open)."
    )
    name_malayalam = models.CharField(
        max_length=150,
        blank=True,
        help_text="Section Name in Malayalam (e.g., ജൂനിയർ ബോയ്സ്)."
    )

    class Meta:
        verbose_name = "Event Section"
        verbose_name_plural = "Event Sections"
        ordering = ["edition", "code"]
        unique_together = ("edition", "code")

    def __str__(self):
        return f"{self.name} ({self.name_malayalam})" if self.name_malayalam else self.name


class Event(models.Model):
    class EventType(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'Individual'
        GROUP = 'GROUP', 'Group'

    edition = models.ForeignKey(
        Edition,
        on_delete=models.CASCADE,
        related_name="events"
    )
    code = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Unique event code within edition (e.g. EV01, EV16)."
    )
    name = models.CharField(
        max_length=150,
        help_text="Competition name in English."
    )
    name_malayalam = models.CharField(
        max_length=200,
        help_text="Competition name in Malayalam (e.g., സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്)."
    )
    category = models.ForeignKey(
        EventCategory,
        on_delete=models.PROTECT,
        related_name="events"
    )
    division = models.ForeignKey(
        EventDivision,
        on_delete=models.PROTECT,
        related_name="events",
        null=True,
        blank=True
    )
    section = models.ForeignKey(
        EventSection,
        on_delete=models.PROTECT,
        related_name="events",
        null=True,
        blank=True
    )
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.INDIVIDUAL,
        help_text="Individual or Group event."
    )
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Duration in minutes (e.g., 5)."
    )
    duration_display = models.CharField(
        max_length=50,
        blank=True,
        help_text="Duration text for UI (e.g., '5 മിനിറ്റ്', '3+5 മിനിറ്റ്സ്')."
    )
    min_participants = models.PositiveIntegerField(
        default=1,
        help_text="Minimum participants required for entry (1 for individual)."
    )
    max_participants = models.PositiveIntegerField(
        default=1,
        help_text="Maximum participants allowed in team (1 for individual, 4 for quartet, etc.)."
    )
    max_entries_per_church = models.PositiveIntegerField(
        default=1,
        help_text="Maximum number of entries permitted from each church."
    )
    contributes_to_individual = models.BooleanField(
        default=True,
        help_text="Whether this event's points count toward the Individual Championship leaderboard."
    )
    contributes_to_church = models.BooleanField(
        default=True,
        help_text="Whether this event's points count toward the Church Championship leaderboard."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ["code"]
        constraints = [
            models.UniqueConstraint(
                fields=["edition", "code"],
                name="unique_event_code_per_edition"
            )
        ]
        indexes = [
            models.Index(fields=["edition", "code"]),
            models.Index(fields=["edition", "category"]),
            models.Index(fields=["edition", "division"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name_malayalam or self.name}"
