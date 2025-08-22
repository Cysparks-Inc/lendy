import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from './DateRangeFilter';

interface ExportDropdownProps<T> {
  data: T[];
  columns: { header: string; accessorKey: keyof T | ((row: T) => any) }[];
  fileName: string;
  reportTitle: string;
  dateRange?: DateRange;
  showDateInTitle?: boolean;
}

export const ExportDropdown = <T,>({ 
  data, 
  columns, 
  fileName, 
  reportTitle, 
  dateRange,
  showDateInTitle = true
}: ExportDropdownProps<T>) => {

  const getFormattedFileName = () => {
    if (!dateRange?.from || !dateRange?.to) return fileName;
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');
    return `${fileName}-${fromDate}-to-${toDate}`;
  };

  const getFormattedReportTitle = () => {
    if (!dateRange?.from || !dateRange?.to || !showDateInTitle) return reportTitle;
    const fromDate = format(dateRange.from, 'MMM dd, yyyy');
    const toDate = format(dateRange.to, 'MMM dd, yyyy');
    return `${reportTitle} (${fromDate} - ${toDate})`;
  };

  const generatePdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(getFormattedReportTitle(), 14, 22);
    
    // Add date range info if available
    if (dateRange?.from && dateRange?.to) {
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      const dateInfo = `Date Range: ${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
      doc.text(dateInfo, 14, 32);
      doc.setTextColor(0, 0, 0);
    }
    
    const head = [columns.map(c => c.header)];
    const body = data.map(row => columns.map(col => {
      if (typeof col.accessorKey === 'function') {
        return col.accessorKey(row);
      }
      return row[col.accessorKey as keyof T] as string;
    }));

    autoTable(doc, {
      startY: dateRange?.from && dateRange?.to ? 40 : 30,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39] }
    });
    doc.save(`${getFormattedFileName()}.pdf`);
  };

  const generateCsv = () => {
    const escapeCsvCell = (cell: any) => `"${String(cell).replace(/"/g, '""')}"`;
    
    // Add date range info as first row if available
    let csvRows: string[] = [];
    
    if (dateRange?.from && dateRange?.to) {
      const dateInfo = `Date Range,${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
      csvRows.push(dateInfo);
      csvRows.push(''); // Empty row for spacing
    }
    
    const headers = columns.map(c => c.header).join(',');
    const dataRows = data.map(row => columns.map(col => {
      if (typeof col.accessorKey === 'function') {
        return escapeCsvCell(col.accessorKey(row));
      }
      return escapeCsvCell(row[col.accessorKey as keyof T]);
    }).join(','));

    csvRows.push(headers);
    csvRows.push(...dataRows);

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getFormattedFileName()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> 
          Export Data
          {dateRange?.from && dateRange?.to && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')})
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={generatePdf}>
          <FileText className="mr-2 h-4 w-4" />Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateCsv}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};