from rest_framework import generics, permissions
from .models import EventResult
from .serializers import EventResultSerializer


class PublishedResultListView(generics.ListAPIView):
    """
    Public REST API endpoint returning all published competition results.
    Consumable by future Android app and external feeds.
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
        if cat:
            qs = qs.filter(event__category__id=cat)
        if div:
            qs = qs.filter(event__division__division_number=div)
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
