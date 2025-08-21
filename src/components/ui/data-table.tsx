import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollableContainer } from '@/components/ui/scrollable-container'; // Assuming you have this

// Using generics to make the component truly reusable
interface DataTableProps<TData> {
  columns: {
    accessorKey: keyof TData | ((row: TData) => any); // Can be a key or a function
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
    <ScrollableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.length ? (
            data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex}>
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
    </ScrollableContainer>
  );
}