from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.db.models import Count, Q

from .forms import PortalLoginForm
from .decorators import admin_required
from apps.audit.utils import log_activity
from apps.churches.models import Church
from apps.participants.models import Participant
from apps.events.models import Event, Edition
from apps.registrations.models import Registration
from apps.results.models import EventResult
from apps.audit.models import AuditLog


def portal_login(request):
    if request.user.is_authenticated and (request.user.is_staff or hasattr(request.user, 'role')):
        return redirect('portal_dashboard')

    if request.method == 'POST':
        form = PortalLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)

            if user is not None:
                if user.is_active:
                    login(request, user)
                    log_activity(request, 'USER_LOGIN', user, {'username': user.username, 'role': getattr(user, 'role', 'STAFF')})
                    messages.success(request, f"Welcome back, {user.get_full_name() or user.username}!")
                    next_url = request.GET.get('next')
                    return redirect(next_url or 'portal_dashboard')
                else:
                    messages.error(request, "This account has been deactivated. Please contact the administrator.")
            else:
                messages.error(request, "Invalid username or password. Please try again.")
    else:
        form = PortalLoginForm()

    return render(request, 'portal/login.html', {'form': form})


def portal_logout(request):
    if request.user.is_authenticated:
        log_activity(request, 'USER_LOGOUT', request.user)
    logout(request)
    messages.info(request, "You have been logged out safely.")
    return redirect('portal_login')


@admin_required
def portal_dashboard(request):
    active_edition = Edition.objects.filter(is_active=True).first()

    # Metrics calculation
    total_churches = Church.objects.count()
    active_churches = Church.objects.filter(is_active=True).count()
    total_participants = Participant.objects.count()

    total_events = Event.objects.count()
    literary_events = Event.objects.filter(category__name__icontains='Literary').count()
    stage_events = Event.objects.filter(category__name__icontains='Stage').count()

    individual_events = Event.objects.filter(event_type=Event.EventType.INDIVIDUAL).count()
    group_events = Event.objects.filter(event_type=Event.EventType.GROUP).count()

    published_results = EventResult.objects.filter(status=EventResult.Status.PUBLISHED).count()
    pending_results = total_events - published_results

    total_registrations = Registration.objects.count()

    # Recent registrations & audit logs
    recent_registrations = Registration.objects.select_related(
        'event', 'church', 'participant'
    ).order_by('-registered_at')[:8]

    recent_audits = AuditLog.objects.select_related('user').order_by('-timestamp')[:8]

    context = {
        'active_edition': active_edition,
        'total_churches': total_churches,
        'active_churches': active_churches,
        'total_participants': total_participants,
        'total_events': total_events,
        'literary_events': literary_events,
        'stage_events': stage_events,
        'individual_events': individual_events,
        'group_events': group_events,
        'published_results': published_results,
        'pending_results': pending_results,
        'total_registrations': total_registrations,
        'recent_registrations': recent_registrations,
        'recent_audits': recent_audits,
    }
    return render(request, 'portal/dashboard.html', context)
