# Pett Vision - Migration Checklist

## ✅ What's Been Completed

### 1. Branding Updates ✅
- [x] Changed primary color from green (#16a34a) to dark blue (#1d4ed8)
- [x] Updated all CSS variables for light and dark mode
- [x] Updated Tailwind config with brand blue colors
- [x] Updated all gradient references
- [x] Updated shadow colors to match blue theme

### 2. Company Name Updates ✅
- [x] Updated README and app to "Pett Vision"
- [x] Updated all references in PDF generation (utils/pdfGenerator.ts)
- [x] Updated transaction details PDF header
- [x] Updated auth page branding
- [x] Updated loader component
- [x] Updated export dropdown branding
- [x] Updated member statement generation
- [x] Updated sidebar and app layout
- [x] Updated footer copyright

### 3. Visual Changes ✅
- [x] Loader background changed to brand-blue
- [x] App header gradient changed to blue
- [x] Sidebar header gradient changed to blue
- [x] Auth page gradient changed to blue
- [x] All brand references updated to use dark blue

## 🔄 What Needs to Be Done

### 1. Environment Configuration ⚠️
**Action Required:** Update Supabase connection details

Files to update:
- `src/integrations/supabase/client.ts`
- `supabase/config.toml`

**Your new Supabase project details:**
- URL: [To be provided]
- Anon Key: [To be provided]
- Project ID: [To be provided]

### 2. Database Setup ⚠️
**Action Required:** Apply all SQL migrations to new Supabase project

Total migrations to apply: **92 files**

See `SUPABASE_SETUP_GUIDE.md` for detailed instructions.

**Critical migrations to apply first:**
1. `20250819181135_db4d2ed6-7b78-4c63-bae4-c4035f0f2496.sql`
2. `20250820103531_3dbae4a0-6d86-4fb0-afde-aaa13f78e5a7.sql`
3. Continue with all others in chronological order

### 3. Edge Functions Deployment ⚠️
**Action Required:** Deploy 5 edge functions to new Supabase

Functions to deploy:
- [ ] `create-user`
- [ ] `delete-user`
- [ ] `reset-user-password`
- [ ] `disable-user-mfa`
- [ ] `create-loan-officer`

**Location:** `supabase/functions/[function-name]/index.ts`

### 4. Storage Setup ⚠️
**Action Required:** Create storage buckets in Supabase

Buckets to create:
- [ ] `member-avatars` (public, for profile pictures)

**SQL to run:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true);
```

### 5. Logo Replacement ⚠️
**Action Required:** Replace logo files

Files in `public/lovable-uploads/`:
- [ ] Replace `logo-napol.png` with Pett Vision logo
- [ ] Replace main logo file

**Note:** Currently the old logo is still referenced. Update these paths once you have the new logo.

### 6. Initial Data Setup ⚠️
**Action Required:** Create initial records in database

Run these in Supabase SQL Editor after migrations:

```sql
-- Create first branch
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Main Branch', 'MB-001', 'Your City', true);

-- Create organization
INSERT INTO public.organizations (name, code)
VALUES ('Pett Vision', 'PV-001');

-- Create penalty policy
INSERT INTO public.penalty_policies (name, penalty_type, rate_per_day)
VALUES ('Standard Late Fee', 'percentage', 0.0005);

-- Create loan products
INSERT INTO public.loan_products (name, min_amount, max_amount, interest_rate, min_term_months, max_term_months)
VALUES 
  ('Agricultural Loan', 5000, 100000, 0.02, 6, 24),
  ('Business Loan', 10000, 500000, 0.025, 12, 60),
  ('Emergency Loan', 1000, 25000, 0.035, 3, 12);
```

### 7. Testing Checklist ⚠️
**Action Required:** Test all major features after setup

- [ ] User authentication works
- [ ] Dashboard displays correctly with blue theme
- [ ] Can create a member
- [ ] Can create a loan
- [ ] Can receive payments
- [ ] Reports generate correctly
- [ ] PDF exports have correct branding
- [ ] CSV exports work
- [ ] All role-based access works correctly

## 📝 Quick Start Commands

### To start development:
```bash
npm install
npm run dev
```

### To build for production:
```bash
npm run build
```

### To link to Supabase project (if using CLI):
```bash
supabase link --project-ref your_project_ref
supabase db push
```

## 🎨 Color Reference

**Old Theme (Green):**
- Primary: #16a34a
- Hover: #22c55e

**New Theme (Dark Blue):**
- Primary: #1d4ed8  
- Hover: #2563eb
- Lighter shades available: #3b82f6, #60a5fa, #93c5fd

## ⚠️ Important Notes

1. **Backup your database** before making any changes
2. **Test in development environment first**
3. **Keep service role key secret** - never commit it to Git
4. **Apply migrations in order** - some depend on previous ones
5. **Update environment variables** before running the app

## 🆘 Need Help?

- Check `SUPABASE_SETUP_GUIDE.md` for detailed setup instructions
- Review Supabase dashboard for any errors
- Check browser console for frontend errors
- Review Supabase logs for backend errors

