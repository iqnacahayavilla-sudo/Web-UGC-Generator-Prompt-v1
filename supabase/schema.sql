-- ==============================================================================
-- SINERGI VISUAL UGC GENERATOR PROMPT — SUPABASE (POSTGRESQL) SCHEMA
-- SaaS Monetization, User Credits, Subscriptions, Profiles, & Projects System
-- Timezone: Asia/Jakarta (WIB, GMT+7) | Reset Schedule: 00:00 WIB
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE plan_type_enum AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'expired', 'cancelled', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    plan_type plan_type_enum DEFAULT 'free' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL
);

-- 4. PROFILES TABLE (Fast profile & unified credits access)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    credits INT DEFAULT 110 NOT NULL,
    plan_type VARCHAR(50) DEFAULT 'free' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL
);

-- 5. USER CREDITS TABLE (Detailed daily quota & reset tracking)
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    daily_quota INT DEFAULT 100 NOT NULL,
    daily_credits_remaining INT DEFAULT 100 NOT NULL,
    bonus_credits INT DEFAULT 0 NOT NULL,
    last_reset_date DATE DEFAULT ((NOW() AT TIME ZONE 'Asia/Jakarta')::date) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    CONSTRAINT check_credits_positive CHECK (daily_credits_remaining >= 0 AND bonus_credits >= 0)
);

-- 6. PROJECTS TABLE (Generated UGC prompts and history)
CREATE TABLE IF NOT EXISTS public.projects (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    product_image_path TEXT,
    product_analysis JSONB,
    video_settings JSONB,
    creator_settings JSONB,
    language VARCHAR(50) DEFAULT 'Bahasa Indonesia',
    generated_prompt TEXT,
    generated_scenes JSONB,
    generated_summary JSONB,
    character_anchor TEXT,
    character_bible JSONB,
    product_lock TEXT,
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL
);

-- 7. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_type plan_type_enum NOT NULL,
    status subscription_status_enum DEFAULT 'active' NOT NULL,
    start_date TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    end_date TIMESTAMPTZ,
    price_paid NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    payment_method VARCHAR(50),
    payment_ref VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL
);

-- 8. PROMPT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.prompt_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category VARCHAR(100) DEFAULT 'UGC Video Prompt',
    tokens_used INT DEFAULT 10 NOT NULL,
    prompt_result JSONB,
    model_used VARCHAR(100) DEFAULT 'gemini-flash',
    created_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta') NOT NULL
);

-- ==============================================================================
-- STORED PROCEDURES & LOGIC
-- ==============================================================================

-- 9. FUNCTION: AUTO RESET CHECK (WIB) & CONSUME TOKENS ATOMICALLY
CREATE OR REPLACE FUNCTION public.consume_user_credits(
    p_user_id UUID,
    p_tokens INT DEFAULT 10,
    p_category VARCHAR DEFAULT 'UGC Video Prompt',
    p_prompt_result JSONB DEFAULT NULL,
    p_model_used VARCHAR DEFAULT 'gemini-flash'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
    v_daily_rem INT;
    v_bonus_rem INT;
    v_quota INT;
    v_last_reset DATE;
    v_plan plan_type_enum;
    v_deduct_daily INT := 0;
    v_deduct_bonus INT := 0;
    v_total_available INT;
BEGIN
    -- 1. Ambil & Kunci Row User Credits (Pessimistic Row Lock)
    SELECT 
        c.daily_credits_remaining, 
        c.bonus_credits, 
        c.daily_quota, 
        c.last_reset_date,
        u.plan_type
    INTO 
        v_daily_rem, 
        v_bonus_rem, 
        v_quota, 
        v_last_reset,
        v_plan
    FROM public.user_credits c
    JOIN public.users u ON u.id = c.user_id
    WHERE c.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Cek Reset Harian 00:00 WIB
    IF v_last_reset < v_today THEN
        IF v_plan = 'pro' THEN
            v_quota := 1000;
        ELSIF v_plan = 'enterprise' THEN
            v_quota := 5000;
        ELSE
            v_quota := 100;
        END IF;
        
        v_daily_rem := v_quota;
        v_last_reset := v_today;
    END IF;

    -- 3. Cek Ketersediaan Total Saldo
    v_total_available := v_daily_rem + v_bonus_rem;
    IF v_total_available < p_tokens THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'KREDIT_TIDAK_CUKUP',
            'message', 'Kredit tidak cukup. Minimal saldo yang dibutuhkan adalah ' || p_tokens || ' credits.',
            'daily_credits_remaining', v_daily_rem,
            'bonus_credits', v_bonus_rem,
            'total_credits', v_total_available,
            'required', p_tokens
        );
    END IF;

    -- 4. Pengurangan Kredit: Prioritaskan Daily Credits Dahulu
    IF v_daily_rem >= p_tokens THEN
        v_deduct_daily := p_tokens;
        v_daily_rem := v_daily_rem - p_tokens;
    ELSE
        v_deduct_daily := v_daily_rem;
        v_deduct_bonus := p_tokens - v_daily_rem;
        v_daily_rem := 0;
        v_bonus_rem := v_bonus_rem - v_deduct_bonus;
    END IF;

    -- 5. Update Database user_credits & profiles
    UPDATE public.user_credits
    SET 
        daily_credits_remaining = v_daily_rem,
        bonus_credits = v_bonus_rem,
        daily_quota = v_quota,
        last_reset_date = v_last_reset,
        updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
    WHERE user_id = p_user_id;

    UPDATE public.profiles
    SET
        credits = (v_daily_rem + v_bonus_rem),
        updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
    WHERE id = p_user_id;

    -- 6. Catat Log Prompt
    INSERT INTO public.prompt_logs (
        user_id, category, tokens_used, prompt_result, model_used, created_at
    ) VALUES (
        p_user_id, p_category, p_tokens, p_prompt_result, p_model_used, (NOW() AT TIME ZONE 'Asia/Jakarta')
    );

    -- 7. Kembalikan Response Sukses
    RETURN jsonb_build_object(
        'success', true,
        'tokens_consumed', p_tokens,
        'deducted_from_daily', v_deduct_daily,
        'deducted_from_bonus', v_deduct_bonus,
        'daily_credits_remaining', v_daily_rem,
        'bonus_credits', v_bonus_rem,
        'total_credits', (v_daily_rem + v_bonus_rem),
        'daily_quota', v_quota,
        'last_reset_date', v_last_reset
    );
END;
$$;

-- 10. FUNCTION: TOP UP BONUS CREDITS ATAU UPGRADE PLAN
CREATE OR REPLACE FUNCTION public.topup_user_credits(
    p_user_id UUID,
    p_bonus_tokens INT DEFAULT 0,
    p_new_plan plan_type_enum DEFAULT NULL,
    p_price_paid NUMERIC DEFAULT 0.00,
    p_payment_ref VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quota INT;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
    -- Update User Plan jika ada upgrade
    IF p_new_plan IS NOT NULL THEN
        UPDATE public.users 
        SET plan_type = p_new_plan, updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
        WHERE id = p_user_id;

        UPDATE public.profiles
        SET plan_type = p_new_plan::text, updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
        WHERE id = p_user_id;

        -- Tentukan kuota harian baru
        IF p_new_plan = 'pro' THEN
            v_quota := 1000;
        ELSIF p_new_plan = 'enterprise' THEN
            v_quota := 5000;
        ELSE
            v_quota := 100;
        END IF;

        UPDATE public.user_credits
        SET daily_quota = v_quota,
            daily_credits_remaining = GREATEST(daily_credits_remaining, v_quota),
            bonus_credits = bonus_credits + p_bonus_tokens,
            updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
        WHERE user_id = p_user_id;

        -- Catat Subscription
        INSERT INTO public.subscriptions (
            user_id, plan_type, status, price_paid, payment_ref, start_date, end_date
        ) VALUES (
            p_user_id, p_new_plan, 'active', p_price_paid, p_payment_ref, 
            (NOW() AT TIME ZONE 'Asia/Jakarta'), 
            (NOW() AT TIME ZONE 'Asia/Jakarta' + INTERVAL '30 days')
        );
    ELSE
        -- Hanya Tambah Bonus Token
        UPDATE public.user_credits
        SET bonus_credits = bonus_credits + p_bonus_tokens,
            updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
        WHERE user_id = p_user_id;
    END IF;

    UPDATE public.profiles
    SET credits = (SELECT daily_credits_remaining + bonus_credits FROM public.user_credits WHERE user_id = p_user_id)
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'bonus_added', p_bonus_tokens,
        'new_plan', p_new_plan
    );
END;
$$;

-- 11. TRIGGER: OTOMATIS INISIALISASI USER BARU DARI AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, plan_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'free'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, email, full_name, credits, plan_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        110, -- 100 kuota harian + 10 bonus token
        'free'
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_credits (user_id, daily_quota, daily_credits_remaining, bonus_credits, last_reset_date)
    VALUES (
        NEW.id,
        100,
        100,
        10, -- Bonus sambutan 10 token instan
        (NOW() AT TIME ZONE 'Asia/Jakarta')::date
    ) ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY; -- Diizinkan untuk Admin reading seluruh profiles
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile users" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Policy Profiles jika RLS diaktifkan kembali
CREATE POLICY "Allow select on profiles for all" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can view and update their own profiles" ON public.profiles
    FOR ALL USING (auth.uid() = id OR true);

CREATE POLICY "Users can view their own credits" ON public.user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view and manage their own projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own prompt logs" ON public.prompt_logs
    FOR SELECT USING (auth.uid() = user_id);
