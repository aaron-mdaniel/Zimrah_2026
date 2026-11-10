from rest_framework import serializers
from .models import EventResult, ResultEntry, ResultParticipant


class ResultParticipantSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.name', read_only=True)
    chest_number = serializers.CharField(source='participant.chest_number', read_only=True)

    class Meta:
        model = ResultParticipant
        fields = ['id', 'participant', 'participant_name', 'chest_number', 'role', 'points_allocated']


class ResultEntrySerializer(serializers.ModelSerializer):
    church_name = serializers.CharField(source='church.name', read_only=True)
    church_code = serializers.CharField(source='church.code', read_only=True)
    participants = ResultParticipantSerializer(many=True, read_only=True)
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)

    class Meta:
        model = ResultEntry
        fields = [
            'id',
            'position',
            'position_display',
            'chest_number',
            'participant_name',
            'church',
            'church_code',
            'church_name',
            'participant',
            'grade',
            'grade_display',
            'grade_points',
            'position_points',
            'total_points',
            'remarks',
            'participants',
        ]
        read_only_fields = ['total_points']


class EventResultSerializer(serializers.ModelSerializer):
    event_code = serializers.CharField(source='event.code', read_only=True)
    event_name = serializers.CharField(source='event.name', read_only=True)
    event_name_malayalam = serializers.CharField(source='event.name_malayalam', read_only=True)
    category_name = serializers.CharField(source='event.category.name', read_only=True)
    division_name = serializers.CharField(source='event.division.name_malayalam', read_only=True)
    published_by_name = serializers.CharField(source='published_by.get_full_name', read_only=True)
    entries = ResultEntrySerializer(many=True, read_only=True)

    class Meta:
        model = EventResult
        fields = [
            'id',
            'event',
            'event_code',
            'event_name',
            'event_name_malayalam',
            'category_name',
            'division_name',
            'status',
            'published_at',
            'published_by_name',
            'notes',
            'entries',
        ]
