from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        RESULT_ADMIN = 'RESULT_ADMIN', 'Result Admin'
        PUBLISHER = 'PUBLISHER', 'Publisher'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.RESULT_ADMIN,
        help_text="Role determining administrative permissions."
    )
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    @property
    def is_super_admin(self):
        return self.is_superuser or self.role == self.Role.SUPER_ADMIN

    @property
    def is_publisher(self):
        return self.is_super_admin or self.role == self.Role.PUBLISHER

    @property
    def is_result_admin(self):
        return self.is_super_admin or self.role in (self.Role.RESULT_ADMIN, self.Role.PUBLISHER)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
