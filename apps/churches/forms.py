from django import forms
from .models import Church


class ChurchForm(forms.ModelForm):
    class Meta:
        model = Church
        fields = [
            'code',
            'name',
            'name_malayalam',
            'district',
            'vicar_name',
            'youth_leader_name',
            'contact_phone',
            'contact_email',
            'is_active',
        ]
        widgets = {
            'code': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., CH01', 'autocomplete': 'off'}),
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., St. Mathias CSI Church, Munroethuruth'}),
            'name_malayalam': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്'}),
            'district': forms.TextInput(attrs={'class': 'form-control'}),
            'vicar_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Rev. Vicar Name'}),
            'youth_leader_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Youth Leader / Secretary'}),
            'contact_phone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Phone Number'}),
            'contact_email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email@example.com'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }

    def clean_code(self):
        code = self.cleaned_data['code'].strip().upper()
        # Verify code uniqueness
        qs = Church.objects.filter(code__iexact=code)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(f"Church code '{code}' is already assigned to {qs.first().name}.")
        return code
