
-- Create tables for users, hazard reports, and rewards

-- Profiles table with tokens and admin status
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  full_name TEXT,
  avatar_url TEXT,
  tokens INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE
);

-- Store items table
CREATE TABLE IF NOT EXISTS public.store_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  name TEXT NOT NULL,
  description TEXT,
  token_cost INTEGER NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE
);

-- User rewards table for token redemption
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.store_items(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  redemption_date TIMESTAMP WITH TIME ZONE
);

-- Hazard reports table
CREATE TABLE IF NOT EXISTS public.hazard_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  type TEXT CHECK (type IN ('pothole', 'waterlogging', 'other')),
  description TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved')),
  votes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  image_url TEXT,
  token_reward INTEGER DEFAULT 10
);

-- Hazard votes table
CREATE TABLE IF NOT EXISTS public.hazard_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  hazard_id UUID REFERENCES public.hazard_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(hazard_id, user_id)
);

-- Hazard comments table
CREATE TABLE IF NOT EXISTS public.hazard_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  hazard_id UUID REFERENCES public.hazard_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- Trigger to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, tokens, is_admin)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    0,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update the votes count on a hazard report
CREATE OR REPLACE FUNCTION public.update_hazard_votes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.hazard_reports
    SET votes = votes + 1
    WHERE id = NEW.hazard_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.hazard_reports
    SET votes = votes - 1
    WHERE id = OLD.hazard_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the votes count trigger
DROP TRIGGER IF EXISTS on_hazard_vote_change ON public.hazard_votes;
CREATE TRIGGER on_hazard_vote_change
  AFTER INSERT OR DELETE ON public.hazard_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_hazard_votes_count();

-- Trigger to update the comments count on a hazard report
CREATE OR REPLACE FUNCTION public.update_hazard_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.hazard_reports
    SET comments = comments + 1
    WHERE id = NEW.hazard_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.hazard_reports
    SET comments = comments - 1
    WHERE id = OLD.hazard_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the comments count trigger
DROP TRIGGER IF EXISTS on_hazard_comment_change ON public.hazard_comments;
CREATE TRIGGER on_hazard_comment_change
  AFTER INSERT OR DELETE ON public.hazard_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_hazard_comments_count();

-- Function to award tokens on hazard report creation
CREATE OR REPLACE FUNCTION public.award_tokens_for_hazard_report()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = tokens + NEW.token_reward
  WHERE id = NEW.reported_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the award tokens trigger
DROP TRIGGER IF EXISTS on_hazard_report_created ON public.hazard_reports;
CREATE TRIGGER on_hazard_report_created
  AFTER INSERT ON public.hazard_reports
  FOR EACH ROW EXECUTE FUNCTION public.award_tokens_for_hazard_report();

-- Function to redeem an item (atomic operation to avoid race conditions)
CREATE OR REPLACE FUNCTION public.redeem_item(
  p_user_id UUID,
  p_item_id UUID,
  p_token_cost INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_tokens INTEGER;
BEGIN
  -- First get the current tokens
  SELECT tokens INTO v_current_tokens
  FROM profiles
  WHERE id = p_user_id;
  
  -- Check if user has enough tokens
  IF v_current_tokens < p_token_cost THEN
    RAISE EXCEPTION 'User does not have enough tokens';
  END IF;
  
  -- Deduct tokens
  UPDATE profiles
  SET tokens = tokens - p_token_cost
  WHERE id = p_user_id;
  
  -- Create reward record
  INSERT INTO user_rewards (user_id, item_id, status)
  VALUES (p_user_id, p_item_id, 'pending');
  
  RETURN TRUE;
END;
$$;

-- RLS Policies

-- Profiles table policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Hazard reports policies
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hazard reports are viewable by everyone"
  ON public.hazard_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own hazard reports"
  ON public.hazard_reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can update their own hazard reports"
  ON public.hazard_reports FOR UPDATE
  USING (auth.uid() = reported_by OR 
        (SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- Store items policies
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store items are viewable by everyone"
  ON public.store_items FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify store items"
  ON public.store_items FOR INSERT
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Only admins can update store items"
  ON public.store_items FOR UPDATE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- User rewards policies
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id OR 
        (SELECT is_admin FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own rewards"
  ON public.user_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only admins can update reward status"
  ON public.user_rewards FOR UPDATE
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- Hazard votes policies
ALTER TABLE public.hazard_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hazard votes are viewable by everyone"
  ON public.hazard_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own votes"
  ON public.hazard_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.hazard_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Hazard comments policies
ALTER TABLE public.hazard_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hazard comments are viewable by everyone"
  ON public.hazard_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON public.hazard_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.hazard_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.hazard_comments FOR DELETE
  USING (auth.uid() = user_id OR 
        (SELECT is_admin FROM profiles WHERE id = auth.uid()));
