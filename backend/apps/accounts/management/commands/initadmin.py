import os
from django.core.management.base import BaseCommand
from apps.accounts.models import User

class Command(BaseCommand):
    help = 'Initializes the default admin account from environment variables if none exists'

    def handle(self, *args, **options):
        admin_email = os.environ.get('ADMIN_EMAIL', 'admin@weddingstudio.com').strip().lower()
        admin_name = os.environ.get('ADMIN_NAME', 'Studio Admin').strip()
        admin_password = os.environ.get('ADMIN_PASSWORD', 'AdminSecurePassword123!')

        if not User.objects.filter(email=admin_email).exists():
            self.stdout.write(f"Creating default admin account: {admin_email}")
            User.objects.create_superuser(
                email=admin_email,
                name=admin_name,
                password=admin_password
            )
            self.stdout.write(self.style.SUCCESS(f"Successfully created admin account: {admin_email}"))
        else:
            self.stdout.write(f"Admin account already exists: {admin_email}")

