from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'model_name', 'object_id', 'object_repr', 'ip_address')
    list_filter = ('action', 'model_name', 'timestamp')
    search_fields = ('action', 'model_name', 'object_id', 'object_repr', 'user__username', 'ip_address')
    readonly_fields = ('timestamp', 'user', 'action', 'model_name', 'object_id', 'object_repr', 'changes', 'ip_address')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
