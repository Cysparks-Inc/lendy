import React from 'react';

// Bulletproof table component with !important CSS rules
interface SecureTableProps<TData> {
  columns: {
    header: string;
    cell: (row: TData) => React.ReactNode;
  }[];
  data: TData[];
  emptyStateMessage?: string;
  className?: string;
}

export function SecureTable<TData>({
  columns,
  data,
  emptyStateMessage = "No results found.",
  className = ""
}: SecureTableProps<TData>) {
  return (
    <div className={`w-full ${className}`} style={{ maxWidth: '100% !important' }}>
      {/* Bulletproof container with !important rules */}
      <div 
        className="border rounded-md table-container"
        style={{
          overflowX: 'auto !important',
          overflowY: 'hidden !important',
          maxWidth: '100% !important',
          width: '100% !important',
          WebkitOverflowScrolling: 'touch !important'
        }}
      >
        <table 
          className="w-full min-w-full"
          style={{
            minWidth: '100% !important',
            tableLayout: 'auto !important',
            borderCollapse: 'collapse !important'
          }}
        >
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((column, index) => (
                <th 
                  key={index} 
                  className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                  style={{ whiteSpace: 'nowrap !important' }}
                >
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
                    <td 
                      key={colIndex} 
                      className="whitespace-nowrap px-4 py-3"
                      style={{ whiteSpace: 'nowrap !important' }}
                    >
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