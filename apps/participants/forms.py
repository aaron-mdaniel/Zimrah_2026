from django import forms
from .models import Participant
from apps.events.models import Edition
from apps.churches.models import Church


class ParticipantForm(forms.ModelForm):
    class Meta:
        model = Participant
        fields = [
            'edition',
            'chest_number',
            'name',
            'name_malayalam',
            'gender',
            'church',
            'age_category',
            'phone',
        ]
        widgets = {
            'edition': forms.Select(attrs={'class': 'form-select'}),
            'chest_number': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., 001, 105', 'autocomplete': 'off'}),
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Full Name'}),
            'name_malayalam': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'പേര് (മലയാളത്തിൽ)'}),
            'gender': forms.Select(attrs={'class': 'form-select'}),
            'church': forms.Select(attrs={'class': 'form-select'}),
            'age_category': forms.Select(attrs={'class': 'form-select'}),
            'phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Phone Number'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Limit church options to active churches
        self.fields['church'].queryset = Church.objects.filter(is_active=True).order_by('code')
        # Default edition to active edition if creating new
        if not self.instance.pk:
            active_edition = Edition.objects.filter(is_active=True).first()
            if active_edition:
                self.fields['edition'].initial = active_edition

    def clean_chest_number(self):
        # Explicitly preserve leading zeros without stripping or converting to int
        raw = self.cleaned_data['chest_number'].strip()
        edition = self.cleaned_data.get('edition')
        if not raw:
            raise forms.ValidationError("Chest number cannot be empty.")

        # Check unique constraint within edition
        if edition:
            qs = Participant.objects.filter(edition=edition, chest_number=raw)
            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                existing = qs.first()
                raise forms.ValidationError(
                    f"Chest Number '{raw}' is already assigned to {existing.name} ({existing.church.code}) in {edition.name}."
                )
        return raw


class ParticipantCSVImportForm(forms.Form):
    csv_file = forms.FileField(
        label="Select CSV File",
        widget=forms.FileInput(attrs={'class': 'form-control', 'accept': '.csv'}),
        help_text="Upload a .csv file formatted with headers: chest_number, name, gender (M/F), church_code, age_category (JUNIOR/SENIOR/OPEN), phone"
    )
    edition = forms.ModelChoiceField(
        queryset=Edition.objects.all().order_by('-year'),
        widget=forms.Select(attrs={'class': 'form-select'}),
        help_text="Target Festival Edition for imported participants."
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        active_ed = Edition.objects.filter(is_active=True).first()
        if active_ed:
            self.fields['edition'].initial = active_ed
