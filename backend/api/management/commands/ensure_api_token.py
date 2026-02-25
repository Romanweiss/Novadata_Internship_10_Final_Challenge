from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token

from api.services.settings import env_str


class Command(BaseCommand):
    help = "Creates/updates initial API token for MVP auth."

    def handle(self, *args, **options):
        user_model = get_user_model()
        username = env_str("API_TOKEN_USER", "api")
        token_value = env_str("API_TOKEN", "")

        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": env_str("API_TOKEN_USER_EMAIL", "api@local"),
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        if token_value:
            Token.objects.filter(key=token_value).exclude(user=user).delete()
            Token.objects.filter(user=user).delete()
            token = Token.objects.create(user=user, key=token_value)
            self.stdout.write(self.style.SUCCESS(f"API token set from API_TOKEN for user '{username}'"))
            self.stdout.write(token.key)
            return

        token, _ = Token.objects.get_or_create(user=user)
        self.stdout.write(self.style.SUCCESS(f"API token ready for user '{username}'"))
        self.stdout.write(token.key)
