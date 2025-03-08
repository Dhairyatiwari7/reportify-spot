
-- Function to increment hazard_report votes
CREATE OR REPLACE FUNCTION increment_hazard_votes(hazard_id UUID) 
RETURNS void AS $$
BEGIN
  UPDATE hazard_reports 
  SET votes = votes + 1
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement hazard_report votes
CREATE OR REPLACE FUNCTION decrement_hazard_votes(hazard_id UUID) 
RETURNS void AS $$
BEGIN
  UPDATE hazard_reports 
  SET votes = GREATEST(votes - 1, 0)  -- Ensure votes never go below 0
  WHERE id = hazard_id;
END;
$$ LANGUAGE plpgsql;

-- Create a hazard_votes table if it doesn't exist
CREATE TABLE IF NOT EXISTS hazard_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hazard_id UUID REFERENCES hazard_reports(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hazard_id, user_id)
);

-- Add RLS policies for hazard_votes
ALTER TABLE hazard_votes ENABLE ROW LEVEL SECURITY;

-- Policy for inserting votes (must be authenticated)
CREATE POLICY "Users can insert their own votes" 
ON hazard_votes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Policy for viewing votes (can see all votes)
CREATE POLICY "Anyone can view votes" 
ON hazard_votes FOR SELECT 
TO authenticated 
USING (true);

-- Policy for deleting votes (can only delete own votes)
CREATE POLICY "Users can delete their own votes" 
ON hazard_votes FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
