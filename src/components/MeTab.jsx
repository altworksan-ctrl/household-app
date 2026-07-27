import React, { useState } from "react";
import { LogOut, Shield, Users, Plus, Trash2, Download } from "lucide-react";
import { supabase } from "../supabaseClient";
import { SectionCard, Tape } from "./Shared";
import { tapeHex } from "../lib/helpers";
import { exportHouseholdData } from "../lib/exportData";

export default function MeTab({ currentMember, members, householdId, houseName, refreshMembers, refreshHouseName, isAdmin }) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [localHouseName, setLocalHouseName] = useState(houseName);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      await exportHouseholdData(supabase, { id: householdId, name: houseName }, members);
    } finally {
      setExporting(false);
    }
  };

  const adminCount = members.filter((m) => m.is_admin).length;

  const addMember = async () => {
    setError("");
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name || !email) return;
    const { error: err } = await supabase.from("members").insert({
      household_id: householdId,
      email,
      name,
      tape_index: members.length,
      is_admin: false,
      active: true,
    });
    if (err) {
      setError(err.message.includes("duplicate") ? "That email is already in this household." : err.message);
      return;
    }
    setNewName("");
    setNewEmail("");
    refreshMembers();
  };

  const updateMember = async (id, patch) => {
    const target = members.find((m) => m.id === id);
    if (patch.is_admin === false && adminCount <= 1 && target?.is_admin) return; // keep at least one admin
    await supabase.from("members").update(patch).eq("id", id);
    refreshMembers();
  };

  const removeMember = async (id) => {
    const target = members.find((m) => m.id === id);
    if (target?.is_admin && adminCount <= 1) return;
    await supabase.from("members").delete().eq("id", id);
    refreshMembers();
  };

  const saveHouseName = async () => {
    if (!localHouseName.trim() || localHouseName === houseName) return;
    await supabase.from("households").update({ name: localHouseName.trim() }).eq("id", householdId);
    refreshHouseName();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <SectionCard>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: tapeHex(currentMember) }}
          >
            <span className="text-white font-display font-bold text-lg">
              {currentMember?.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg truncate">{currentMember?.name}</div>
            <div className="text-xs text-[var(--ink-soft)] flex items-center gap-1">
              {isAdmin ? (
                <>
                  <Shield size={12} /> Admin · {houseName}
                </>
              ) : (
                houseName
              )}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border"
          style={{ borderColor: "var(--line)" }}
        >
          <LogOut size={15} /> Sign out
        </button>
      </SectionCard>

      {isAdmin && (
        <>
          <button
            onClick={doExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--denim)" }}
          >
            <Download size={15} /> {exporting ? "Preparing file…" : "Export all records (Excel)"}
          </button>
          <div className="text-xs text-[var(--ink-soft)] -mt-2 px-1">
            Downloads members, every expense, rent/WiFi status, and the chore rota history as a spreadsheet.
          </div>

          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] px-1">Household name</div>
          <SectionCard>
            <input
              value={localHouseName}
              onChange={(e) => setLocalHouseName(e.target.value)}
              onBlur={saveHouseName}
              className="w-full text-base font-medium outline-none bg-transparent"
            />
          </SectionCard>

          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] px-1 flex items-center gap-1.5">
            <Users size={12} /> Housemates ({members.length})
          </div>
          <div className="space-y-1.5">
            {members.map((m) => (
              <SectionCard key={m.id} className="!p-3">
                <div className="flex items-center gap-2.5">
                  <Tape member={m} size={12} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-[var(--ink-soft)] truncate">{m.email}</div>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={m.is_admin && adminCount <= 1}
                    className="p-1 text-[var(--ink-soft)] disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => updateMember(m.id, { active: !m.active })}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold"
                    style={{
                      background: m.active ? "var(--moss-tint)" : "var(--paper)",
                      color: m.active ? "var(--moss)" : "var(--ink-soft)",
                    }}
                  >
                    {m.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => updateMember(m.id, { is_admin: !m.is_admin })}
                    disabled={m.is_admin && adminCount <= 1}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{
                      background: m.is_admin ? "var(--denim-tint)" : "var(--paper)",
                      color: m.is_admin ? "var(--denim)" : "var(--ink-soft)",
                    }}
                  >
                    {m.is_admin ? "Admin" : "Make admin"}
                  </button>
                </div>
              </SectionCard>
            ))}
          </div>

          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] px-1">Add a housemate</div>
          <SectionCard className="space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-lg border px-2.5 py-2 text-base"
              style={{ borderColor: "var(--line)" }}
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email — they'll log in with this"
              type="email"
              className="w-full rounded-lg border px-2.5 py-2 text-base"
              style={{ borderColor: "var(--line)" }}
            />
            {error && <div className="text-xs text-[var(--rust)]">{error}</div>}
            <button
              onClick={addMember}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 font-semibold text-white"
              style={{ background: "var(--ink)" }}
            >
              <Plus size={16} /> Add housemate
            </button>
          </SectionCard>
        </>
      )}
    </div>
  );
}
