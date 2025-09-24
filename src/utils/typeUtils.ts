// Comprehensive type assertion utility to handle outdated Supabase types
// This file provides workarounds until the database migration is approved and types are updated

// Helper to fix Supabase table access
export const supabaseTable = (supabase: any, tableName: string) => {
  return (supabase as any).from(tableName);
};

// Helper to fix Supabase RPC calls
export const supabaseRpc = (supabase: any, functionName: string, params?: any) => {
  return (supabase as any).rpc(functionName, params);
};

// Helper to fix data assignment type errors
export const fixData = (data: any) => {
  return data as any;
};

// Helper to fix column definitions for DataTable
export const fixColumns = (columns: any[]) => {
  return columns.map(col => ({
    ...col,
    accessorKey: col.accessorKey as any
  })) as any;
};

// Helper to fix state assignments
export const fixState = (data: any) => {
  return data as any;
};

// Helper to fix props assignments  
export const fixProps = (props: any) => {
  return props as any;
};