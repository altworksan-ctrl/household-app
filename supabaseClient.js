import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function OnboardingScreen({ userEmail, onCreated }) {
  const [houseName, setHouseName] = useState("");
  const [yourName, setYourName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!houseName.trim() || !yourName.trim()) return;
    setBusy(true);
    setError("");

    // Generate the id client-side and insert without asking for it back.
    // (Right after insert, no member row exists yet, so the households
    // SELECT policy — which requires membership — would block returning
    // the row and surface as an RLS error even though the insert itself
    // is fine. Knowing the id up front avoids needing that select.)
    const householdId = crypto.randomUUID();

    const { error: hErr } = await supabase
      .from("households")
      .insert({ id: householdId, name: houseName.trim() });

    if (hErr) {
      setError(hErr.message);
      setBusy(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error: mErr } = await supabase.from("members").insert({
      household_id: householdId,
      user_id: user.id,
      email: userEmail,
      name: yourName.trim(),
      tape_index: 0,
      is_admin: true,
      active: true,
    });

    setBusy(false);
    if (mErr) {
      setError(mErr.message);
      return;
    }
    onCreated();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-2xl font-bold tracking-tight">You're not in a household yet</div>
          <div className="text-sm text-[var(--ink-soft)] mt-2">
            If a housemate already added you by this email ({userEmail}), refresh in a moment. Otherwise,
            set one up below.
          </div>
        </div>
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card)", boxShadow: "0 1px 2px rgba(35,40,31,0.06), 0 1px 12px rgba(35,40,31,0.04)" }}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              House name
            </label>
            <input
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
              placeholder="e.g. 14 Elm Road"
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-base outline-none"
              style={{ borderColor: "var(--line)" }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
              Your display name
            </label>
            <input
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              placeholder="What housemates should see"
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-base outline-none"
              style={{ borderColor: "var(--line)" }}
            />
          </div>
          {error && <div className="text-xs text-[var(--rust)]">{error}</div>}
          <button
            disabled={busy || !houseName.trim() || !yourName.trim()}
            onClick={create}
            className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--ink)" }}
          >
            {busy ? "Creating…" : "Create household"}
          </button>
          <div className="text-xs text-[var(--ink-soft)] text-center">
            You'll be the admin. Add the rest of the household from the Me tab afterwards.
          </div>
        </div>
      </div>
    </div>
  );
}
