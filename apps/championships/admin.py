from django.contrib import admin
from .models import PointLedger


@admin.register(PointLedger)
class PointLedgerAdmin(admin.ModelAdmin):
    list_display = ('id', 'target', 'edition', 'church', 'participant', 'event', 'points', 'is_active', 'created_at')
    list_filter = ('target', 'is_active', 'edition', 'church')
    search_fields = ('church__name', 'participant__name', 'event__code')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
