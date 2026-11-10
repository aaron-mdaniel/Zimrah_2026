from django.contrib import admin
from .models import Church


@admin.register(Church)
class ChurchAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'name_malayalam', 'district', 'vicar_name', 'contact_phone', 'is_active')
    search_fields = ('code', 'name', 'name_malayalam', 'vicar_name', 'contact_phone')
    list_filter = ('is_active', 'district')
    ordering = ('code',)
