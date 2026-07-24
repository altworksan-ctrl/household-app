import React, { useEffect, useState, useCallback } from "react";
import { Check, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { MonthNav, SectionCard, MemberChip } from "./Shared";

function StatusRow({ member, status, editable, onToggle }) {
  const rent = status?.rent_paid ?? false;
  const wifi = status?.wifi_paid ?? false;
  const Box = ({ label, on, onClick }) => (
    <button
      disabled={!editable}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
      style={{
        background: on ? "var(--moss-tint)" : "var(--rust-tint)",
        color: on ? "var(--moss)" : "var(--rust)",
      }}
    >
      {on ? <Check size={13} /> : <X size={13} />}
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--card)" }}>
      <div className="flex-1 min-w-0">
        <MemberChip member={member} />
      </div>
      <Box label="Rent" on={rent} onClick={() => onToggle("rent_paid", rent)} />
      <Box label="WiFi" on={wifi} onClick={() => onToggle("wifi_paid", wifi)} />
    </div>
  );
}

export default function StatusTab({ householdId, activeMembers, currentMember, isAdmin, monthKey, setMonthKey }) {
  const [rows, setRows] = useState([]); // for admin: all rows this month; for member: just their own (RLS-enforced)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("household_id", householdId)
      .eq("month", monthKey);
    setRows(data || []);
    setLoading(false);
  }, [householdId, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  const rowFor = (memberId) => rows.find((r) => r.member_id === memberId);

  const toggle = async (memberId, field, current) => {
    const existing = rowFor(memberId);
    const payload = {
      household_id: householdId,
      member_id: memberId,
      month: monthKey,
      rent_paid: existing?.rent_paid ?? false,
      wifi_paid: existing?.wifi_paid ?? false,
      [field]: !current,
    };
    const { error } = await supabase
      .from("payments")
      .upsert(payload, { onConflict: "household_id,member_id,month" });
    if (!error) load();
  };

  return (
    <div className="px-4 pt-4 pb-24">
      <SectionCard className="!p-3 mb-3">
        <MonthNav monthKey={monthKey} onChange={setMonthKey} />
      </SectionCard>

      {loading ? (
        <div className="text-sm text-[var(--ink-soft)] text-center py-8">Loading…</div>
      ) : isAdmin ? (
        <>
          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">
            Household payment status — each housemate only sees their own row
          </div>
          <div className="space-y-1.5">
            {activeMembers.map((m) => (
              <StatusRow
                key={m.id}
                member={m}
                status={rowFor(m.id)}
                editable
                onToggle={(field, current) => toggle(m.id, field, current)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">
            Your payment status
          </div>
          <StatusRow member={currentMember} status={rowFor(currentMember?.id)} editable={false} onToggle={() => {}} />
          <div className="text-xs text-[var(--ink-soft)] mt-3 px-1">
            Set by your house admin, for your information only. Get in touch with them if this looks wrong.
          </div>
        </>
      )}
    </div>
  );
}
