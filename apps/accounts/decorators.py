from functools import wraps
from django.contrib import messages
from django.shortcuts import redirect
from django.core.exceptions import PermissionDenied


def admin_required(view_func):
    """
    Ensures user is authenticated and is staff or has an administrative role.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('portal_login')
        if not (request.user.is_staff or request.user.is_superuser or hasattr(request.user, 'role')):
            messages.error(request, "Access denied. Administrative privileges required.")
            return redirect('portal_login')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def role_required(allowed_roles):
    """
    Enforces server-side authorization based on user roles.
    Example: @role_required(['SUPER_ADMIN'])
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('portal_login')

            # Superusers always pass
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)

            user_role = getattr(request.user, 'role', None)
            if user_role in allowed_roles:
                return view_func(request, *args, **kwargs)

            messages.error(
                request,
                f"Access Denied: Your role ({request.user.get_role_display() if hasattr(request.user, 'get_role_display') else user_role}) does not have permission for this action."
            )
            return redirect('portal_dashboard')
        return _wrapped_view
    return decorator
