from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Custom Admin Portal Branding
admin.site.site_header = "ZIMRAH 2026 Administration"
admin.site.site_title = "ZIMRAH 2026 Portal"
admin.site.index_title = "Result Management & Championship Control"

urlpatterns = [
    path('admin/', admin.site.urls),
    path('portal/', include('zimrah.portal_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
