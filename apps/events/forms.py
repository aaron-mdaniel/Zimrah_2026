from django import forms
from .models import Event, EventCategory, EventDivision, EventSection, Edition


class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = [
            'edition',
            'code',
            'name',
            'name_malayalam',
            'category',
            'division',
            'section',
            'event_type',
            'duration_minutes',
            'duration_display',
            'min_participants',
            'max_participants',
            'max_entries_per_church',
            'contributes_to_individual',
            'contributes_to_church',
        ]
        widgets = {
            'edition': forms.Select(attrs={'class': 'form-select'}),
            'code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., EV01'}),
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Event Name in English'}),
            'name_malayalam': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'മത്സരപ്പേര് (മലയാളത്തിൽ)'}),
            'category': forms.Select(attrs={'class': 'form-select'}),
            'division': forms.Select(attrs={'class': 'form-select'}),
            'section': forms.Select(attrs={'class': 'form-select'}),
            'event_type': forms.Select(attrs={'class': 'form-select'}),
            'duration_minutes': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'e.g., 5'}),
            'duration_display': forms.TextInput(attrs={'class': 'form-control', 'placeholder': "e.g., '5 മിനിറ്റ്'"}),
            'min_participants': forms.NumberInput(attrs={'class': 'form-control'}),
            'max_participants': forms.NumberInput(attrs={'class': 'form-control'}),
            'max_entries_per_church': forms.NumberInput(attrs={'class': 'form-control'}),
            'contributes_to_individual': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'contributes_to_church': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            active_ed = Edition.objects.filter(is_active=True).first()
            if active_ed:
                self.fields['edition'].initial = active_ed

    def clean_code(self):
        code = self.cleaned_data['code'].strip().upper()
        edition = self.cleaned_data.get('edition')
        if edition:
            qs = Event.objects.filter(edition=edition, code=code)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise forms.ValidationError(f"Event code '{code}' already exists in {edition.name}.")
        return code
