from django.urls import path
from apps.accounts import views as account_views
from apps.churches import views as church_views
from apps.participants import views as participant_views
from apps.events import views as event_views
from apps.registrations import views as registration_views

urlpatterns = [
    # Auth & Dashboard
    path('', account_views.portal_dashboard, name='portal_home'),
    path('login/', account_views.portal_login, name='portal_login'),
    path('logout/', account_views.portal_logout, name='portal_logout'),
    path('dashboard/', account_views.portal_dashboard, name='portal_dashboard'),

    # Churches
    path('churches/', church_views.church_list, name='portal_church_list'),
    path('churches/add/', church_views.church_add, name='portal_church_add'),
    path('churches/<int:pk>/', church_detail := church_views.church_detail, name='portal_church_detail'),
    path('churches/<int:pk>/edit/', church_views.church_edit, name='portal_church_edit'),
    path('churches/<int:pk>/toggle-status/', church_views.church_toggle_status, name='portal_church_toggle_status'),

    # Participants
    path('participants/', participant_views.participant_list, name='portal_participant_list'),
    path('participants/add/', participant_views.participant_add, name='portal_participant_add'),
    path('participants/<int:pk>/', participant_views.participant_detail, name='portal_participant_detail'),
    path('participants/<int:pk>/edit/', participant_views.participant_edit, name='portal_participant_edit'),
    path('participants/import/', participant_views.participant_import_csv, name='portal_participant_import'),
    path('participants/sample-csv/', participant_views.participant_sample_csv, name='portal_participant_sample_csv'),

    # Events
    path('events/', event_views.event_list, name='portal_event_list'),
    path('events/add/', event_views.event_add, name='portal_event_add'),
    path('events/<int:pk>/', event_views.event_detail, name='portal_event_detail'),
    path('events/<int:pk>/edit/', event_views.event_edit, name='portal_event_edit'),

    # Registrations
    path('registrations/', registration_views.registration_list, name='portal_registration_list'),
    path('registrations/add/', registration_views.registration_add, name='portal_registration_add'),
    path('registrations/group-add/', registration_views.registration_group_add, name='portal_registration_group_add'),
    path('registrations/event/<int:event_id>/', registration_views.registration_event_detail, name='portal_registration_event_detail'),
    path('registrations/event/<int:event_id>/print/', registration_views.registration_event_print, name='portal_registration_event_print'),
    path('registrations/<int:pk>/delete/', registration_views.registration_delete, name='portal_registration_delete'),

    # AJAX Endpoints
    path('api/church/<int:church_id>/participants/', registration_views.get_church_participants_api, name='portal_api_church_participants'),
]
