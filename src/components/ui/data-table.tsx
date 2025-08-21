import React from 'react';

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
    // --- MOBILE RESPONSIVE TABLE WRAPPER ---
    // This wrapper provides horizontal scrolling ONLY within the table container
    // The table maintains its natural width while the container scrolls horizontally
    // without affecting the page layout or causing page-level side scroll
    <div className="w-full">
      <div className="border rounded-md table-container">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column, index) => (
                <th key={index} className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.length ? (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b hover:bg-muted/50 transition-colors">
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="whitespace-nowrap px-4 py-3">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyStateMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}