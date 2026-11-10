from django.contrib import admin
from .models import EventResult, ResultEntry, ResultParticipant


class ResultEntryInline(admin.TabularInline):
    model = ResultEntry
    extra = 1
    fields = ('position', 'chest_number', 'participant_name', 'church', 'participant', 'grade', 'grade_points', 'position_points', 'total_points', 'remarks')
    readonly_fields = ('total_points',)


@admin.register(EventResult)
class EventResultAdmin(admin.ModelAdmin):
    list_display = ('event', 'status', 'published_by', 'published_at', 'updated_at')
    list_filter = ('status', 'event__category', 'event__edition')
    search_fields = ('event__code', 'event__name', 'event__name_malayalam')
    inlines = [ResultEntryInline]


class ResultParticipantInline(admin.TabularInline):
    model = ResultParticipant
    extra = 1


@admin.register(ResultEntry)
class ResultEntryAdmin(admin.ModelAdmin):
    list_display = ('event_result', 'position', 'chest_number', 'participant_name', 'church', 'grade', 'grade_points', 'position_points', 'total_points')
    list_filter = ('position', 'grade', 'church', 'event_result__event__edition')
    search_fields = ('chest_number', 'participant_name', 'church__name')
    readonly_fields = ('total_points',)
    inlines = [ResultParticipantInline]
