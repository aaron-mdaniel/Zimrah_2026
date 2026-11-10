from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'email', 'phone')
    ordering = ('username',)

    fieldsets = BaseUserAdmin.fieldsets + (
        ('ZIMRAH Permissions', {
            'fields': ('role', 'phone'),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('ZIMRAH Permissions', {
            'fields': ('role', 'phone'),
        }),
    )
