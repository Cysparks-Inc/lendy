import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportDropdownProps<T> {
  data: T[];
  columns: { header: string; accessorKey: keyof T | ((row: T) => any) }[];
  fileName: string;
  reportTitle: string;
}

export const ExportDropdown = <T,>({ data, columns, fileName, reportTitle }: ExportDropdownProps<T>) => {

  const generatePdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 22);
    
    const head = [columns.map(c => c.header)];
    const body = data.map(row => columns.map(col => {
      if (typeof col.accessorKey === 'function') {
        return col.accessorKey(row);
      }
      return row[col.accessorKey as keyof T] as string;
    }));

    autoTable(doc, {
      startY: 30,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39] }
    });
    doc.save(`${fileName}.pdf`);
  };

  const generateCsv = () => {
    const escapeCsvCell = (cell: any) => `"${String(cell).replace(/"/g, '""')}"`;
    const headers = columns.map(c => c.header).join(',');
    const rows = data.map(row => columns.map(col => {
      if (typeof col.accessorKey === 'function') {
        return escapeCsvCell(col.accessorKey(row));
      }
      return escapeCsvCell(row[col.accessorKey as keyof T]);
    }).join(','));

    const csvString = `${headers}\n${rows.join('\n')}`;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Export Data</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={generatePdf}><FileText className="mr-2 h-4 w-4" />Export as PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={generateCsv}><FileSpreadsheet className="mr-2 h-4 w-4" />Export as CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};