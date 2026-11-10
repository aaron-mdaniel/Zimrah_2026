from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Custom Admin Portal Branding
admin.site.site_header = "ZIMRAH 2026 Administration"
admin.site.site_title = "ZIMRAH 2026 Portal"
admin.site.index_title = "Result Management & Championship Control"

from apps.results.api_views import PublishedResultListView, PublishedResultDetailView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('portal/', include('zimrah.portal_urls')),

    # REST APIs for future Android App
    path('api/v1/results/', PublishedResultListView.as_view(), name='api_results_list'),
    path('api/v1/results/<str:code>/', PublishedResultDetailView.as_view(), name='api_results_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
