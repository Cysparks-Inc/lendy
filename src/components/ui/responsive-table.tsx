import * as React from "react";

interface ResponsiveTableProps {
  headers: { key: string; label: string }[];
  data: any[];
  className?: string;
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ headers, data, className }) => {
  return (
    <div className={`w-full ${className || ''}`}>
      {/* Mobile-optimized table wrapper with horizontal scroll */}
      <div className="border rounded-md table-container">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header) => (
                <th key={header.key} className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                {headers.map((header) => (
                  <td key={`${row.id}-${header.key}`} className="whitespace-nowrap px-4 py-3">
                    {row[header.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResponsiveTable;