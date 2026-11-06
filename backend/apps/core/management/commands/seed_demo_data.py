import os
import io
from pathlib import Path
from datetime import date, timedelta
from PIL import Image, ImageDraw
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from apps.accounts.models import User
from apps.categories.models import Category
from apps.clients.models import Client
from apps.photos.models import Photo
from apps.photos.tasks import process_photo_task, generate_showcase_variant
from apps.site_settings.models import SiteSetting
from apps.delivery.models import ZipBundle, DownloadLink
from apps.core.utils import generate_passkey, hash_passkey, generate_download_token, hash_download_token

class Command(BaseCommand):
    help = "Seeds realistic demo data: categories, clients, showcase photos, settings, and download links."

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data for wedding photo delivery platform...")

        # 1. Admin Account
        admin, created = User.objects.get_or_create(
            email='admin@weddingstudio.com',
            defaults={
                'name': 'Studio Admin',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin.set_password('AdminSecurePassword123!')
            admin.save()
            self.stdout.write("  + Created default admin user (admin@weddingstudio.com / AdminSecurePassword123!)")

        # 2. Site Settings
        SiteSetting.set_setting('branding', {
            'studio_name': 'Lumina Wedding Photography',
            'email': 'hello@luminaweddings.com',
            'phone': '+1 (555) 234-5678',
            'whatsapp': '+15552345678',
            'social_links': {
                'instagram': 'https://instagram.com/luminaweddings',
                'facebook': 'https://facebook.com/luminaweddings'
            }
        })
        SiteSetting.set_setting('watermark', {
            'enabled': True,
            'type': 'text',
            'text': '© Lumina Wedding Photography',
            'position': 'bottom-right',
            'opacity': 45,
            'scale': 20,
            'apply_to_client_preview': False
        })
        SiteSetting.set_setting('delivery', {
            'link_valid_days': 7,
            'max_downloads': 10,
            'zip_part_mb': 1500,
            'revoke_on_send': True
        })
        self.stdout.write("  + Seeded branding, watermark, and delivery site settings")

        # 3. Categories
        cat_weddings, _ = Category.objects.get_or_create(
            slug='weddings',
            defaults={'name': 'Weddings', 'sort_order': 1}
        )
        cat_engagements, _ = Category.objects.get_or_create(
            slug='engagements',
            defaults={'name': 'Engagements', 'sort_order': 2}
        )
        cat_elopements, _ = Category.objects.get_or_create(
            slug='elopements',
            defaults={'name': 'Elopements', 'sort_order': 3}
        )
        self.stdout.write("  + Seeded categories: Weddings, Engagements, Elopements")

        # Clean up temporary test clients
        Client.objects.filter(groom_name__startswith='Lucas').delete()

        # 4. Clients
        # Client 1: Ethan & Sophia
        client1, c1_created = Client.objects.get_or_create(
            groom_name='Ethan',
            bride_name='Sophia',
            category=cat_weddings,
            defaults={
                'name_key': 'ethan sophia',
                'passkey_hash': hash_passkey('LOVE-2026'),
                'event_date': date(2026, 9, 15),
                'package_price': 4500.00,
                'status': 'published',
                'linked_email': 'ethan.sophia@example.com',
                'email_locked': True,
                'created_by': admin
            }
        )
        client1.deleted_at = None
        client1.status = 'published'
        client1.set_passkey('LOVE-2026')
        client1.save()

        # Client 2: Liam & Olivia
        client2, c2_created = Client.objects.get_or_create(
            groom_name='Liam',
            bride_name='Olivia',
            category=cat_engagements,
            defaults={
                'name_key': 'liam olivia',
                'passkey_hash': hash_passkey('WED-8822'),
                'event_date': date(2026, 10, 4),
                'package_price': 3000.00,
                'status': 'published',
                'linked_email': 'liam.olivia@example.com',
                'email_locked': True,
                'created_by': admin
            }
        )
        client2.deleted_at = None
        client2.status = 'published'
        client2.set_passkey('WED-8822')
        client2.save()
        self.stdout.write("  + Seeded clients: Ethan & Sophia (Passkey: LOVE-2026), Liam & Olivia (Passkey: WED-8822)")

        # 5. Generate Sample Photos for Ethan & Sophia
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)

        colors_c1 = [
            ("#b57c48", "#f4ecd8", "Ceremony Kiss"),
            ("#7d8c7c", "#e9ecef", "Sunset Portrait"),
            ("#9c6b70", "#faedcd", "First Dance"),
            ("#6c757d", "#f8f9fa", "Ring Details"),
        ]

        for i, (bg, fg, title) in enumerate(colors_c1, start=1):
            filename = f"ethan_sophia_{i}.jpg"
            client_orig_dir = media_root / 'originals' / str(client1.id)
            client_orig_dir.mkdir(parents=True, exist_ok=True)
            file_path = client_orig_dir / filename

            # Generate aesthetic image with Pillow
            img = Image.new('RGB', (1800, 1200), color=bg)
            draw = ImageDraw.Draw(img)
            draw.rectangle([50, 50, 1750, 1150], outline=fg, width=6)
            draw.text((100, 100), f"Ethan & Sophia - {title}", fill=fg)
            img.save(file_path, format='JPEG', quality=90)

            photo, p_created = Photo.objects.get_or_create(
                client=client1,
                original_filename=filename,
                defaults={
                    'storage_key': f"originals/{client1.id}/{filename}",
                    'size_bytes': file_path.stat().st_size,
                    'width': 1800,
                    'height': 1200,
                    'status': 'uploaded',
                    'sort_order': i,
                    'showcase_order': i if i <= 3 else None
                }
            )
            # Process variants synchronously
            process_photo_task(str(photo.id))
            if photo.showcase_order:
                generate_showcase_variant(photo)

        # 6. Generate Sample Photos for Liam & Olivia
        colors_c2 = [
            ("#4a6fa5", "#f0f3f8", "Golden Hour"),
            ("#e07a5f", "#fefae0", "Meadow Stroll"),
        ]
        for i, (bg, fg, title) in enumerate(colors_c2, start=1):
            filename = f"liam_olivia_{i}.jpg"
            client_orig_dir = media_root / 'originals' / str(client2.id)
            client_orig_dir.mkdir(parents=True, exist_ok=True)
            file_path = client_orig_dir / filename

            img = Image.new('RGB', (1800, 1200), color=bg)
            draw = ImageDraw.Draw(img)
            draw.rectangle([50, 50, 1750, 1150], outline=fg, width=6)
            draw.text((100, 100), f"Liam & Olivia - {title}", fill=fg)
            img.save(file_path, format='JPEG', quality=90)

            photo, p_created = Photo.objects.get_or_create(
                client=client2,
                original_filename=filename,
                defaults={
                    'storage_key': f"originals/{client2.id}/{filename}",
                    'size_bytes': file_path.stat().st_size,
                    'width': 1800,
                    'height': 1200,
                    'status': 'uploaded',
                    'sort_order': i,
                    'showcase_order': i
                }
            )
            process_photo_task(str(photo.id))
            generate_showcase_variant(photo)

        # 7. Create Demo Active Download Link for Liam & Olivia (unaffected by Ethan & Sophia requests)
        zips_dir_liam = media_root / 'zips' / str(client2.id)
        zips_dir_liam.mkdir(parents=True, exist_ok=True)
        part_file_liam = zips_dir_liam / "Liam_Olivia_Part01.zip"
        if not part_file_liam.exists():
            with open(part_file_liam, 'wb') as f:
                f.write(b"PK\x05\x06" + b"\x00" * 18)

        bundle_liam, _ = ZipBundle.objects.get_or_create(
            client=client2,
            defaults={
                'status': 'ready',
                'parts': [{
                    'part': 1,
                    'filename': 'Liam_Olivia_Part01.zip',
                    'storage_key': f"zips/{client2.id}/Liam_Olivia_Part01.zip",
                    'size_bytes': part_file_liam.stat().st_size
                }],
                'total_bytes': part_file_liam.stat().st_size,
                'photo_count': 2
            }
        )

        demo_token_liam = "demo-download-token-liam"
        token_hash_liam = hash_download_token(demo_token_liam)
        DownloadLink.objects.update_or_create(
            token_hash=token_hash_liam,
            defaults={
                'client': client2,
                'bundle': bundle_liam,
                'email': 'liam.olivia@example.com',
                'expires_at': timezone.now() + timedelta(days=7),
                'max_downloads': 10,
                'download_count': 0
            }
        )
        self.stdout.write(f"  + Seeded active demo download portal at: /d/{demo_token_liam}")

        # 8. Demo Equipment
        from apps.equipment.models import Equipment
        Equipment.objects.get_or_create(
            name='Sony Alpha A7 IV Body #1',
            defaults={
                'category': 'camera',
                'brand': 'Sony',
                'model_number': 'ILCE-7M4',
                'serial_number': 'SN-A74-10291',
                'purchase_date': date(2025, 4, 10),
                'purchase_price': 2499.00,
                'status': 'available',
                'assigned_to': 'Lead Photographer',
                'notes': 'Dual slot primary wedding camera',
                'created_by': admin
            }
        )
        Equipment.objects.get_or_create(
            name='Sony FE 70-200mm f/2.8 GM OSS II',
            defaults={
                'category': 'lens',
                'brand': 'Sony',
                'model_number': 'SEL70200GM2',
                'serial_number': 'SN-GM-88214',
                'purchase_date': date(2025, 6, 20),
                'purchase_price': 2798.00,
                'status': 'available',
                'assigned_to': 'Lead Photographer',
                'notes': 'Telephoto portrait lens',
                'created_by': admin
            }
        )
        Equipment.objects.get_or_create(
            name='Godox AD600 Pro Strobe',
            defaults={
                'category': 'lighting',
                'brand': 'Godox',
                'model_number': 'AD600Pro',
                'serial_number': 'SN-GDX-44120',
                'purchase_date': date(2025, 8, 15),
                'purchase_price': 899.00,
                'status': 'available',
                'assigned_to': 'Studio Light Kit',
                'notes': 'Reception lighting strobe',
                'created_by': admin
            }
        )
        Equipment.objects.get_or_create(
            name='DJI Mini 4 Pro Drone',
            defaults={
                'category': 'drone',
                'brand': 'DJI',
                'model_number': 'Mini 4 Pro Fly More',
                'serial_number': 'SN-DJI-55912',
                'purchase_date': date(2025, 9, 5),
                'purchase_price': 1099.00,
                'status': 'available',
                'assigned_to': 'Drone Pilot',
                'notes': 'Aerial footage setup',
                'created_by': admin
            }
        )
        self.stdout.write("  + Seeded equipment inventory: Sony A7 IV, 70-200mm GM, Godox AD600, DJI Drone")

        # 9. Demo Payments
        from apps.payments.models import Payment
        Payment.objects.get_or_create(
            client=client1,
            reference_no='ADV-ETHAN-01',
            defaults={
                'amount': 2000.00,
                'method': 'cash',
                'payment_type': 'advance',
                'payment_date': date(2026, 8, 1),
                'notes': 'Initial cash deposit upon contract signing',
                'recorded_by': admin
            }
        )
        Payment.objects.get_or_create(
            client=client2,
            reference_no='TXN-LIAM-WIRE',
            defaults={
                'amount': 1500.00,
                'method': 'online',
                'payment_type': 'advance',
                'payment_date': date(2026, 9, 10),
                'notes': 'Online bank transfer milestone deposit',
                'recorded_by': admin
            }
        )
        self.stdout.write("  + Seeded client payments: Cash advance for Ethan & Sophia, Online transfer for Liam & Olivia")

        self.stdout.write(self.style.SUCCESS("Demo seeding completed successfully!"))
