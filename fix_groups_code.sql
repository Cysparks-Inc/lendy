-- Fix groups table to auto-generate code if not provided
-- Create trigger function similar to branches

CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TRIGGER AS $$
DECLARE
  base_code TEXT;
  unique_suffix TEXT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    -- Generate base code from name
    base_code := UPPER(SUBSTRING(REPLACE(NEW.name, ' ', '_'), 1, 10));
    
    -- Make sure it's unique
    LOOP
      unique_suffix := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
      NEW.code := base_code || '_' || unique_suffix;
      
      EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE code = NEW.code AND (TG_OP = 'UPDATE' OR id != NEW.id));
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_group_code ON groups;
CREATE TRIGGER trigger_generate_group_code
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION generate_group_code();

-- Grant permissions
GRANT ALL ON groups TO authenticated;

-- Done!
