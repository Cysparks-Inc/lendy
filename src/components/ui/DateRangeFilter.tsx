import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

/**
 * Date range interface for filtering data
 */
export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

/**
 * Props for the DateRangeFilter component
 */
interface DateRangeFilterProps {
  /** Callback function when date range changes */
  onDateRangeChange: (range: DateRange) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show preset date ranges (default: true) */
  showPresets?: boolean;
  /** Placeholder text for the filter button */
  placeholder?: string;
}

/**
 * Preset date ranges for quick selection
 */
const presetRanges = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last7days' },
  { label: 'Last 30 days', value: 'last30days' },
  { label: 'This week', value: 'thisWeek' },
  { label: 'Last week', value: 'lastWeek' },
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last month', value: 'lastMonth' },
  { label: 'Last 3 months', value: 'last3months' },
  { label: 'Last 6 months', value: 'last6months' },
  { label: 'This year', value: 'thisYear' },
  { label: 'Last year', value: 'lastYear' },
];

/**
 * Modern, reusable date range filter component with preset options
 * 
 * @example
 * ```tsx
 * import { DateRangeFilter, DateRange } from '@/components/ui/DateRangeFilter';
 * 
 * const MyPage = () => {
 *   const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
 *   
 *   return (
 *     <DateRangeFilter
 *       onDateRangeChange={setDateRange}
 *       placeholder="Filter by date"
 *       showPresets={true}
 *     />
 *   );
 * };
 * ```
 * 
 * @example
 * ```tsx
 * // With export integration
 * import { ExportDropdown } from '@/components/ui/ExportDropdown';
 * 
 * <ExportDropdown 
 *   data={filteredData} 
 *   columns={exportColumns} 
 *   fileName="report" 
 *   reportTitle="Report Title"
 *   dateRange={dateRange}
 * />
 * ```
 */
export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onDateRangeChange,
  className,
  showPresets = true,
  placeholder = "Select date range"
}) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  /**
   * Handle preset date range selection
   */
  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    let newRange: DateRange = { from: undefined, to: undefined };
    const now = new Date();

    switch (preset) {
      case 'today':
        newRange = { from: startOfDay(now), to: endOfDay(now) };
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        newRange = { from: startOfDay(yesterday), to: endOfDay(yesterday) };
        break;
      case 'last7days':
        newRange = { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
        break;
      case 'last30days':
        newRange = { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
        break;
      case 'thisWeek':
        newRange = { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
        break;
      case 'lastWeek':
        const lastWeekStart = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
        newRange = { from: lastWeekStart, to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }) };
        break;
      case 'thisMonth':
        newRange = { from: startOfMonth(now), to: endOfMonth(now) };
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        newRange = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
        break;
      case 'last3months':
        newRange = { from: startOfMonth(subMonths(now, 3)), to: endOfMonth(now) };
        break;
      case 'last6months':
        newRange = { from: startOfMonth(subMonths(now, 6)), to: endOfMonth(now) };
        break;
      case 'thisYear':
        newRange = { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
        break;
      case 'lastYear':
        newRange = { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59) };
        break;
    }

    setDateRange(newRange);
    onDateRangeChange(newRange);
    setIsOpen(false);
  };

  /**
   * Clear all date filters
   */
  const handleClearFilter = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedPreset('');
    onDateRangeChange({ from: undefined, to: undefined });
  };

  /**
   * Get display text for the filter button
   */
  const getDisplayText = () => {
    if (selectedPreset) {
      const preset = presetRanges.find(p => p.value === selectedPreset);
      return preset?.label || placeholder;
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
    }
    return placeholder;
  };

  const hasActiveFilter = selectedPreset || (dateRange.from && dateRange.to);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal min-w-[180px]",
              !dateRange.from && "text-muted-foreground",
              hasActiveFilter && "border-brand-green-300 bg-brand-green-50"
            )}
          >
            <Filter className="mr-2 h-4 w-4" />
            <span className="truncate">{getDisplayText()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 z-[100] max-h-[80vh] overflow-hidden" 
          align="center"
          side="bottom"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={20}
        >
          <div className="p-6 space-y-4 max-w-[500px]">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">Select Date Range</h3>
              <p className="text-sm text-muted-foreground">Choose from quick presets or pick custom dates</p>
            </div>
            
            {showPresets && (
              <div className="space-y-4">
                <Label className="text-sm font-medium text-foreground text-center block">Quick Select</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-2">
                  {presetRanges.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={selectedPreset === preset.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePresetSelect(preset.value)}
                      className="text-xs h-10 px-3 transition-all duration-200 hover:scale-105"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Click any preset above to apply the filter
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilter}
          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
          title="Clear date filter"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

/**
 * Utility function to filter data by date range
 * 
 * @param data - Array of data items to filter
 * @param dateRange - Date range to filter by
 * @param dateField - Field name containing the date to filter on
 * @returns Filtered array of data items
 * 
 * @example
 * ```tsx
 * import { filterDataByDateRange } from '@/components/ui/DateRangeFilter';
 * 
 * const filteredData = filterDataByDateRange(
 *   allData, 
 *   dateRange, 
 *   'created_at'
 * );
 * ```
 */
export const filterDataByDateRange = <T extends Record<string, any>>(
  data: T[],
  dateRange: DateRange,
  dateField: keyof T
): T[] => {
  if (!dateRange.from || !dateRange.to) return data;

  return data.filter(item => {
    const itemDate = parseISO(String(item[dateField]));
    return isWithinInterval(itemDate, { start: dateRange.from!, end: dateRange.to! });
  });
};
