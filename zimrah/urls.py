from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Custom Admin Portal Branding
admin.site.site_header = "ZIMRAH 2026 Administration"
admin.site.site_title = "ZIMRAH 2026 Portal"
admin.site.index_title = "Result Management & Championship Control"

from apps.results.api_views import PublishedResultListView, PublishedResultDetailView
from apps.championships.api_views import (
    ChurchChampionshipAPIView,
    IndividualChampionshipAPIView,
    LiveSummaryAPIView
)
from zimrah.public_views import (
    public_home_view,
    public_results_list_view,
    public_result_detail_view,
    public_church_championship_view,
    public_individual_championship_view,
    public_search_view,
    pwa_manifest_view,
    pwa_service_worker_view,
)

urlpatterns = [
    # Administration Portal & Django Admin
    path('admin/', admin.site.urls),
    path('portal/', include('zimrah.portal_urls')),

    # REST APIs (for mobile Android app & frontend dynamic updates)
    path('api/v1/results/', PublishedResultListView.as_view(), name='api_results_list'),
    path('api/v1/results/<str:code>/', PublishedResultDetailView.as_view(), name='api_results_detail'),
    path('api/v1/championships/church/', ChurchChampionshipAPIView.as_view(), name='api_championship_church'),
    path('api/v1/championships/individual/', IndividualChampionshipAPIView.as_view(), name='api_championship_individual'),
    path('api/v1/live/summary/', LiveSummaryAPIView.as_view(), name='api_live_summary'),

    # PWA Endpoints
    path('manifest.json', pwa_manifest_view, name='pwa_manifest'),
    path('sw.js', pwa_service_worker_view, name='pwa_service_worker'),

    # Public Facing Website
    path('', public_home_view, name='public_home'),
    path('results/', public_results_list_view, name='public_results_list'),
    path('results/<str:code>/', public_result_detail_view, name='public_result_detail'),
    path('championship/church/', public_church_championship_view, name='public_church_championship'),
    path('championship/individual/', public_individual_championship_view, name='public_individual_championship'),
    path('search/', public_search_view, name='public_search'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
