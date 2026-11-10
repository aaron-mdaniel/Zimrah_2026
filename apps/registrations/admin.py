from django.contrib import admin
from .models import Registration, GroupRegistrationMember


class GroupRegistrationMemberInline(admin.TabularInline):
    model = GroupRegistrationMember
    extra = 1


@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ('event', 'chest_number', 'participant', 'group_name', 'church', 'edition', 'registered_at')
    list_filter = ('edition', 'event__category', 'event', 'church')
    search_fields = ('chest_number', 'participant__name', 'group_name', 'church__name')
    inlines = [GroupRegistrationMemberInline]
