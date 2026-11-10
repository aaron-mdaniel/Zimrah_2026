from django.contrib import admin
from .models import Participant


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('chest_number', 'name', 'gender', 'church', 'age_category', 'edition', 'phone')
    list_filter = ('edition', 'church', 'gender', 'age_category')
    search_fields = ('chest_number', 'name', 'phone')
    ordering = ('chest_number',)
