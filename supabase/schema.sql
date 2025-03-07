
-- Add increment and decrement functions
CREATE OR REPLACE FUNCTION increment(x int)
RETURNS int AS $$
BEGIN
  RETURN x + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement(x int)
RETURNS int AS $$
BEGIN
  RETURN GREATEST(0, x - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create profiles table with tokens and admin fields
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create hazard reports table with token reward
CREATE TABLE IF NOT EXISTS public.hazard_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  description TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  reported_by UUID REFERENCES public.profiles(id),
  image_url TEXT,
  votes INTEGER DEFAULT 0,
  token_reward INTEGER DEFAULT 10, 
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create hazard votes table
CREATE TABLE IF NOT EXISTS public.hazard_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES public.hazard_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(report_id, user_id)
);

-- Create store items table
CREATE TABLE IF NOT EXISTS public.store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  token_cost INTEGER NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create user rewards table
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.store_items(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add token increment trigger for new hazard reports
CREATE OR REPLACE FUNCTION add_tokens_for_report()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET tokens = tokens + NEW.token_reward
  WHERE id = NEW.reported_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_hazard_report_created
  AFTER INSERT ON public.hazard_reports
  FOR EACH ROW
  EXECUTE FUNCTION add_tokens_for_report();

-- Add token decrement trigger for reward redemption
CREATE OR REPLACE FUNCTION subtract_tokens_for_reward()
RETURNS TRIGGER AS $$
DECLARE
  item_cost INTEGER;
BEGIN
  -- Get the cost of the item
  SELECT token_cost INTO item_cost FROM store_items WHERE id = NEW.item_id;
  
  -- Subtract tokens from user's balance
  UPDATE profiles
  SET tokens = tokens - item_cost
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_reward_created
  AFTER INSERT ON public.user_rewards
  FOR EACH ROW
  EXECUTE FUNCTION subtract_tokens_for_reward();

-- Set up Row Level Security (RLS)
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Hazard reports policies
CREATE POLICY "Hazard reports are viewable by everyone"
  ON public.hazard_reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create hazard reports"
  ON public.hazard_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can update their own hazard reports"
  ON public.hazard_reports FOR UPDATE
  USING (auth.uid() = reported_by OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Hazard votes policies
CREATE POLICY "Votes are viewable by everyone"
  ON public.hazard_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create votes"
  ON public.hazard_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.hazard_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Store items policies
CREATE POLICY "Store items are viewable by everyone"
  ON public.store_items FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage store items"
  ON public.store_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- User rewards policies
CREATE POLICY "Users can view their own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Authenticated users can create rewards"
  ON public.user_rewards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update reward status"
  ON public.user_rewards FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Initial admin user function (run this manually for your user)
CREATE OR REPLACE FUNCTION set_user_as_admin(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET is_admin = TRUE
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has enough tokens for a reward
CREATE OR REPLACE FUNCTION can_redeem_reward(user_id UUID, item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tokens INTEGER;
  item_cost INTEGER;
BEGIN
  -- Get user's current token balance
  SELECT tokens INTO user_tokens FROM profiles WHERE id = user_id;
  
  -- Get the cost of the item
  SELECT token_cost INTO item_cost FROM store_items WHERE id = item_id;
  
  -- Check if user has enough tokens
  RETURN user_tokens >= item_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
