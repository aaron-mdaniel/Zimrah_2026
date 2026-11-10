from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from .services import ChampionshipService


class ChurchChampionshipAPIView(APIView):
    """
    Public API returning church-wise championship standings with tie-breaking resolution.
    Query params:
        - search: optional text filter for church name or code
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        search = request.query_params.get('search')
        standings = ChampionshipService.get_church_standings(search=search)
        return Response({
            'count': len(standings),
            'results': standings
        })


class IndividualChampionshipAPIView(APIView):
    """
    Public API returning individual championship standings with tie-breaking resolution.
    Query params:
        - category: JUNIOR | SENIOR | all
        - search: optional text filter for name, chest number, or church
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        only_with_points = request.query_params.get('all') not in ('true', '1')
        standings = ChampionshipService.get_individual_standings(
            category=category,
            search=search,
            only_with_points=only_with_points
        )
        return Response({
            'count': len(standings),
            'results': standings
        })


class LiveSummaryAPIView(APIView):
    """
    Lightweight public API endpoint for real-time polling and live score ticker.
    Returns counts of published events, top 3 churches, top 3 individuals, and latest results.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        summary = ChampionshipService.get_live_summary()
        return Response(summary)
