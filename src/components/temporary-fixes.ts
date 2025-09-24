// Temporary type fixes to resolve build errors
// These are workarounds until the database migration is approved and types are updated

export const fixSupabaseCall = (supabase: any, tableName: string) => {
  return (supabase as any).from(tableName);
};

export const fixSupabaseRpc = (supabase: any, functionName: string, params?: any) => {
  return (supabase as any).rpc(functionName, params);
};

export const fixDataAssignment = (data: any) => {
  return data as any;
};