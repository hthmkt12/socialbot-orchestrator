type SupabaseLikeError = {
  code?: string;
  message?: string;
};

export function isMissingSchemaError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    /Could not find (the table|the function|the column)/i.test(error.message ?? '') ||
    /schema cache/i.test(error.message ?? '')
  );
}
