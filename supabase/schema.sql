
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
