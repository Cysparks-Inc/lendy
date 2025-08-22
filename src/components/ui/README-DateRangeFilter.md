# 📅 DateRangeFilter Component - Implementation Guide

## Overview

The `DateRangeFilter` component is a modern, reusable date filtering solution that provides preset date ranges in a clean, centered interface. It integrates seamlessly with the existing export functionality to allow users to filter data by date and export the filtered results.

## ✨ Features

- **12 Preset Date Ranges**: Today, yesterday, last 7/30 days, this/last week/month, etc.
- **Centered Design**: Popover appears centered for better user experience
- **Scroll Functionality**: Automatically scrolls when content doesn't fit the screen
- **Smart Filtering**: Automatically filters data based on selected date range
- **Export Integration**: Works with ExportDropdown to include date range in exports
- **Responsive Design**: Mobile-friendly with proper stacking
- **Visual Feedback**: Shows active filter state and clear button
- **Accessibility**: Proper labels and keyboard navigation

## 🚀 Quick Start

### 1. Import the Component

```tsx
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';
```

### 2. Add State

```tsx
const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
```

### 3. Add the Component

```tsx
<DateRangeFilter
  onDateRangeChange={setDateRange}
  placeholder="Filter by date"
  className="w-full sm:w-auto"
/>
```

### 4. Apply Filtering

```tsx
// Apply date filtering to your data
const dateFilteredData = filterDataByDateRange(filteredData, dateRange, 'created_at');
```

### 5. Update Export

```tsx
<ExportDropdown 
  data={dateFilteredData} 
  columns={exportColumns} 
  fileName="report" 
  reportTitle="Report Title"
  dateRange={dateRange}
/>
```

## 📋 Complete Example

```tsx
import React, { useState } from 'react';
import { DateRangeFilter, DateRange, filterDataByDateRange } from '@/components/ui/DateRangeFilter';
import { ExportDropdown } from '@/components/ui/ExportDropdown';

interface MyDataItem {
  id: string;
  name: string;
  created_at: string;
  amount: number;
}

const MyPage: React.FC = () => {
  const [data, setData] = useState<MyDataItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // Filter by search term first
  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Then apply date filtering
  const dateFilteredData = filterDataByDateRange(filteredData, dateRange, 'created_at');

  // Export columns configuration
  const exportColumns = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Created Date', accessorKey: 'created_at' },
    { header: 'Amount', accessorKey: 'amount' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <h1>My Data</h1>
        <ExportDropdown 
          data={dateFilteredData} 
          columns={exportColumns} 
          fileName="my-data-report" 
          reportTitle="My Data Report"
          dateRange={dateRange}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <DateRangeFilter
          onDateRangeChange={setDateRange}
          placeholder="Filter by date"
          className="w-full sm:w-auto"
        />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {/* Data Display */}
      <div>
        <p>Showing {dateFilteredData.length} of {filteredData.length} items</p>
        {/* Your data table or list here */}
      </div>
    </div>
  );
};
```

## 🔧 Configuration Options

### DateRangeFilter Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onDateRangeChange` | `(range: DateRange) => void` | Required | Callback when date range changes |
| `className` | `string` | `undefined` | Additional CSS classes |
| `showPresets` | `boolean` | `true` | Show preset date range buttons |
| `placeholder` | `string` | `"Select date range"` | Button placeholder text |

### Preset Date Ranges

The component includes these preset options:

- **Today** - Current day only
- **Yesterday** - Previous day only
- **Last 7 days** - Rolling 7-day window
- **Last 30 days** - Rolling 30-day window
- **This week** - Current week (Monday-Sunday)
- **Last week** - Previous week
- **This month** - Current month
- **Last month** - Previous month
- **Last 3 months** - Rolling 3-month window
- **Last 6 months** - Rolling 6-month window
- **This year** - Current year
- **Last year** - Previous year

## 🎨 UI/UX Improvements

### **Centered Design**
- Popover appears centered below the trigger button
- Better visual balance and user experience
- Consistent positioning across different screen sizes

### **Scroll Functionality**
- Maximum height of 80% viewport height
- Automatic scrolling when content exceeds available space
- Smooth scroll behavior with proper padding

### **Clean Interface**
- Removed complex custom date picker
- Focus on quick preset selection
- Clear instructions and visual hierarchy

### **Enhanced Buttons**
- Larger touch targets (h-10 instead of h-8)
- Hover effects with scale animation
- Better spacing and padding

## 📊 Export Integration

When you pass the `dateRange` to `ExportDropdown`, it automatically:

1. **Updates filename**: Adds date range to exported file names
2. **Updates report title**: Includes date range in PDF/CSV headers
3. **Shows date info**: Displays current filter in the export button
4. **Filters export data**: Only exports data within the selected date range

### Export Button Display

The export button shows the current date range:
- **No filter**: "Export Data"
- **With filter**: "Export Data (Dec 01 - Dec 31)"

### File Naming

Exported files include the date range:
- **PDF**: `report-2024-12-01-to-2024-12-31.pdf`
- **CSV**: `report-2024-12-01-to-2024-12-31.csv`

## 🎨 Styling

The component uses Tailwind CSS and includes:

- **Active state**: Green border and background when filter is active
- **Hover effects**: Smooth transitions and hover states
- **Responsive design**: Stacks vertically on mobile
- **Brand colors**: Uses your project's green color scheme
- **Centered layout**: Professional, centered appearance

## 🔍 Data Filtering

### filterDataByDateRange Function

```tsx
const filteredData = filterDataByDateRange(
  allData,           // Your data array
  dateRange,         // Selected date range
  'created_at'       // Date field name in your data
);
```

### Supported Date Formats

The function works with ISO date strings:
- `"2024-12-01T10:00:00Z"`
- `"2024-12-01"`
- `"2024-12-01 10:00:00"`

### Date Field Mapping

Common date field names:
- `created_at` - Record creation date
- `updated_at` - Last update date
- `due_date` - Due date for loans
- `payment_date` - Payment date
- `start_date` - Start date
- `end_date` - End date

## 📱 Mobile Responsiveness

The component automatically adapts to mobile:

- **Button stacking**: Filters stack vertically on small screens
- **Full width**: Takes full width on mobile for better touch targets
- **Touch friendly**: Proper spacing for touch interactions
- **Scroll support**: Handles overflow gracefully on small screens

## 🚨 Common Issues & Solutions

### Issue: Date filtering not working

**Solution**: Check that your date field contains valid ISO date strings:
```tsx
// ✅ Good
"2024-12-01T10:00:00Z"

// ❌ Bad
"2024-12-01 10:00:00"
"12/01/2024"
```

### Issue: Export shows wrong data

**Solution**: Make sure you're passing the filtered data:
```tsx
// ✅ Correct
<ExportDropdown data={dateFilteredData} ... />

// ❌ Wrong
<ExportDropdown data={allData} ... />
```

### Issue: Date picker not opening

**Solution**: Check that you have the required dependencies:
```json
{
  "dependencies": {
    "date-fns": "^3.0.0",
    "@radix-ui/react-popover": "^1.0.0"
  }
}
```

## 🔄 Real-time Updates

For real-time data updates, the component works seamlessly with:

- **Supabase subscriptions**: Real-time data changes
- **React Query**: Automatic refetching
- **SWR**: Data synchronization
- **Custom hooks**: Any data fetching pattern

## 📈 Performance Tips

1. **Debounce filtering**: For large datasets, consider debouncing the date change
2. **Memoize filtered data**: Use `useMemo` for expensive filtering operations
3. **Virtual scrolling**: For very large datasets, consider virtual scrolling
4. **Lazy loading**: Load data only when date range is selected

## 🤝 Contributing

To extend the component:

1. **Add new presets**: Modify the `presetRanges` array
2. **Custom date logic**: Extend the `handlePresetSelect` function
3. **Additional filters**: Add more filter types alongside date filtering
4. **Custom styling**: Override with custom CSS classes

## 📚 Related Components

- **ExportDropdown**: For exporting filtered data
- **DataTable**: For displaying filtered data
- **Popover**: For the dropdown interface

---

**Happy filtering! 🎉**
