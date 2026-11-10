from .models import AuditLog


def get_client_ip(request):
    """Extract client IP address from HTTP request headers."""
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_activity(request, action, obj, changes=None, details=None):
    """
    Records an administrative action in the AuditLog.
    """
    user = request.user if request and request.user.is_authenticated else None
    ip = get_client_ip(request)

    model_name = obj.__class__.__name__ if obj else "System"
    object_id = str(obj.pk) if obj and hasattr(obj, 'pk') else ""
    object_repr = str(obj)[:200] if obj else ""

    payload = changes or {}
    if details:
        payload['details'] = details

    return AuditLog.objects.create(
        user=user,
        action=action,
        model_name=model_name,
        object_id=object_id,
        object_repr=object_repr,
        changes=payload,
        ip_address=ip
    )
