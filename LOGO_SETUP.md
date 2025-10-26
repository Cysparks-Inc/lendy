# Logo Setup Instructions

## Current Logo Path

The system is now looking for your logo at:
- **Path**: `/public/lovable-uploads/lendy-logo.png`

## How to Add Your New Logo

1. **Save your logo file** with the name `lendy-logo.png`
2. **Place it in**: `public/lovable-uploads/lendy-logo.png`
3. The system will automatically use it

## Alternative: Use Placeholder

Until you upload the logo, you can:
1. Keep the old logo temporarily at the new path
2. Or use a placeholder image

## Logo Specifications

**Recommended Size**: 512x512 pixels (square)
**Format**: PNG with transparent background
**Style**: Your blue circular logo with Euro symbol and upward arrow

## Where Logo is Used

- ✅ Login page (`src/pages/Auth.tsx`)
- ✅ App header (`src/components/AppLayout.tsx`)
- ✅ Sidebar (`src/components/AppSidebar.tsx`)
- ✅ Loading screen (`src/components/ui/loader.tsx`)

All have been updated to use: `/lovable-uploads/lendy-logo.png`

