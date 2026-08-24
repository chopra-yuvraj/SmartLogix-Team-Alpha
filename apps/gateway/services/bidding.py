"""
SmartLogix Gateway — Bidding & Awarding Service (Tasks 3.10, 3.11, 3.12)

Handles bid publishing, ECDSA signature verification, and award logic.
A bid is NEVER awarded without server-side signature verification (rules.md §7).
"""

import base64
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from services.db import DBService, db_service
from settings import settings

logger = logging.getLogger(__name__)


class BiddingService:
    """Manages the reverse-bidding marketplace."""

    def __init__(self, db: DBService | None = None):
        self._db = db or db_service

    async def publish_route_for_bidding(
        self, route_id: str, corridor_id: str
    ) -> None:
        """Publish a proposed route to eligible carriers (Task 3.10).

        Uses Supabase Realtime broadcast on a per-corridor channel.
        """
        bid_window_closes = datetime.now(timezone.utc) + timedelta(
            seconds=settings.bid_window_seconds
        )

        await self._db.update_route(
            route_id,
            {
                "status": "proposed",
                "bid_window_closes_at": bid_window_closes.isoformat(),
            },
        )

        # Broadcast via Supabase Realtime (carriers subscribe to corridor channels)
        # The frontend listens on `corridor:{corridor_id}` channel
        logger.info(
            f"Route {route_id} published for bidding on corridor {corridor_id}, "
            f"window closes at {bid_window_closes.isoformat()}"
        )

    async def verify_and_submit_bid(
        self,
        route_id: str,
        carrier_id: str,
        bid_amount_paise: int,
        public_key_str: str,
        signature_str: str,
        signed_payload: str,
    ) -> dict[str, Any]:
        """Verify ECDSA signature and submit a bid (Task 3.11).

        Args:
            route_id: The route being bid on.
            carrier_id: The bidding carrier's ID.
            bid_amount_paise: Bid amount in integer paise (never float).
            public_key_str: Base64 SPKI public key.
            signature_str: Base64 signature.
            signed_payload: The exact bytes that were signed.

        Returns:
            The created bid record.

        Raises:
            ValueError: On signature verification failure.
        """
        # Step 1: Verify the carrier's registered key matches
        registered_key = await self._db.get_active_carrier_key(carrier_id)
        if registered_key and registered_key.get("public_key") != public_key_str:
            raise ValueError(
                "Public key does not match the carrier's registered key"
            )

        # Step 2: Verify the ECDSA P-256/SHA-256 signature
        # This is byte-compatible with Web Crypto API's
        # crypto.subtle.sign({name: "ECDSA", hash: "SHA-256"}, ...)
        try:
            self._verify_ecdsa_signature(
                public_key_str, signature_str, signed_payload
            )
        except InvalidSignature:
            raise ValueError("Invalid ECDSA signature — bid rejected")
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            raise ValueError(f"Signature verification failed: {e}")

        # Step 3: Check the route exists and bidding is open
        route = await self._db.get_route(route_id)
        if not route:
            raise ValueError(f"Route {route_id} not found")

        if route.get("status") != "proposed":
            raise ValueError(f"Route {route_id} is not open for bidding")

        bid_closes = route.get("bid_window_closes_at")
        if bid_closes:
            closes_at = datetime.fromisoformat(bid_closes)
            if datetime.now(timezone.utc) > closes_at:
                raise ValueError("Bidding window has closed")

        # Step 4: Persist the bid
        bid_data = {
            "route_id": route_id,
            "carrier_id": carrier_id,
            "bid_amount_paise": bid_amount_paise,
            "public_key": public_key_str,
            "signature": signature_str,
            "signed_payload": signed_payload,
            "status": "submitted",
        }

        bid = await self._db.create_bid(bid_data)
        logger.info(
            f"Bid submitted: carrier={carrier_id}, route={route_id}, "
            f"amount={bid_amount_paise} paise"
        )
        return bid

    def _verify_ecdsa_signature(
        self,
        public_key_b64: str,
        signature_b64: str,
        signed_payload: str,
    ) -> None:
        """Verify ECDSA P-256/SHA-256 signature (rules.md §2 bid signing).

        cryptography's ec.ECDSA(hashes.SHA256()) over P-256 is byte-compatible
        with Web Crypto API's crypto.subtle.sign({name: "ECDSA", hash: "SHA-256"}).
        """
        # Decode the public key from base64 SPKI format
        public_key_bytes = base64.b64decode(public_key_b64)
        public_key = serialization.load_der_public_key(public_key_bytes)

        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            raise ValueError("Public key is not an EC key")

        # Decode the signature
        signature_bytes = base64.b64decode(signature_b64)

        # Web Crypto API produces IEEE P1363 format (r || s, 64 bytes for P-256)
        # cryptography expects DER format, so we need to convert
        if len(signature_bytes) == 64:
            # P1363 → DER conversion
            r = int.from_bytes(signature_bytes[:32], byteorder="big")
            s = int.from_bytes(signature_bytes[32:], byteorder="big")
            from cryptography.hazmat.primitives.asymmetric.utils import (
                encode_dss_signature,
            )

            signature_der = encode_dss_signature(r, s)
        else:
            # Assume already DER
            signature_der = signature_bytes

        # Verify
        public_key.verify(
            signature_der,
            signed_payload.encode("utf-8"),
            ec.ECDSA(hashes.SHA256()),
        )


class AwardingService:
    """Handles bid award logic after bidding window closes (Task 3.12)."""

    def __init__(self, db: DBService | None = None):
        self._db = db or db_service

    async def process_awards(self, route_id: str) -> dict[str, Any] | None:
        """Select the lowest valid bid and award the route.

        Once a route's bidding window closes:
        1. Select the lowest valid bid
        2. Mark it 'awarded', mark the route 'awarded'
        3. Mark other bids 'rejected'
        4. Queue notifications to all bidding carriers
        """
        route = await self._db.get_route(route_id)
        if not route or route.get("status") != "proposed":
            return None

        bids = await self._db.get_bids_for_route(route_id)
        valid_bids = [b for b in bids if b.get("status") == "submitted"]

        if not valid_bids:
            logger.info(f"No valid bids for route {route_id}")
            return None

        # Sort by bid amount (ascending) — lowest wins
        valid_bids.sort(key=lambda b: b["bid_amount_paise"])
        winner = valid_bids[0]

        # Award the winning bid
        await self._db.update_bid_status(winner["id"], "awarded")

        # Reject all other bids
        for bid in valid_bids[1:]:
            await self._db.update_bid_status(bid["id"], "rejected")

        # Update the route
        await self._db.update_route(
            route_id,
            {
                "status": "awarded",
                "vehicle_id": None,  # Will be set when carrier confirms
            },
        )

        logger.info(
            f"Route {route_id} awarded to carrier {winner['carrier_id']} "
            f"at {winner['bid_amount_paise']} paise"
        )

        # Queue notifications (fire-and-forget)
        for bid in valid_bids:
            status_msg = "won" if bid["id"] == winner["id"] else "lost"
            await self._db.insert_notification(
                {
                    "profile_id": bid["carrier_id"],
                    "channel": "in_app",
                    "payload": json.dumps(
                        {
                            "type": "bid_outcome",
                            "route_id": route_id,
                            "result": status_msg,
                            "bid_amount_paise": bid["bid_amount_paise"],
                        }
                    ),
                    "status": "queued",
                }
            )

        return winner


bidding_service = BiddingService()
awarding_service = AwardingService()
