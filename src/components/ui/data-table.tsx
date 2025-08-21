import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Using generics to make the component truly reusable
interface DataTableProps<TData> {
  columns: {
    header: string;
    cell: (row: TData) => React.ReactNode;
  }[];
  data: TData[];
  emptyStateMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  emptyStateMessage = "No results found."
}: DataTableProps<TData>) {
  return (
    // --- THE CRITICAL FIX IS HERE ---
    // This wrapper div makes the table scroll horizontally on small screens
    // without affecting the rest of the page layout. This is the standard
    // shadcn/ui pattern for responsive tables.
    <div className="relative w-full overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index} className="whitespace-nowrap">
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.length ? (
            data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex} className="whitespace-nowrap">
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyStateMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}