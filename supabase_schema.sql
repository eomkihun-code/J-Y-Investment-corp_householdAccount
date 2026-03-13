-- 거래 내역 테이블
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  memo TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 예상 고정 비용 테이블
CREATE TABLE fixed_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT,
  auto_transfer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 설정
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

-- 정책 설정 (본인 데이터만 조회/수정 가능)
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own fixed_costs" ON fixed_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fixed_costs" ON fixed_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fixed_costs" ON fixed_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fixed_costs" ON fixed_costs FOR DELETE USING (auth.uid() = user_id);
