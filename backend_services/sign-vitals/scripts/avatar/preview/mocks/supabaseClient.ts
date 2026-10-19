// Dev-only stand-in for services/supabaseClient.ts in the preview harness.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "preview-user" }, access_token: "preview" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
