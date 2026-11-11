import os
import secrets
import string
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Creates or updates an initial production Super Admin securely from environment variables."

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            help="Admin username (defaults to ADMIN_USERNAME env var or 'admin')",
        )
        parser.add_argument(
            '--email',
            type=str,
            help="Admin email (defaults to ADMIN_EMAIL env var or 'admin@zimrah2026.org')",
        )
        parser.add_argument(
            '--password',
            type=str,
            help="Admin password (defaults to ADMIN_PASSWORD env var; generates random if unset)",
        )

    def handle(self, *args, **options):
        username = options.get('username') or os.getenv('ADMIN_USERNAME', 'admin').strip()
        email = options.get('email') or os.getenv('ADMIN_EMAIL', 'admin@zimrah2026.org').strip()
        password = options.get('password') or os.getenv('ADMIN_PASSWORD')

        generated = False
        if not password:
            # Generate a secure 24-character random password
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
            password = ''.join(secrets.choice(alphabet) for _ in range(24))
            generated = True

        user, created = User.objects.get_or_dict(
            username=username,
            defaults={
                'email': email,
                'role': User.Role.SUPER_ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        ) if hasattr(User.objects, 'get_or_dict') else User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'role': User.Role.SUPER_ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        )

        user.email = email
        user.role = User.Role.SUPER_ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created Super Admin user '{username}'."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Successfully updated existing user '{username}' to Super Admin."))

        if generated:
            self.stdout.write(self.style.WARNING(f"Generated secure password: {password}"))
            self.stdout.write(self.style.WARNING("PLEASE COPY AND STORE THIS PASSWORD SECURELY!"))
        else:
            self.stdout.write(self.style.SUCCESS("Password set from environment/argument."))
