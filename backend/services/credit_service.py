import logging
from datetime import datetime, timezone
import zoneinfo
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Timezone Asia/Jakarta (WIB, UTC+7)
try:
    WIB = zoneinfo.ZoneInfo("Asia/Jakarta")
except Exception:
    WIB = timezone.utc

PLAN_CATALOG = {
    "free": {
        "id": "free",
        "name": "Free Kreator",
        "daily_quota": 100,
        "price": 0,
        "features": [
            "100 Token Generator / Hari",
            "Reset otomatis setiap 00:00 WIB",
            "Analisis Karakteristik Produk Gemini AI",
            "Semua Opsi Gaya Video & Kreator UGC",
            "Ekspor Prompt Standar Google Flow",
        ]
    },
    "pro": {
        "id": "pro",
        "name": "Pro Kreator",
        "daily_quota": 1000,
        "price": 99000,
        "features": [
            "1.000 Token Generator / Hari",
            "Prioritas Antrean AI Tercepat",
            "Akses Fitur Konsistensi Karakter Lanjutan",
            "Multi-Variasi Hook & Naskah Bahasa Lengkap",
            "Dukungan Komunitas & Support Prioritas",
        ]
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise Studio",
        "daily_quota": 5000,
        "price": 299000,
        "features": [
            "5.000 Token Generator / Hari",
            "Akses API & Webhook Kustom",
            "Multi-User & Tim Kolaborasi",
            "Akses Model AI Vision & Text Generative Eksklusif",
            "Dedicated Account Manager & SLA 99.9%",
        ]
    }
}

TOPUP_PACKAGES = [
    {
        "id": "topup_50",
        "name": "Starter Refill",
        "bonus_tokens": 50,
        "price": 25000,
        "badge": "Praktis",
        "description": "50 Token cadangan tanpa masa kedaluwarsa."
    },
    {
        "id": "topup_200",
        "name": "Creator Booster",
        "bonus_tokens": 200,
        "price": 75000,
        "badge": "Paling Populer",
        "description": "200 Token cadangan permanen saat kuota harian habis."
    },
    {
        "id": "topup_500",
        "name": "Studio Power Pack",
        "bonus_tokens": 500,
        "price": 150000,
        "badge": "Hemat 40%",
        "description": "500 Token cadangan untuk produksi video skala besar."
    }
]

def get_today_wib() -> str:
    """Mengembalikan tanggal hari ini dalam format YYYY-MM-DD di zona waktu Asia/Jakarta (WIB)."""
    now = datetime.now(WIB)
    return now.strftime("%Y-%m-%d")


class CreditService:
    def __init__(self, db=None):
        self.db = db

    async def get_or_create_user_credits(self, user_id: str = "guest-user") -> Dict[str, Any]:
        """Mengambil atau menginisialisasi saldo kredit user dengan validasi reset harian 00:00 WIB."""
        today = get_today_wib()
        
        record = None
        if self.db is not None:
            try:
                record = await self.db.user_credits.find_one({"user_id": user_id})
            except Exception as e:
                logger.warning(f"Failed to query MongoDB user_credits: {e}")

        if not record:
            plan = "free"
            quota = PLAN_CATALOG[plan]["daily_quota"]
            record = {
                "user_id": user_id,
                "plan_type": plan,
                "daily_quota": quota,
                "daily_credits_remaining": quota,
                "bonus_credits": 10, # Bonus sambutan 10 token
                "last_reset_date": today,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if self.db is not None:
                try:
                    await self.db.user_credits.update_one(
                        {"user_id": user_id},
                        {"$set": record},
                        upsert=True
                    )
                except Exception as e:
                    logger.warning(f"Failed to insert user_credits to MongoDB: {e}")
        else:
            # Cek apakah tanggal hari ini berbeda dengan last_reset_date (Reset 00:00 WIB)
            if record.get("last_reset_date") != today:
                plan = record.get("plan_type", "free")
                quota = PLAN_CATALOG.get(plan, PLAN_CATALOG["free"])["daily_quota"]
                record["daily_quota"] = quota
                record["daily_credits_remaining"] = quota
                record["last_reset_date"] = today
                record["updated_at"] = datetime.now(timezone.utc).isoformat()
                
                if self.db is not None:
                    try:
                        await self.db.user_credits.update_one(
                            {"user_id": user_id},
                            {"$set": {
                                "daily_quota": quota,
                                "daily_credits_remaining": quota,
                                "last_reset_date": today,
                                "updated_at": record["updated_at"]
                            }}
                        )
                        logger.info(f"Daily credits reset to {quota} for user {user_id} on {today} WIB")
                    except Exception as e:
                        logger.warning(f"Failed to update daily reset in MongoDB: {e}")

        record["total_credits"] = record.get("daily_credits_remaining", 0) + record.get("bonus_credits", 0)
        return record

    async def consume_credits(
        self,
        user_id: str = "guest-user",
        tokens: int = 1,
        category: str = "UGC Video Prompt",
        prompt_result: Any = None,
        model_used: str = "gemini-flash"
    ) -> Dict[str, Any]:
        """
        Mengurangi saldo kredit user secara bertingkat:
        1. Kurangi daily_credits_remaining terlebih dahulu.
        2. Jika habis, kurangi bonus_credits.
        3. Jika total kredit = 0, kembalikan status KREDIT_HABIS (403).
        """
        record = await self.get_or_create_user_credits(user_id)
        total_available = record["total_credits"]

        if total_available < tokens:
            return {
                "success": False,
                "error_code": "KREDIT_HABIS",
                "message": "Saldo kredit Anda tidak mencukupi. Silakan lakukan top up atau upgrade paket.",
                "daily_credits_remaining": record["daily_credits_remaining"],
                "bonus_credits": record["bonus_credits"],
                "total_credits": total_available,
                "required": tokens
            }

        daily_rem = record["daily_credits_remaining"]
        bonus_rem = record["bonus_credits"]
        deduct_daily = 0
        deduct_bonus = 0

        if daily_rem >= tokens:
            deduct_daily = tokens
            daily_rem -= tokens
        else:
            deduct_daily = daily_rem
            deduct_bonus = tokens - daily_rem
            daily_rem = 0
            bonus_rem -= deduct_bonus

        updated_fields = {
            "daily_credits_remaining": daily_rem,
            "bonus_credits": bonus_rem,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        if self.db is not None:
            try:
                await self.db.user_credits.update_one(
                    {"user_id": user_id},
                    {"$set": updated_fields}
                )
                # Catat Prompt Log
                log_entry = {
                    "user_id": user_id,
                    "category": category,
                    "tokens_used": tokens,
                    "prompt_result": prompt_result,
                    "model_used": model_used,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await self.db.prompt_logs.insert_one(log_entry)
            except Exception as e:
                logger.warning(f"Failed to record credit deduction in MongoDB: {e}")

        return {
            "success": True,
            "tokens_consumed": tokens,
            "deducted_from_daily": deduct_daily,
            "deducted_from_bonus": deduct_bonus,
            "daily_credits_remaining": daily_rem,
            "bonus_credits": bonus_rem,
            "total_credits": daily_rem + bonus_rem,
            "daily_quota": record["daily_quota"],
            "last_reset_date": record["last_reset_date"]
        }

    async def topup_credits(
        self,
        user_id: str = "guest-user",
        bonus_tokens: int = 0,
        new_plan: Optional[str] = None,
        price_paid: float = 0.0,
        payment_ref: Optional[str] = None
    ) -> Dict[str, Any]:
        """Menambahkan bonus kredit atau melakukan upgrade paket langganan."""
        record = await self.get_or_create_user_credits(user_id)
        
        plan = record.get("plan_type", "free")
        quota = record.get("daily_quota", 100)
        daily_rem = record.get("daily_credits_remaining", 100)
        bonus_rem = record.get("bonus_credits", 0) + bonus_tokens

        if new_plan and new_plan in PLAN_CATALOG:
            plan = new_plan
            quota = PLAN_CATALOG[new_plan]["daily_quota"]
            daily_rem = max(daily_rem, quota)

        updated_fields = {
            "plan_type": plan,
            "daily_quota": quota,
            "daily_credits_remaining": daily_rem,
            "bonus_credits": bonus_rem,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        if self.db is not None:
            try:
                await self.db.user_credits.update_one(
                    {"user_id": user_id},
                    {"$set": updated_fields},
                    upsert=True
                )
                if new_plan:
                    await self.db.subscriptions.insert_one({
                        "user_id": user_id,
                        "plan_type": plan,
                        "status": "active",
                        "price_paid": price_paid,
                        "payment_ref": payment_ref,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
            except Exception as e:
                logger.warning(f"Failed to record topup in MongoDB: {e}")

        return {
            "success": True,
            "plan_type": plan,
            "daily_quota": quota,
            "daily_credits_remaining": daily_rem,
            "bonus_credits": bonus_rem,
            "total_credits": daily_rem + bonus_rem,
            "bonus_added": bonus_tokens,
            "new_plan": new_plan
        }
