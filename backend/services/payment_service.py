import os
import hashlib
import logging
import uuid
import requests
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MIDTRANS_SERVER_KEY = os.environ.get("MIDTRANS_SERVER_KEY", "SB-Mid-server-simulated-key")
MIDTRANS_CLIENT_KEY = os.environ.get("MIDTRANS_CLIENT_KEY", "SB-Mid-client-simulated-key")
MIDTRANS_IS_PRODUCTION = os.environ.get("MIDTRANS_IS_PRODUCTION", "false").lower() == "true"
XENDIT_SECRET_KEY = os.environ.get("XENDIT_SECRET_KEY", "")

SNAP_BASE_URL = "https://app.midtrans.com/snap/v1/transactions" if MIDTRANS_IS_PRODUCTION else "https://app.sandbox.midtrans.com/snap/v1/transactions"


class PaymentService:
    def __init__(self, credit_service):
        self.credit_service = credit_service

    def is_midtrans_configured(self) -> bool:
        return bool(MIDTRANS_SERVER_KEY and not MIDTRANS_SERVER_KEY.startswith("SB-Mid-server-simulated"))

    def is_xendit_configured(self) -> bool:
        return bool(XENDIT_SECRET_KEY)

    async def create_transaction(
        self,
        user_id: str,
        item_type: str, # 'subscription' | 'topup'
        item_id: str,   # 'pro', 'enterprise', 'topup_50', 'topup_200', 'topup_500'
        amount: int,
        item_name: str,
        customer_name: str = "Kreator Sinergi",
        customer_email: str = "kreator@sinergivisual.com",
        payment_gateway: str = "midtrans"
    ) -> Dict[str, Any]:
        """Membuat transaksi pembayaran (Midtrans Snap Token / Xendit Invoice)."""
        order_id = f"SV-{item_type.upper()[:3]}-{item_id}-{uuid.uuid4().hex[:8]}-{int(datetime.now().timestamp())}"

        # 1. Jika Midtrans dikonfigurasi resmi
        if payment_gateway == "midtrans" and self.is_midtrans_configured():
            try:
                auth_str = f"{MIDTRANS_SERVER_KEY}:"
                b64_auth = base64.b64encode(auth_str.encode()).decode()

                payload = {
                    "transaction_details": {
                        "order_id": order_id,
                        "gross_amount": amount,
                    },
                    "item_details": [
                        {
                            "id": item_id,
                            "price": amount,
                            "quantity": 1,
                            "name": item_name[:50],
                        }
                    ],
                    "customer_details": {
                        "first_name": customer_name,
                        "email": customer_email,
                    },
                    "callbacks": {
                        "finish": f"http://localhost:3000/create?payment_status=success&order_id={order_id}"
                    }
                }

                res = requests.post(
                    SNAP_BASE_URL,
                    json=payload,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": f"Basic {b64_auth}"
                    },
                    timeout=10
                )

                if res.status_code in (200, 201):
                    data = res.json()
                    return {
                        "success": True,
                        "order_id": order_id,
                        "snap_token": data.get("token"),
                        "redirect_url": data.get("redirect_url"),
                        "gateway": "midtrans",
                        "simulated": False
                    }
                else:
                    logger.warning(f"Midtrans Snap API returned {res.status_code}: {res.text}")
            except Exception as e:
                logger.error(f"Midtrans transaction creation failed: {e}")

        # 2. Mode Simulasi / Sandbox Cepat
        # Mengembalikan token simulasi instan agar checkout dapat dicoba langsung tanpa kartu kredit/akun bank sungguhan.
        mock_snap_token = f"SNAP-{uuid.uuid4().hex}"
        return {
            "success": True,
            "order_id": order_id,
            "snap_token": mock_snap_token,
            "redirect_url": f"http://localhost:3000/create?payment_status=success&order_id={order_id}&simulated=true",
            "gateway": "simulated_midtrans",
            "amount": amount,
            "item_name": item_name,
            "simulated": True,
            "message": "Transaksi pembayaran simulasi Sandbox siap diproses."
        }

    async def process_webhook(self, notification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Memproses Webhook Notifikasi dari Midtrans / Xendit.
        Saat transaksi settlement/capture, saldo kredit atau paket user otomatis diaktifkan.
        """
        order_id = notification_data.get("order_id", "")
        transaction_status = notification_data.get("transaction_status", "")
        fraud_status = notification_data.get("fraud_status", "accept")
        status_code = notification_data.get("status_code", "")
        gross_amount = notification_data.get("gross_amount", "0")
        signature_key = notification_data.get("signature_key", "")
        user_id = notification_data.get("user_id", "guest-user")

        logger.info(f"Received payment webhook for order {order_id} - status: {transaction_status}")

        # Verifikasi signature jika Midtrans resmi
        if self.is_midtrans_configured() and signature_key:
            expected_sig = hashlib.sha512(f"{order_id}{status_code}{gross_amount}{MIDTRANS_SERVER_KEY}".encode()).hexdigest()
            if expected_sig != signature_key:
                logger.warning("Invalid Midtrans signature key on webhook!")
                return {"success": False, "message": "Invalid signature"}

        # Cek apakah status pembayaran sukses
        is_success = (
            transaction_status in ("capture", "settlement", "success")
            and fraud_status == "accept"
        )

        if not is_success:
            return {"success": True, "message": f"Transaction status '{transaction_status}' ignored (not settled)"}

        # Parsing order_id untuk aktivasi (Format: SV-[SUB/TOP]-[item_id]-[hash]-[time])
        parts = order_id.split("-")
        item_category = parts[1] if len(parts) > 1 else ""
        item_id = parts[2] if len(parts) > 2 else ""

        activation_result = None
        if item_category == "SUB":
            # Upgrade Subscription Plan (pro / enterprise)
            plan = item_id if item_id in ("pro", "enterprise") else "pro"
            activation_result = await self.credit_service.topup_credits(
                user_id=user_id,
                bonus_tokens=0,
                new_plan=plan,
                price_paid=float(gross_amount) if gross_amount else 99000.0,
                payment_ref=order_id
            )
            logger.info(f"Successfully activated subscription {plan} for user {user_id}")
        elif item_category == "TOP":
            # Top Up Bonus Tokens (50, 200, 500)
            token_count = 50
            if "200" in item_id:
                token_count = 200
            elif "500" in item_id:
                token_count = 500

            activation_result = await self.credit_service.topup_credits(
                user_id=user_id,
                bonus_tokens=token_count,
                new_plan=None,
                price_paid=float(gross_amount) if gross_amount else 25000.0,
                payment_ref=order_id
            )
            logger.info(f"Successfully added +{token_count} bonus tokens for user {user_id}")

        return {
            "success": True,
            "order_id": order_id,
            "activated": True,
            "result": activation_result
        }
