"""Supabase Database & Credits Service for Sinergi Visual UGC Generator Prompt.

Handles:
1. User credit checking & deduction in Supabase `profiles` & `user_credits` tables.
2. Saving generated prompts and projects into Supabase `projects` table for history retrieval.
3. Fallback to MongoDB / In-memory state if Supabase is offline or credentials are being configured.
"""
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional, List
import requests
import json

logger = logging.getLogger("supabase_service")

# Default Credit Cost per UGC Generation
GENERATE_CREDIT_COST = int(os.environ.get("GENERATE_CREDIT_COST", 10))

def _get_supabase_config() -> Tuple[str, str]:
    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("REACT_APP_SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip().rstrip("/")
    
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("REACT_APP_SUPABASE_ANON_KEY")
        or ""
    ).strip()

    return url, key

def is_supabase_configured() -> bool:
    url, key = _get_supabase_config()
    return bool(url and key and not "your-supabase" in url and url.startswith("http"))

def _headers(key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

class SupabaseService:
    def __init__(self, db=None):
        self.db = db

    def _call_rest(self, method: str, endpoint: str, json_data: dict = None, params: dict = None) -> Tuple[bool, Any]:
        url, key = _get_supabase_config()
        if not url or not key:
            return False, None
        
        full_url = f"{url}/rest/v1/{endpoint}"
        try:
            resp = requests.request(
                method=method,
                url=full_url,
                headers=_headers(key),
                json=json_data,
                params=params,
                timeout=12
            )
            if resp.status_code in (200, 201, 204):
                try:
                    return True, resp.json() if resp.text else []
                except Exception:
                    return True, resp.text
            else:
                logger.warning(f"Supabase REST error [{resp.status_code}] on {endpoint}: {resp.text}")
                return False, resp.text
        except Exception as e:
            logger.warning(f"Supabase request failed: {e}")
            return False, str(e)

    async def get_user_credits_info(self, user_id: str = "guest-user") -> Dict[str, Any]:
        """
        Ambil informasi saldo kredit user dari tabel `profiles` atau `user_credits` Supabase.
        """
        if is_supabase_configured() and user_id and user_id != "guest-user":
            # 1. Coba baca dari tabel `profiles`
            ok, res = self._call_rest("GET", "profiles", params={"id": f"eq.{user_id}", "select": "*"})
            if ok and isinstance(res, list) and len(res) > 0:
                profile = res[0]
                credits_val = profile.get("credits")
                if credits_val is not None:
                    return {
                        "user_id": user_id,
                        "credits": int(credits_val),
                        "total_credits": int(credits_val),
                        "plan_type": profile.get("plan_type", "free"),
                        "full_name": profile.get("full_name", "Kreator Sinergi"),
                        "email": profile.get("email", ""),
                        "source": "supabase_profiles"
                    }

            # 2. Coba baca dari tabel `user_credits`
            ok_cred, res_cred = self._call_rest("GET", "user_credits", params={"user_id": f"eq.{user_id}", "select": "*"})
            if ok_cred and isinstance(res_cred, list) and len(res_cred) > 0:
                cred_record = res_cred[0]
                daily = int(cred_record.get("daily_credits_remaining", 100))
                bonus = int(cred_record.get("bonus_credits", 0))
                total = daily + bonus
                return {
                    "user_id": user_id,
                    "credits": total,
                    "total_credits": total,
                    "daily_credits_remaining": daily,
                    "bonus_credits": bonus,
                    "daily_quota": cred_record.get("daily_quota", 100),
                    "source": "supabase_user_credits"
                }

            # 3. Jika user baru di Supabase, buat baris profile / user_credits dengan 100 + 10 kredit awal
            init_credits = 110
            try:
                self._call_rest("POST", "profiles", json_data={
                    "id": user_id,
                    "credits": init_credits,
                    "plan_type": "free"
                })
            except Exception:
                pass

            try:
                self._call_rest("POST", "user_credits", json_data={
                    "user_id": user_id,
                    "daily_quota": 100,
                    "daily_credits_remaining": 100,
                    "bonus_credits": 10
                })
            except Exception:
                pass

            return {
                "user_id": user_id,
                "credits": init_credits,
                "total_credits": init_credits,
                "plan_type": "free",
                "source": "supabase_initialized"
            }

        # Fallback Local / MongoDB
        if self.db is not None:
            try:
                rec = await self.db.user_credits.find_one({"user_id": user_id})
                if rec:
                    tot = rec.get("daily_credits_remaining", 100) + rec.get("bonus_credits", 0)
                    return {
                        "user_id": user_id,
                        "credits": tot,
                        "total_credits": tot,
                        "daily_credits_remaining": rec.get("daily_credits_remaining", 100),
                        "bonus_credits": rec.get("bonus_credits", 0),
                        "source": "mongodb"
                    }
            except Exception as e:
                logger.warning(f"MongoDB credit query notice: {e}")

        # Default fallback
        return {
            "user_id": user_id,
            "credits": 110,
            "total_credits": 110,
            "daily_credits_remaining": 100,
            "bonus_credits": 10,
            "source": "default_local"
        }

    async def check_user_credits(self, user_id: str = "guest-user", required_credits: int = 10) -> Tuple[bool, int, Dict[str, Any]]:
        """
        Cek apakah credit user cukup sebelum generate (misal >= 10 credits).
        """
        info = await self.get_user_credits_info(user_id)
        current_credits = info.get("credits", info.get("total_credits", 0))
        is_enough = current_credits >= required_credits
        return is_enough, current_credits, info

    async def deduct_user_credits(
        self,
        user_id: str = "guest-user",
        amount: int = 10,
        category: str = "UGC Video Prompt",
        prompt_result: Any = None,
        model_used: str = "gemini-flash"
    ) -> Dict[str, Any]:
        """
        Kurangi saldo credit user di tabel `profiles` dan `user_credits` Supabase sebesar `amount` (misal 10 credits).
        """
        current_info = await self.get_user_credits_info(user_id)
        cur_credits = current_info.get("credits", current_info.get("total_credits", 0))
        new_credits = max(0, cur_credits - amount)

        if is_supabase_configured() and user_id and user_id != "guest-user":
            # 1. Update tabel `profiles` (kolom credits)
            try:
                self._call_rest("PATCH", f"profiles?id=eq.{user_id}", json_data={
                    "credits": new_credits,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e:
                logger.warning(f"Failed to update profiles in Supabase: {e}")

            # 2. Update tabel `user_credits`
            try:
                daily_rem = current_info.get("daily_credits_remaining", 100)
                bonus_rem = current_info.get("bonus_credits", 0)

                if daily_rem >= amount:
                    daily_rem -= amount
                else:
                    diff = amount - daily_rem
                    daily_rem = 0
                    bonus_rem = max(0, bonus_rem - diff)

                self._call_rest("PATCH", f"user_credits?user_id=eq.{user_id}", json_data={
                    "daily_credits_remaining": daily_rem,
                    "bonus_credits": bonus_rem,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as e:
                logger.warning(f"Failed to update user_credits in Supabase: {e}")

            # 3. Catat ke tabel `prompt_logs`
            try:
                self._call_rest("POST", "prompt_logs", json_data={
                    "user_id": user_id,
                    "category": category,
                    "tokens_used": amount,
                    "prompt_result": prompt_result if isinstance(prompt_result, dict) else {"data": str(prompt_result)},
                    "model_used": model_used
                })
            except Exception:
                pass

        # Sync ke MongoDB jika tersedia
        if self.db is not None:
            try:
                await self.db.user_credits.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "daily_credits_remaining": max(0, current_info.get("daily_credits_remaining", 100) - amount),
                        "total_credits": new_credits,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"MongoDB credit deduct sync notice: {e}")

        return {
            "success": True,
            "deducted": amount,
            "remaining_credits": new_credits,
            "total_credits": new_credits,
            "user_id": user_id
        }

    async def save_project(
        self,
        project_id: str,
        user_id: str,
        product_analysis: dict,
        video_settings: dict,
        creator_settings: dict,
        language: str,
        prompt_result: dict,
        product_image_path: str = ""
    ) -> Dict[str, Any]:
        """
        Simpan hasil JSON prompt beserta user_id ke tabel `projects` Supabase agar riwayat bisa diakses di halaman History.
        """
        now_str = datetime.now(timezone.utc).isoformat()
        
        project_data = {
            "id": project_id,
            "user_id": user_id if user_id and user_id != "guest-user" else None,
            "product_name": product_analysis.get("product_name", "Produk Unggulan"),
            "product_image_path": product_image_path,
            "product_analysis": product_analysis,
            "video_settings": video_settings,
            "creator_settings": creator_settings,
            "language": language,
            "generated_prompt": prompt_result.get("master_prompt"),
            "generated_scenes": prompt_result.get("scenes"),
            "generated_summary": prompt_result.get("summary"),
            "character_anchor": prompt_result.get("character_anchor"),
            "character_bible": prompt_result.get("character_bible"),
            "product_lock": prompt_result.get("product_lock"),
            "created_at": now_str,
            "updated_at": now_str,
        }

        # 1. Simpan ke Supabase `projects`
        if is_supabase_configured():
            try:
                ok, res = self._call_rest("POST", "projects", json_data=project_data)
                if not ok:
                    # Coba update jika sudah ada (Upsert)
                    self._call_rest("PATCH", f"projects?id=eq.{project_id}", json_data=project_data)
                logger.info(f"Project {project_id} saved to Supabase projects table.")
            except Exception as e:
                logger.warning(f"Failed to save project to Supabase: {e}")

        # 2. Simpan ke MongoDB jika tersedia
        if self.db is not None:
            try:
                await self.db.projects.update_one(
                    {"id": project_id},
                    {"$set": {**project_data}},
                    upsert=True
                )
            except Exception as db_err:
                logger.warning(f"MongoDB project save notice: {db_err}")

        return project_data

    async def get_user_projects_history(self, user_id: str = "guest-user", limit: int = 50) -> List[Dict[str, Any]]:
        """
        Ambil riwayat prompt proyek yang pernah dibuat oleh user.
        """
        if is_supabase_configured() and user_id and user_id != "guest-user":
            ok, res = self._call_rest(
                "GET",
                "projects",
                params={
                    "user_id": f"eq.{user_id}",
                    "order": "created_at.desc",
                    "limit": str(limit),
                    "select": "*"
                }
            )
            if ok and isinstance(res, list):
                return res

        # Fallback MongoDB
        if self.db is not None:
            try:
                query = {"user_id": user_id} if user_id != "guest-user" else {}
                cursor = self.db.projects.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
                return await cursor.to_list(length=limit)
            except Exception as e:
                logger.warning(f"MongoDB history query notice: {e}")

        return []

    async def create_member_user(
        self,
        email: str,
        password: str,
        full_name: str,
        initial_credits: int = 100,
        plan_type: str = "free"
    ) -> Dict[str, Any]:
        """
        Membuat akun member baru (Invite-Only) oleh Admin.
        Mendaftarkan ke Supabase Auth, Profiles, dan MongoDB.
        """
        import uuid
        now_str = datetime.now(timezone.utc).isoformat()
        user_id = str(uuid.uuid4())
        created_user = None

        url, key = _get_supabase_config()

        # 1. Coba daftarkan via Supabase Auth REST
        if is_supabase_configured():
            try:
                # Coba signup via auth/v1/signup
                signup_url = f"{url}/auth/v1/signup"
                resp = requests.post(
                    signup_url,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "email": email,
                        "password": password,
                        "data": {
                            "full_name": full_name,
                            "plan_type": plan_type,
                        }
                    },
                    timeout=15
                )
                if resp.status_code in (200, 201):
                    res_json = resp.json()
                    user_obj = res_json.get("user") or res_json
                    if user_obj and "id" in user_obj:
                        user_id = user_obj["id"]
                    created_user = user_obj
                else:
                    logger.warning(f"Supabase auth signup notice [{resp.status_code}]: {resp.text}")
            except Exception as auth_err:
                logger.warning(f"Supabase Auth registration notice: {auth_err}")

            # 2. Simpan profil & kredit ke tabel `profiles` Supabase
            try:
                self._call_rest("POST", "profiles", json_data={
                    "id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "credits": initial_credits,
                    "plan_type": plan_type,
                    "updated_at": now_str,
                })
            except Exception as prof_err:
                logger.warning(f"Supabase profiles insert notice: {prof_err}")

            # 3. Simpan ke tabel `user_credits` Supabase
            try:
                self._call_rest("POST", "user_credits", json_data={
                    "user_id": user_id,
                    "daily_quota": initial_credits,
                    "daily_credits_remaining": initial_credits,
                    "bonus_credits": 0,
                    "last_reset_date": now_str[:10],
                    "updated_at": now_str,
                })
            except Exception as uc_err:
                logger.warning(f"Supabase user_credits insert notice: {uc_err}")

        # 4. Simpan ke MongoDB untuk redundansi lokal
        if self.db is not None:
            try:
                await self.db.users.update_one(
                    {"email": email},
                    {"$set": {
                        "id": user_id,
                        "email": email,
                        "full_name": full_name,
                        "plan_type": plan_type,
                        "created_at": now_str,
                        "updated_at": now_str,
                    }},
                    upsert=True
                )
                await self.db.user_credits.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "user_id": user_id,
                        "email": email,
                        "daily_quota": initial_credits,
                        "daily_credits_remaining": initial_credits,
                        "bonus_credits": 0,
                        "last_reset_date": now_str[:10],
                        "updated_at": now_str,
                    }},
                    upsert=True
                )
            except Exception as db_err:
                logger.warning(f"MongoDB user record save notice: {db_err}")

        return {
            "success": True,
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "initial_credits": initial_credits,
            "plan_type": plan_type,
            "created_at": now_str,
        }

    async def list_members(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Daftar seluruh member terdaftar untuk Admin Panel.
        """
        members = []
        # Coba ambil dari Supabase profiles
        if is_supabase_configured():
            ok, res = self._call_rest("GET", "profiles", params={
                "order": "created_at.desc",
                "limit": str(limit),
                "select": "*"
            })
            if ok and isinstance(res, list) and len(res) > 0:
                return res

        # Fallback MongoDB
        if self.db is not None:
            try:
                cursor = self.db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).limit(limit)
                mongo_users = await cursor.to_list(length=limit)
                for u in mongo_users:
                    uid = u.get("id") or u.get("user_id")
                    cred = await self.db.user_credits.find_one({"user_id": uid})
                    if cred:
                        u["credits"] = cred.get("daily_credits_remaining", 100) + cred.get("bonus_credits", 0)
                    members.append(u)
                if members:
                    return members
            except Exception as e:
                logger.warning(f"MongoDB list_members notice: {e}")

        return members

    async def adjust_member_credits(self, user_id: str, amount: int, mode: str = "add") -> Dict[str, Any]:
        """
        Menambah atau mengatur saldo kredit member oleh Admin.
        """
        info = await self.get_user_credits_info(user_id)
        cur = info.get("credits", 0)
        new_balance = (cur + amount) if mode == "add" else max(0, amount)

        # Update Supabase
        if is_supabase_configured():
            self._call_rest("PATCH", f"profiles?id=eq.{user_id}", json_data={"credits": new_balance})
            self._call_rest("PATCH", f"user_credits?user_id=eq.{user_id}", json_data={"daily_credits_remaining": new_balance})

        # Update MongoDB
        if self.db is not None:
            await self.db.user_credits.update_one(
                {"user_id": user_id},
                {"$set": {"daily_credits_remaining": new_balance, "bonus_credits": 0}},
                upsert=True
            )

        return {
            "success": True,
            "user_id": user_id,
            "previous_credits": cur,
            "new_credits": new_balance
        }
