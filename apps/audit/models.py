from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )
    action = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Action performed (e.g. RESULT_ENTRY_SAVED, RESULT_PUBLISHED, RESULT_CORRECTED)."
    )
    model_name = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Target model affected."
    )
    object_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Primary key of modified record."
    )
    object_repr = models.CharField(
        max_length=200,
        blank=True,
        help_text="String representation of modified record."
    )
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Delta dictionary detailing old and new values."
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Client IP address where request originated."
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp"]),
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        repr_info = f" ({self.object_repr})" if self.object_repr else ""
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {user_str} - {self.action} on {self.model_name} #{self.object_id}{repr_info}"
