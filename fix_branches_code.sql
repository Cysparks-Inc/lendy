-- Fix branches table to make code optional or auto-generate it
-- Option 1: Make code nullable
ALTER TABLE branches ALTER COLUMN code DROP NOT NULL;

-- Option 2: Add a default value that auto-generates
-- This generates a code based on the branch name
CREATE OR REPLACE FUNCTION generate_branch_code()
RETURNS TRIGGER AS $$
DECLARE
  base_code TEXT;
  unique_suffix TEXT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    -- Generate base code from name: "Nairobi Central" -> "NAIR_CENT"
    base_code := UPPER(SUBSTRING(REPLACE(NEW.name, ' ', '_'), 1, 15));
    
    -- Make sure it's unique by adding a random suffix
    LOOP
      unique_suffix := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
      NEW.code := base_code || '_' || unique_suffix;
      
      -- Exit if unique
      EXIT WHEN NOT EXISTS (SELECT 1 FROM branches WHERE code = NEW.code AND (TG_OP = 'UPDATE' OR id != NEW.id));
    END LOOP;
  ELSE
    -- If code is provided, ensure it's unique
    IF EXISTS (SELECT 1 FROM branches WHERE code = NEW.code AND (TG_OP = 'UPDATE' OR id != NEW.id)) THEN
      base_code := SUBSTRING(NEW.code, 1, 15);
      LOOP
        unique_suffix := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
        NEW.code := base_code || '_' || unique_suffix;
        
        EXIT WHEN NOT EXISTS (SELECT 1 FROM branches WHERE code = NEW.code AND (TG_OP = 'UPDATE' OR id != NEW.id));
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate code
DROP TRIGGER IF EXISTS trigger_generate_branch_code ON branches;
CREATE TRIGGER trigger_generate_branch_code
  BEFORE INSERT OR UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION generate_branch_code();

-- Update any existing branches that don't have a code
UPDATE branches 
SET code = UPPER(SUBSTRING(REPLACE(name, ' ', '_'), 1, 20)) || '_' || id::TEXT
WHERE code IS NULL OR code = '';

-- Done!
