import os
import time
from collections import defaultdict
from django.http import HttpResponse


class SecurityHeadersMiddleware:
    """
    Appends security headers to all HTTP responses:
    - Content-Security-Policy (CSP)
    - Referrer-Policy
    - Permissions-Policy
    - X-Content-Type-Options
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Content Security Policy
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
        ]
        response.headers.setdefault("Content-Security-Policy", "; ".join(csp_directives))
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")

        return response


class RateLimitMiddleware:
    """
    Lightweight, sliding-window IP rate limiter to protect public endpoints against brute-force / DDoS.
    Allows up to 600 requests per minute per IP address.
    """
    WINDOW_SECONDS = 60
    MAX_REQUESTS_PER_WINDOW = 600

    def __init__(self, get_response):
        self.get_response = get_response
        self.request_records = defaultdict(list)

    def __call__(self, request):
        if os.getenv('DISABLE_RATE_LIMIT', 'False').lower() in ('true', '1'):
            return self.get_response(request)

        # Only rate limit public and API endpoints, bypass admin if authenticated
        path = request.path
        if not path.startswith(('/api/', '/', '/results/', '/championship/')):
            return self.get_response(request)

        ip = self.get_client_ip(request)
        now = time.time()
        window_start = now - self.WINDOW_SECONDS

        # Prune old records for this IP
        records = [ts for ts in self.request_records[ip] if ts > window_start]
        records.append(now)
        self.request_records[ip] = records

        if len(records) > self.MAX_REQUESTS_PER_WINDOW:
            return HttpResponse(
                "Too Many Requests. Please wait a minute before retrying.",
                status=429,
                content_type="text/plain"
            )

        return self.get_response(request)

    @staticmethod
    def get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '127.0.0.1')
