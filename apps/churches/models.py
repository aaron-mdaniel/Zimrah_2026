from django.db import models


class Church(models.Model):
    code = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text="Unique church identifier code (e.g., CH01, CH02)."
    )
    name = models.CharField(
        max_length=150,
        db_index=True,
        help_text="Official name of the Church / Parish."
    )
    name_malayalam = models.CharField(
        max_length=200,
        blank=True,
        help_text="Church name in Malayalam script."
    )
    district = models.CharField(
        max_length=100,
        default="Adoor Clergy District",
        help_text="Clergy district or diocese administrative division."
    )
    vicar_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Name of the Parish Priest / Vicar."
    )
    youth_leader_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Name of the Youth Movement Secretary / Convenor."
    )
    contact_phone = models.CharField(
        max_length=25,
        blank=True,
        help_text="Primary contact phone number."
    )
    contact_email = models.EmailField(
        blank=True,
        help_text="Official contact email address."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Active status of the church for event participation."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Church"
        verbose_name_plural = "Churches"
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["name"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
