from django import forms
from .models import Registration, GroupRegistrationMember
from apps.events.models import Event, Edition
from apps.churches.models import Church
from apps.participants.models import Participant


class IndividualRegistrationForm(forms.ModelForm):
    class Meta:
        model = Registration
        fields = ['edition', 'event', 'church', 'participant', 'chest_number']
        widgets = {
            'edition': forms.Select(attrs={'class': 'form-select'}),
            'event': forms.Select(attrs={'class': 'form-select', 'id': 'id_event_select'}),
            'church': forms.Select(attrs={'class': 'form-select', 'id': 'id_church_select'}),
            'participant': forms.Select(attrs={'class': 'form-select', 'id': 'id_participant_select'}),
            'chest_number': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Event Chest Number'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        active_ed = Edition.objects.filter(is_active=True).first()
        if active_ed:
            self.fields['edition'].initial = active_ed
            self.fields['event'].queryset = Event.objects.filter(
                edition=active_ed,
                event_type=Event.EventType.INDIVIDUAL
            ).order_by('code')
        self.fields['church'].queryset = Church.objects.filter(is_active=True).order_by('code')
        self.fields['participant'].queryset = Participant.objects.all().order_by('chest_number')

    def clean(self):
        cleaned_data = super().clean()
        event = cleaned_data.get('event')
        church = cleaned_data.get('church')
        participant = cleaned_data.get('participant')
        chest_number = cleaned_data.get('chest_number')

        if not participant:
            raise forms.ValidationError("Please select a participant for individual registration.")

        # 1. Verify church membership
        if participant.church_id != church.id:
            raise forms.ValidationError(
                f"Church Membership Mismatch: Participant '{participant.name}' is registered under {participant.church.name}, not {church.name}."
            )

        # 2. Prevent duplicate registrations for same event
        qs = Registration.objects.filter(event=event, participant=participant)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(
                f"Participant '{participant.name}' is already registered for event {event.code} ({event.name})."
            )

        # 3. Autofill chest number if left blank
        if not chest_number:
            cleaned_data['chest_number'] = participant.chest_number

        return cleaned_data


class GroupRegistrationForm(forms.Form):
    edition = forms.ModelChoiceField(
        queryset=Edition.objects.all().order_by('-year'),
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    event = forms.ModelChoiceField(
        queryset=Event.objects.filter(event_type=Event.EventType.GROUP).order_by('code'),
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    church = forms.ModelChoiceField(
        queryset=Church.objects.filter(is_active=True).order_by('code'),
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    group_name = forms.CharField(
        max_length=150,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. St. Mathias Choir / Team A'})
    )
    chest_number = forms.CharField(
        max_length=20,
        required=True,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. G01, 201'})
    )
    member_ids = forms.ModelMultipleChoiceField(
        queryset=Participant.objects.all(),
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'form-check-input'}),
        required=True,
        help_text="Select members representing this church team."
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        active_ed = Edition.objects.filter(is_active=True).first()
        if active_ed:
            self.fields['edition'].initial = active_ed
            self.fields['event'].queryset = Event.objects.filter(
                edition=active_ed,
                event_type=Event.EventType.GROUP
            ).order_by('code')

    def clean(self):
        cleaned_data = super().clean()
        event = cleaned_data.get('event')
        church = cleaned_data.get('church')
        members = cleaned_data.get('member_ids')

        if event and members and church:
            # 1. Verify all members belong to the specified church
            invalid_members = [m.name for m in members if m.church_id != church.id]
            if invalid_members:
                raise forms.ValidationError(
                    f"Church Membership Violation: The following participants do not belong to {church.name}: {', '.join(invalid_members)}"
                )

            # 2. Check team size requirements
            count = len(members)
            if count < event.min_participants:
                raise forms.ValidationError(
                    f"Team under minimum size: Event '{event.name}' requires at least {event.min_participants} participants (selected: {count})."
                )
            if count > event.max_participants:
                raise forms.ValidationError(
                    f"Team exceeds maximum size: Event '{event.name}' allows at most {event.max_participants} participants (selected: {count})."
                )

            # 3. Check for member duplicate registration in same group event
            for member in members:
                already_in = GroupRegistrationMember.objects.filter(
                    registration__event=event,
                    participant=member
                ).exists()
                if already_in:
                    raise forms.ValidationError(
                        f"Participant '{member.name}' is already enrolled in another team for {event.code}."
                    )

        return cleaned_data
