-- Supabase 무료 플랜 자동 일시정지 방지용 테이블
--
-- 배경: anon 키로 보내는 읽기 핑은 RLS에 막혀 0건을 반환하므로
-- Supabase가 "sufficient activity"로 집계하지 않는다.
-- 3일마다 이 테이블에 실제 쓰기를 발생시켜 확실한 DB 활동을 남긴다.
--
-- Supabase 대시보드 → SQL Editor 에서 한 번만 실행하면 된다.

CREATE TABLE IF NOT EXISTS public.keepalive (
  id INT PRIMARY KEY DEFAULT 1,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  CONSTRAINT keepalive_single_row CHECK (id = 1)
);

-- 최초 1행 생성
INSERT INTO public.keepalive (id, pinged_at, note)
VALUES (1, now(), 'initial')
ON CONFLICT (id) DO NOTHING;

-- RLS 활성화. 정책을 만들지 않으므로 anon/authenticated는 접근 불가하고,
-- service_role 키만 읽고 쓸 수 있다. (service_role은 RLS를 우회한다)
ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;
