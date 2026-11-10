from django.contrib import admin
from .models import Edition, EventCategory, EventDivision, EventSection, Event


@admin.register(Edition)
class EditionAdmin(admin.ModelAdmin):
    list_display = ('year', 'name', 'theme', 'is_active', 'start_date', 'end_date')
    list_filter = ('is_active',)
    search_fields = ('name', 'theme', 'organizer')


@admin.register(EventCategory)
class EventCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'name_malayalam', 'edition', 'date', 'venue')
    list_filter = ('edition', 'date')
    search_fields = ('name', 'name_malayalam', 'venue')


@admin.register(EventDivision)
class EventDivisionAdmin(admin.ModelAdmin):
    list_display = ('division_number', 'name', 'name_malayalam', 'edition')
    list_filter = ('edition',)
    search_fields = ('name', 'name_malayalam')
    ordering = ('division_number',)


@admin.register(EventSection)
class EventSectionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'name_malayalam', 'edition')
    list_filter = ('edition',)
    search_fields = ('code', 'name', 'name_malayalam')


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        'code',
        'name',
        'name_malayalam',
        'category',
        'division',
        'section',
        'event_type',
        'duration_display',
        'contributes_to_individual',
        'contributes_to_church'
    )
    list_filter = (
        'edition',
        'category',
        'division',
        'section',
        'event_type',
        'contributes_to_individual',
        'contributes_to_church'
    )
    search_fields = ('code', 'name', 'name_malayalam')
    ordering = ('code',)
