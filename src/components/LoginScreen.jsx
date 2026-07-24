import React, { useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-3xl font-bold tracking-tight">Household</div>
          <div className="text-sm text-[var(--ink-soft)] mt-2">
            Chores, groceries and bills — sorted for everyone under one roof.
          </div>
        </div>

        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--card)", boxShadow: "0 1px 2px rgba(35,40,31,0.06), 0 1px 12px rgba(35,40,31,0.04)" }}
        >
          {sent ? (
            <div className="text-center py-4">
              <Mail size={28} className="mx-auto mb-2 text-[var(--ink-soft)]" />
              <div className="font-semibold">Check your email</div>
              <div className="text-sm text-[var(--ink-soft)] mt-1">
                We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on this
                device to log in — you won't need to do this again here.
              </div>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-xs font-semibold text-[var(--ink-soft)] underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                Your email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="you@example.com"
                type="email"
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-base outline-none"
                style={{ borderColor: "var(--line)" }}
              />
              {error && <div className="text-xs text-[var(--rust)] mt-2">{error}</div>}
              <button
                disabled={busy || !email.trim()}
                onClick={send}
                className="w-full mt-4 rounded-xl py-3 font-semibold text-white disabled:opacity-40"
                style={{ background: "var(--ink)" }}
              >
                {busy ? "Sending…" : "Send sign-in link"}
              </button>
              <div className="text-xs text-[var(--ink-soft)] text-center mt-3">
                No password needed. We'll email you a one-time link.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
