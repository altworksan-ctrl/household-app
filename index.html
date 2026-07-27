// Calls the daily-notifications edge function directly, using the current
// logged-in session. supabase.functions.invoke() automatically attaches the
// user's auth token — the function itself checks server-side that the
// caller is an admin, and scopes the action to their own household only.
export async function triggerNotification(supabase, payload) {
  try {
    const { data, error } = await supabase.functions.invoke("daily-notifications", {
      body: payload,
    });
    if (error) throw error;
    return data;
  } catch (e) {
    // Best-effort — a failed notification shouldn't block the user's action
    // (e.g. adding an expense should still succeed even if the push fails).
    console.warn("Notification trigger failed:", e.message);
    return null;
  }
}
