from django.db.models import Q
from rest_framework import generics, permissions
from .models import EventResult
from .serializers import EventResultSerializer


class PublishedResultListView(generics.ListAPIView):
    """
    Public REST API endpoint returning all published competition results.
    Consumable by future Android app and external feeds.
    Supports filtering by category, division, and full-text search (query).
    """
    serializer_class = EventResultSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = EventResult.objects.filter(
            status=EventResult.Status.PUBLISHED
        ).select_related(
            'event', 'event__edition', 'event__category', 'event__division', 'published_by'
        ).prefetch_related(
            'entries__church', 'entries__participant', 'entries__participants__participant'
        ).order_by('event__code')

        cat = self.request.query_params.get('category')
        div = self.request.query_params.get('division')
        query = self.request.query_params.get('q')

        if cat:
            qs = qs.filter(event__category__id=cat)
        if div:
            qs = qs.filter(event__division__division_number=div)
        if query:
            q_clean = query.strip()
            qs = qs.filter(
                Q(event__code__icontains=q_clean) |
                Q(event__name__icontains=q_clean) |
                Q(event__name_malayalam__icontains=q_clean) |
                Q(entries__chest_number__icontains=q_clean) |
                Q(entries__participant_name__icontains=q_clean) |
                Q(entries__church__name__icontains=q_clean) |
                Q(entries__church__code__icontains=q_clean)
            ).distinct()

        return qs


class PublishedResultDetailView(generics.RetrieveAPIView):
    """
    Public REST API endpoint returning full published scorecard for a single event code.
    Example: /api/v1/results/EV01/
    """
    serializer_class = EventResultSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'event__code'
    lookup_url_kwarg = 'code'

    def get_queryset(self):
        return EventResult.objects.filter(
            status=EventResult.Status.PUBLISHED
        ).select_related(
            'event', 'event__edition', 'event__category', 'event__division', 'published_by'
        ).prefetch_related(
            'entries__church', 'entries__participant', 'entries__participants__participant'
        )
