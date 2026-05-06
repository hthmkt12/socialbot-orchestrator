import { supabase } from './supabase';

export async function logAudit(
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    let actorId: string | null = null;
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      actorId = profile?.id ?? null;
    }

    await supabase.from('audit_logs').insert({
      actor_user_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata_json: metadata ?? {},
    });
  } catch {
    // Audit logging is best-effort — never block main flow
  }
}
