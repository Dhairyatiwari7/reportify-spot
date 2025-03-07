
-- Create the storage bucket for hazard images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hazard-images', 'hazard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create the profiles table to store user profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  tokens INTEGER DEFAULT 0 NOT NULL
);

-- Create the hazard_reports table to store hazard information
CREATE TABLE IF NOT EXISTS public.hazard_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('pothole', 'waterlogging', 'other')),
  description TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  reported_by UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved')),
  votes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  token_reward INTEGER DEFAULT 0
);

-- Create the hazard_votes table to track user votes on hazards
CREATE TABLE IF NOT EXISTS public.hazard_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hazard_id UUID REFERENCES public.hazard_reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(hazard_id, user_id)
);

-- Create the hazard_comments table to store user comments on hazards
CREATE TABLE IF NOT EXISTS public.hazard_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hazard_id UUID REFERENCES public.hazard_reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL
);

-- Create store items table
CREATE TABLE IF NOT EXISTS public.store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  token_cost INTEGER NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT true
);

-- Create user_rewards table to track redemptions
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.store_items(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  redemption_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create functions to handle vote counts
CREATE OR REPLACE FUNCTION increment_hazard_votes(hazard_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hazard_reports
  SET votes = votes + 1
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_hazard_votes(hazard_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hazard_reports
  SET votes = GREATEST(0, votes - 1)
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

-- Create functions to handle comment counts
CREATE OR REPLACE FUNCTION increment_hazard_comments(hazard_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hazard_reports
  SET comments = comments + 1
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_hazard_comments(hazard_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hazard_reports
  SET comments = GREATEST(0, comments - 1)
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to award tokens to users when their hazard report is created
CREATE OR REPLACE FUNCTION award_report_tokens()
RETURNS TRIGGER AS $$
DECLARE
  token_amount INTEGER := 10; -- Default token reward for reporting
BEGIN
  -- Set the token reward on the report
  NEW.token_reward := token_amount;
  
  -- Add tokens to the user's profile
  UPDATE public.profiles
  SET tokens = tokens + token_amount
  WHERE id = NEW.reported_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has enough tokens for redemption
CREATE OR REPLACE FUNCTION check_token_balance() 
RETURNS TRIGGER AS $$
DECLARE
  token_cost INTEGER;
  user_tokens INTEGER;
BEGIN
  -- Get the cost of the item
  SELECT token_cost INTO token_cost FROM public.store_items WHERE id = NEW.item_id;
  
  -- Get the user's token balance
  SELECT tokens INTO user_tokens FROM public.profiles WHERE id = NEW.user_id;
  
  -- Check if user has enough tokens
  IF user_tokens < token_cost THEN
    RAISE EXCEPTION 'Insufficient tokens to redeem this item';
  END IF;
  
  -- Deduct tokens from user
  UPDATE public.profiles
  SET tokens = tokens - token_cost
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update counts
CREATE OR REPLACE TRIGGER on_comment_added
AFTER INSERT ON public.hazard_comments
FOR EACH ROW
EXECUTE FUNCTION increment_hazard_comments(NEW.hazard_id);

CREATE OR REPLACE TRIGGER on_comment_deleted
AFTER DELETE ON public.hazard_comments
FOR EACH ROW
EXECUTE FUNCTION decrement_hazard_comments(OLD.hazard_id);

-- Create trigger to award tokens on report creation
CREATE OR REPLACE TRIGGER on_hazard_report_created
BEFORE INSERT ON public.hazard_reports
FOR EACH ROW
EXECUTE FUNCTION award_report_tokens();

-- Create trigger to check token balance on redemption
CREATE OR REPLACE TRIGGER on_reward_redemption
BEFORE INSERT ON public.user_rewards
FOR EACH ROW
EXECUTE FUNCTION check_token_balance();

-- Set up Row Level Security policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Hazard report policies
CREATE POLICY "Hazard reports are viewable by everyone"
  ON public.hazard_reports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create hazard reports"
  ON public.hazard_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own hazard reports"
  ON public.hazard_reports FOR UPDATE
  USING (auth.uid() = reported_by);

CREATE POLICY "Admins can update any hazard report"
  ON public.hazard_reports FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- Hazard votes policies
CREATE POLICY "Hazard votes are viewable by everyone"
  ON public.hazard_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add votes"
  ON public.hazard_votes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own votes"
  ON public.hazard_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Hazard comments policies
CREATE POLICY "Hazard comments are viewable by everyone"
  ON public.hazard_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add comments"
  ON public.hazard_comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments"
  ON public.hazard_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.hazard_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Store items policies
CREATE POLICY "Store items are viewable by everyone"
  ON public.store_items FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage store items"
  ON public.store_items FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

CREATE POLICY "Only admins can update store items"
  ON public.store_items FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

CREATE POLICY "Only admins can delete store items"
  ON public.store_items FOR DELETE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- User rewards policies
CREATE POLICY "Users can view their own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

CREATE POLICY "Users can redeem rewards"
  ON public.user_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update reward status"
  ON public.user_rewards FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = true));

-- Create a function to create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add is_admin column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
