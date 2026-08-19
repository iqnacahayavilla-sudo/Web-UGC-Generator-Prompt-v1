from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response, Query, Request
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from services import storage_service, product_analysis, prompt_generator
from services.ai_service import (
    AIError, RATE_LIMITED, QUOTA_EXCEEDED, TIMEOUT, PROVIDER_ERROR,
    VALIDATION_ERROR, MALFORMED_RESPONSE, UNKNOWN_ERROR
)
from services.credit_service import CreditService, PLAN_CATALOG, TOPUP_PACKAGES
from services.payment_service import PaymentService
from services.supabase_service import SupabaseService, GENERATE_CREDIT_COST

mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('MONGO_DB_NAME') or os.environ.get('DB_NAME', 'ugc_prompt_studio')
client = None
db = None

if mongo_url and not mongo_url.startswith("mongodb://localhost"):
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
        db = client[db_name]
    except Exception as mongo_err:
        pass

credit_service = CreditService(db)
supabase_service = SupabaseService(db)
payment_service = PaymentService(credit_service)


app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def safe_print(*args):
    try:
        text = " ".join(str(a) for a in args)
        print(text.encode("ascii", errors="replace").decode("ascii"))
    except Exception:
        pass

ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def log_generation_activity(
    user_id: str,
    project_id: str,
    status: str,
    product_name: Optional[str] = None,
    duration: Optional[str] = None,
    credits_deducted: int = 0,
    error_message: Optional[str] = None,
    timestamp: Optional[str] = None
):
    """
    Mencatat log setiap kali ada aktivitas generate prompt (user_id, status, timestamp) ke koleksi generation_logs MongoDB.
    """
    now_str = timestamp or now_iso()
    log_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "project_id": project_id,
        "status": status,
        "product_name": product_name or "Produk Unggulan",
        "duration": duration,
        "credits_deducted": credits_deducted,
        "error_message": error_message,
        "timestamp": now_str,
        "created_at": now_str,
    }
    try:
        if db is not None:
            await db.generation_logs.insert_one(log_doc)
            logger.info(f"[LOG GENERATION] user_id={user_id}, status={status}, project_id={project_id}")
    except Exception as log_err:
        logger.warning(f"Failed to insert into generation_logs: {log_err}")


# Map an AI error classification to (http_status, user_message).
_BUSY_MSG = "AI sedang cukup sibuk. Tunggu beberapa saat lalu coba lagi."
_GENERIC_MSG = "Terjadi kendala saat membuat prompt. Silakan coba lagi."

def _ai_error_response(err: "AIError"):
    mapping = {
        RATE_LIMITED: (503, _BUSY_MSG),
        QUOTA_EXCEEDED: (503, _BUSY_MSG),
        TIMEOUT: (504, _GENERIC_MSG),
        PROVIDER_ERROR: (502, _GENERIC_MSG),
        MALFORMED_RESPONSE: (502, _GENERIC_MSG),
        VALIDATION_ERROR: (400, "Pengaturan ini belum bisa diproses. Silakan sesuaikan lalu coba lagi."),
        UNKNOWN_ERROR: (502, _GENERIC_MSG),
    }
    status, message = mapping.get(err.classification, (502, _GENERIC_MSG))
    return HTTPException(status_code=status, detail={"code": err.classification, "message": message})


# ---------- Models ----------
class VideoSettings(BaseModel):
    aspect_ratio: str = "9:16"
    duration: str = "10 seconds"
    ugc_style: str = "Problem \u2192 Solution"
    hook_style: str = "AI Chooses"
    selling_style: str = "Natural Recommendation"


class CreatorSettings(BaseModel):
    gender: str = "Any"
    age: str = "AI Chooses"
    personality: str = "Relatable"
    speaking_style: str = "Natural"
    location: str = "Product Appropriate"


class GenerateRequest(BaseModel):
    user_id: Optional[str] = "guest-user"
    product_analysis: dict
    video_settings: VideoSettings
    creator_settings: CreatorSettings
    language: str = "Bahasa Indonesia"
    natural_language: bool = True
    modifier: Optional[str] = None
    character_anchor: Optional[str] = None
    reuse_character: bool = False


class ConsumeCreditRequest(BaseModel):
    user_id: str = "guest-user"
    tokens: int = 1
    category: str = "UGC Video Prompt"
    prompt_result: Optional[Any] = None
    model_used: str = "gemini-flash"


class TopupCreditRequest(BaseModel):
    user_id: str = "guest-user"
    bonus_tokens: int = 0
    new_plan: Optional[str] = None
    price_paid: float = 0.0
    payment_ref: Optional[str] = None


class CreatePaymentRequest(BaseModel):
    user_id: str = "guest-user"
    item_type: str  # 'subscription' | 'topup'
    item_id: str    # 'pro', 'enterprise', 'topup_50', 'topup_200', 'topup_500'
    amount: int
    item_name: str
    customer_name: Optional[str] = "Kreator Sinergi"
    customer_email: Optional[str] = "kreator@sinergivisual.com"
    gateway: Optional[str] = "midtrans"


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    try:
        storage_service.init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    try:
        await client.admin.command('ping')
        logger.info(f"MongoDB connection established successfully at {mongo_url}, database: {db_name}")
        safe_print(f"[MONGODB CONNECTED] Database: {db_name}")
    except Exception as mongo_err:
        logger.warning(f"MongoDB ping connection notice: {mongo_err}")


@api_router.get("/")
async def root():
    return {"message": "SINERGI VISUAL UGC GENERATOR PROMPT API"}


# ---------- Credit & Monetization Endpoints ----------
@api_router.get("/credits")
async def get_user_credits(user_id: str = Query("guest-user")):
    """Mengambil status saldo kredit user saat ini dengan auto-reset harian 00:00 WIB."""
    credits_data = await credit_service.get_or_create_user_credits(user_id)
    if "_id" in credits_data:
        credits_data["_id"] = str(credits_data["_id"])
    return credits_data


@api_router.post("/credits/consume")
async def consume_credits(req: ConsumeCreditRequest):
    """Mengurangi saldo kredit user (daily_credits_remaining didahulukan, lalu bonus_credits)."""
    res = await credit_service.consume_credits(
        user_id=req.user_id,
        tokens=req.tokens,
        category=req.category,
        prompt_result=req.prompt_result,
        model_used=req.model_used
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=403,
            detail={"code": "KREDIT_HABIS", "message": res.get("message", "Saldo kredit Anda tidak mencukupi.")}
        )
    return res


@api_router.post("/credits/topup")
async def topup_credits(req: TopupCreditRequest):
    """Top up paket token instan atau upgrade paket langganan SaaS."""
    res = await credit_service.topup_credits(
        user_id=req.user_id,
        bonus_tokens=req.bonus_tokens,
        new_plan=req.new_plan,
        price_paid=req.price_paid,
        payment_ref=req.payment_ref
    )
    return res


@api_router.get("/credits/pricing")
async def get_pricing_catalog():
    """Mengambil daftar paket langganan dan paket top-up kredit."""
    return {
        "plans": list(PLAN_CATALOG.values()),
        "topup_packages": TOPUP_PACKAGES
    }


# ---------- Payment Gateway Endpoints (Midtrans & Xendit) ----------
@api_router.post("/payments/create-transaction")
async def create_payment_transaction(req: CreatePaymentRequest):
    """Membuat transaksi pembayaran melalui Midtrans Snap atau Xendit Invoice."""
    res = await payment_service.create_transaction(
        user_id=req.user_id,
        item_type=req.item_type,
        item_id=req.item_id,
        amount=req.amount,
        item_name=req.item_name,
        customer_name=req.customer_name or "Kreator Sinergi",
        customer_email=req.customer_email or "kreator@sinergivisual.com",
        payment_gateway=req.gateway or "midtrans"
    )
    return res


@api_router.post("/payments/webhook")
async def payment_webhook(request: Request):
    """Webhook penerima notifikasi otomatis dari Midtrans / Xendit."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON payload")

    res = await payment_service.process_webhook(body)
    return res


@api_router.post("/payments/simulate-success")
async def simulate_payment_success(req: TopupCreditRequest):
    """Simulasi pembayaran instan untuk Sandbox & Demo pengujian lokal."""
    res = await credit_service.topup_credits(
        user_id=req.user_id,
        bonus_tokens=req.bonus_tokens,
        new_plan=req.new_plan,
        price_paid=req.price_paid,
        payment_ref=req.payment_ref or f"SIM-{uuid.uuid4().hex[:8]}"
    )
    return {
        "success": True,
        "simulated": True,
        "message": "Pembayaran simulasi berhasil diverifikasi dan kredit aktif.",
        "data": res
    }


# ---------- Image upload + analysis ----------
@app.post("/api/analyze")
@app.post("/api/analyze-image")
@app.post("/analyze")
@app.post("/analyze-image")
@api_router.post("/analyze")
@api_router.post("/analyze-image")
async def analyze_product(
    file: Optional[UploadFile] = File(None),
    request: Request = None
):
    """
    Menganalisis foto produk via OpenAI GPT-4o-mini Vision.
    Mendukung upload file multipart/form-data dan JSON payload base64.
    """
    req_path = request.url.path if request else "/api/analyze"
    req_method = request.method if request else "POST"
    logger.info(f"[API ANALYZE] method={req_method} path={req_path} has_file={bool(file)}")
    data = None
    ext = "jpg"


    # 1. Coba baca dari multipart file
    if file is not None:
        filename = file.filename or "product.jpg"
        ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
        if ext not in ALLOWED_EXT:
            ext = "jpg"
        data = await file.read()

    # 2. Jika bukan multipart file, coba baca dari JSON payload (base64 data URL)
    if (not data or len(data) == 0) and request is not None:
        try:
            body = await request.json()
            raw_b64 = body.get("image_base64") or body.get("image") or body.get("file") or ""
            if raw_b64:
                if "," in raw_b64:
                    header, raw_b64 = raw_b64.split(",", 1)
                    if "png" in header:
                        ext = "png"
                    elif "webp" in header:
                        ext = "webp"
                data = base64.b64decode(raw_b64)
        except Exception:
            pass

    # 3. Validasi isi file
    if not data or len(data) == 0:
        raise HTTPException(status_code=400, detail="File foto tidak ditemukan atau kosong.")

    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran foto terlalu besar. Maksimal 10 MB.")

    try:
        upload = storage_service.upload_product_image(data, ext)
    except Exception as e:
        logger.warning(f"Image upload disk write notice: {e}. Menggunakan virtual path.")
        upload = {"path": f"{uuid.uuid4()}.{ext}", "content_type": f"image/{ext}"}

    project_id = str(uuid.uuid4())
    try:
        analysis = await product_analysis.analyze(project_id, data)
    except ai_service.AIError as aie:
        logger.error(f"[AI] Image analysis error: {aie.classification} - {aie}")
        status_code = aie.status if aie.status and aie.status >= 400 else 500
        raise HTTPException(
            status_code=status_code,
            detail={
                "success": False,
                "error": {
                    "code": aie.classification,
                    "message": str(aie)
                }
            }
        )
    except Exception as e:
        logger.error(f"[AI] Unexpected image analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": f"Gagal menganalisis produk: {str(e)}"
                }
            }
        )

    safe_print("\n==================== [SERVER LOG - PRODUCT ANALYSIS RESULT] ====================")
    safe_print(f"Project ID: {project_id}")
    safe_print(f"Product Name: {analysis.get('product_name')}")
    safe_print(f"Product Category: {analysis.get('category')}")
    safe_print(f"Product Type: {analysis.get('product_type')}")
    safe_print(f"Raw Analysis Keys: {list(analysis.keys())}")
    safe_print("=================================================================================\n")

    project = {
        "id": project_id,
        "user_id": None,
        "product_image_path": upload["path"],
        "product_analysis": analysis,
        "video_settings": VideoSettings().model_dump(),
        "creator_settings": CreatorSettings().model_dump(),
        "language": "Bahasa Indonesia",
        "generated_prompt": None,
        "generated_scenes": None,
        "generated_summary": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    if db is not None:
        try:
            await db.projects.insert_one({**project})
        except Exception as db_err:
            logger.warning(f"DB project insert notice: {db_err}")

    return {
        "success": True,
        "project_id": project_id,
        "product_image_path": upload["path"],
        "product_analysis": analysis,
    }


# ---------- Serve stored images ----------
@app.get("/api/files/{path:path}")
@app.get("/files/{path:path}")
@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        content, content_type = storage_service.get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=content, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"})


# ---------- Generate prompt with Supabase Credit Validation & Project Saving ----------
@app.post("/api/projects/{project_id}/generate")
@app.post("/api/generate")
@app.post("/projects/{project_id}/generate")
@app.post("/generate")
@api_router.post("/projects/{project_id}/generate")
@api_router.post("/generate")
async def generate_prompt(
    req: GenerateRequest,
    project_id: str = "proj-default"
):
    user_id = req.user_id or "guest-user"
    credit_cost = 10  # 10 credits per prompt generation

    # 1. Validasi saldo kredit sebelum proses AI berjalan
    try:
        is_enough, total_credits, user_info = await supabase_service.check_user_credits(user_id, required_credits=credit_cost)
        user_credits = total_credits

        if user_credits < 10:
            # Catat log aktivitas gagal karena kredit tidak mencukupi ke MongoDB
            await log_generation_activity(
                user_id=user_id,
                project_id=project_id,
                status="insufficient_credits",
                product_name=req.product_analysis.get("product_name"),
                duration=req.video_settings.duration,
                credits_deducted=0,
                error_message="Kredit tidak mencukupi untuk melakukan generate prompt."
            )
            raise HTTPException(
                status_code=403,
                detail="Kredit tidak mencukupi untuk melakukan generate prompt."
            )
    except HTTPException:
        raise
    except Exception as cred_err:
        logger.warning(f"Credit pre-check warning: {cred_err}")

    # 2. Panggil AI Generator via OpenAI GPT-4o-mini
    try:
        result = await prompt_generator.generate(
            session_id=f"{project_id}-{uuid.uuid4()}",
            analysis=req.product_analysis,
            video=req.video_settings.model_dump(),
            creator=req.creator_settings.model_dump(),
            language=req.language,
            natural_language=req.natural_language,
            modifier=req.modifier,
            character_anchor=req.character_anchor,
            reuse_character=req.reuse_character,
        )
    except ai_service.AIError as aie:
        logger.error(f"[AI] Prompt generation error: {aie.classification} - {aie}")
        status_code = aie.status if aie.status and aie.status >= 400 else 500
        raise HTTPException(
            status_code=status_code,
            detail={
                "success": False,
                "error": {
                    "code": aie.classification,
                    "message": str(aie)
                }
            }
        )
    except Exception as e:
        logger.error(f"[AI] Unexpected prompt generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": f"Gagal membuat prompt UGC: {str(e)}"
                }
            }
        )


    safe_print("\n==================== [SERVER LOG - GENERATED PROMPT RESULT] ====================")
    safe_print(f"Project ID: {project_id}")
    safe_print(f"User ID: {user_id}")
    safe_print(f"Generated Summary: {result.get('summary')}")
    safe_print(f"Master Prompt Preview: {str(result.get('master_prompt'))[:250]}...")
    safe_print(f"Scenes Count: {len(result.get('scenes', []))}")
    safe_print("=================================================================================\n")

    # 3. Setiap kali user berhasil generate, lakukan deduksi credit di tabel profiles Supabase sebanyak 10 credits
    try:
        credit_deduction = await supabase_service.deduct_user_credits(
            user_id=user_id,
            amount=credit_cost,
            category=f"UGC Prompt - {req.video_settings.ugc_style}",
            prompt_result={"summary": result.get("summary")},
            model_used="gpt-4o-mini"
        )
        result["credit_status"] = credit_deduction
    except Exception as e:
        logger.warning(f"Credit consumption warning: {e}")

    # 4. Simpan hasil JSON prompt beserta user_id ke dalam tabel projects Supabase agar riwayat bisa diakses kembali dari halaman History
    try:
        await supabase_service.save_project(
            project_id=project_id,
            user_id=user_id,
            product_analysis=req.product_analysis,
            video_settings=req.video_settings.model_dump(),
            creator_settings=req.creator_settings.model_dump(),
            language=req.language,
            prompt_result=result
        )
    except Exception as save_err:
        logger.warning(f"Project save warning: {save_err}")

    # 5. Catat log aktivitas berhasil generate prompt ke koleksi generation_logs di MongoDB
    try:
        await log_generation_activity(
            user_id=user_id,
            project_id=project_id,
            status="success",
            product_name=req.product_analysis.get("product_name"),
            duration=req.video_settings.duration,
            credits_deducted=credit_cost,
            error_message=None
        )
    except Exception as log_act_err:
        logger.warning(f"Generation activity logging warning: {log_act_err}")

    return result


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        # Coba ambil dari Supabase
        history = await supabase_service.get_user_projects_history(limit=100)
        found = next((p for p in history if p.get("id") == project_id), None)
        if found:
            return found
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# ---------- History & Projects Retrieval ----------
@api_router.get("/projects")
@api_router.get("/history")
async def get_user_history(user_id: str = Query("guest-user"), limit: int = Query(50)):
    """Mengambil riwayat proyek dan prompt yang pernah di-generate oleh user."""
    return await supabase_service.get_user_projects_history(user_id=user_id, limit=limit)


# ---------- Admin Panel & User Management (Invite-Only) ----------
ADMIN_EMAILS = {"iqna.cahayavilla@gmail.com", "sinergivisual.id@gmail.com"}

class AdminCreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str
    initial_credits: int = 100
    plan_type: str = "free"
    admin_email: Optional[str] = None

class AdminAdjustCreditsRequest(BaseModel):
    user_id: str
    amount: int
    mode: str = "add"  # 'add' | 'set'
    admin_email: Optional[str] = None

@app.post("/api/admin/users/create")
@app.post("/api/admin/users/create/")
@api_router.post("/admin/users/create")
@api_router.post("/admin/users/create/")
async def admin_create_user(req: AdminCreateUserRequest):
    """Membuat akun member baru oleh Admin (Invite-Only)."""
    if req.admin_email and req.admin_email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Hanya akun Admin (iqna.cahayavilla@gmail.com) yang diizinkan.")

    try:
        res = await supabase_service.create_member_user(
            email=req.email.strip().lower(),
            password=req.password,
            full_name=req.full_name.strip(),
            initial_credits=req.initial_credits,
            plan_type=req.plan_type,
        )
        return res
    except Exception as e:
        logger.error(f"Admin create user failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal membuat akun member: {str(e)}")

@app.get("/api/admin/users")
@app.get("/api/admin/users/")
@api_router.get("/admin/users")
@api_router.get("/admin/users/")
async def admin_list_users(admin_email: Optional[str] = Query(None), limit: int = Query(100)):
    """Mengambil daftar seluruh member terdaftar untuk Admin Panel."""
    if admin_email and admin_email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Hanya akun Admin (iqna.cahayavilla@gmail.com) yang diizinkan.")
    
    try:
        members = await supabase_service.list_members(limit=limit)
        return {"success": True, "count": len(members), "users": members}
    except Exception as e:
        logger.error(f"Admin list users failed: {e}")
        return {"success": False, "count": 0, "users": [], "error": str(e)}

@app.post("/api/admin/users/adjust-credits")
@app.post("/api/admin/users/adjust-credits/")
@api_router.post("/admin/users/adjust-credits")
@api_router.post("/admin/users/adjust-credits/")
async def admin_adjust_credits(req: AdminAdjustCreditsRequest):
    """Menambah atau mengatur saldo kredit member oleh Admin."""
    if req.admin_email and req.admin_email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Hanya akun Admin (iqna.cahayavilla@gmail.com) yang diizinkan.")

    try:
        res = await supabase_service.adjust_member_credits(
            user_id=req.user_id,
            amount=req.amount,
            mode=req.mode
        )
        return res
    except Exception as e:
        logger.error(f"Admin adjust credits failed: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal memperbarui kredit: {str(e)}")


app.include_router(api_router)

# Explicit CORS Middleware configuration allowing POST and OPTIONS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        try:
            client.close()
        except Exception:
            pass

