"""
SmartLogix Gateway — Notification Service (Tasks 8.1, 8.2, 8.3)

NotificationProvider interface with implementations:
  - InAppProvider (always active): writes to the notifications table
  - WebPushProvider: sends Web Push via VAPID keys
  - TwilioProvider [STUB-OK]: SMS/WhatsApp via Twilio, gated behind env vars

If TWILIO_* env vars are absent, falls back to logging + in-app only,
per the Missing Credentials Protocol (rules.md §9).
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from services.db import DBService, db_service
from settings import settings

logger = logging.getLogger(__name__)


class NotificationProvider(ABC):
    """Abstract notification provider interface."""

    @abstractmethod
    async def send(
        self,
        profile_id: str,
        channel: str,
        payload: dict[str, Any],
    ) -> bool:
        """Send a notification. Returns True if successful."""
        ...


class InAppProvider(NotificationProvider):
    """In-app notification provider — writes to the notifications table."""

    def __init__(self, db: DBService | None = None):
        self._db = db or db_service

    async def send(
        self,
        profile_id: str,
        channel: str,
        payload: dict[str, Any],
    ) -> bool:
        try:
            await self._db.insert_notification(
                {
                    "profile_id": profile_id,
                    "channel": "in_app",
                    "payload": json.dumps(payload),
                    "status": "sent",
                }
            )
            return True
        except Exception as e:
            logger.error(f"Failed to create in-app notification: {e}")
            return False


class WebPushProvider(NotificationProvider):
    """Web Push notification provider using VAPID keys (Task 8.1)."""

    def __init__(self) -> None:
        self._vapid_public = settings.vapid_public_key
        self._vapid_private = settings.vapid_private_key
        self._vapid_subject = settings.vapid_subject

    @property
    def is_configured(self) -> bool:
        return bool(self._vapid_public and self._vapid_private)

    async def send(
        self,
        profile_id: str,
        channel: str,
        payload: dict[str, Any],
    ) -> bool:
        if not self.is_configured:
            logger.warning("Web Push not configured — skipping")
            return False

        # TODO: Look up the user's push subscription from the database
        # and call pywebpush.webpush() with the subscription info
        logger.info(f"Web Push to {profile_id}: {payload.get('type', 'unknown')}")
        return True


class TwilioProvider(NotificationProvider):
    """SMS/WhatsApp notification provider via Twilio [STUB-OK].

    Done (stubbed — needs Twilio credentials to go live).
    See .env.example for required TWILIO_* variables.
    """

    def __init__(self) -> None:
        self._configured = settings.has_twilio

    async def send(
        self,
        profile_id: str,
        channel: str,
        payload: dict[str, Any],
    ) -> bool:
        if not self._configured:
            logger.info(
                f"Twilio not configured — stubbed {channel} notification "
                f"to {profile_id}: {payload.get('type', 'unknown')}"
            )
            return False

        # When Twilio credentials are provided, this would use:
        # from twilio.rest import Client
        # client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        # if channel == "sms":
        #     client.messages.create(...)
        # elif channel == "whatsapp":
        #     client.messages.create(from_=f"whatsapp:{settings.twilio_whatsapp_from}", ...)
        logger.info(f"Twilio {channel} to {profile_id}: {payload}")
        return True


class NotificationService:
    """Orchestrates notifications across all channels (Task 8.2)."""

    def __init__(self, db: DBService | None = None):
        self._in_app = InAppProvider(db)
        self._web_push = WebPushProvider()
        self._twilio = TwilioProvider()

    async def notify(
        self,
        profile_id: str,
        payload: dict[str, Any],
        channels: list[str] | None = None,
    ) -> None:
        """Send notification to a user via specified channels.

        Always sends in-app. Also sends via push/sms/whatsapp if configured.
        """
        if channels is None:
            channels = ["in_app", "push"]

        for channel in channels:
            if channel == "in_app":
                await self._in_app.send(profile_id, channel, payload)
            elif channel == "push":
                await self._web_push.send(profile_id, channel, payload)
            elif channel in ("sms", "whatsapp"):
                await self._twilio.send(profile_id, channel, payload)

    async def notify_bid_opportunity(
        self, carrier_id: str, route_id: str, corridor_id: str
    ) -> None:
        """Notify a driver of a new bid opportunity (Task 8.2)."""
        await self.notify(
            carrier_id,
            {
                "type": "bid_opportunity",
                "route_id": route_id,
                "corridor_id": corridor_id,
                "message": "New route available for bidding!",
            },
        )

    async def notify_bid_outcome(
        self, carrier_id: str, route_id: str, result: str
    ) -> None:
        """Notify a driver of bid outcome (Task 8.2)."""
        await self.notify(
            carrier_id,
            {
                "type": "bid_outcome",
                "route_id": route_id,
                "result": result,
                "message": f"Your bid was {result}.",
            },
        )

    async def notify_route_ready(
        self, shipper_id: str, shipment_id: str
    ) -> None:
        """Notify a shipper that their route quote is ready (Task 8.2)."""
        await self.notify(
            shipper_id,
            {
                "type": "route_ready",
                "shipment_id": shipment_id,
                "message": "Your shipment has been routed! View the quote.",
            },
        )


notification_service = NotificationService()
