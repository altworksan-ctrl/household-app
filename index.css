import React, { useEffect, useState, useCallback } from "react";
import { ChefHat, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";
import { MonthNav, SectionCard, MemberChip } from "./Shared";
import {
  dateKeyOf,
  monthKeyOf,
  monthRange,
  weekdayShort,
  generateMonthEntries,
} from "../lib/helpers";

function DutyStub({ cook, clean }) {
  const today = new Date();
  const dayLabel = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="relative mb-5" style={{ transform: "rotate(-1deg)" }}>
      <div
        className="absolute -top-2 left-6 w-14 h-6 rounded-sm opacity-80"
        style={{ background: "var(--mustard)", transform: "rotate(-8deg)", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
      />
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--stub)", boxShadow: "0 4px 14px rgba(35,40,31,0.12)" }}>
        <div className="px-4 pt-4 pb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-soft)]">
            Today's duty · {dayLabel}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-[var(--ink-soft)]">
                <ChefHat size={12} /> Cooking
              </div>
              <div className="mt-1 font-display font-bold text-lg">{cook ? cook.name : "—"}</div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-[var(--ink-soft)]">
                <Sparkles size={12} /> Cleaning
              </div>
              <div className="mt-1 font-display font-bold text-lg">{clean ? clean.name : "—"}</div>
            </div>
          </div>
        </div>
        <div className="stub-perf" />
      </div>
    </div>
  );
}

export default function RotaTab({ householdId, activeMembers, isAdmin, memberById, monthKey, setMonthKey }) {
  const [entries, setEntries] = useState([]);
  const [todayEntry, setTodayEntry] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const todayKey = dateKeyOf(new Date());
  const todayMonthKey = monthKeyOf(new Date());

  const load = useCallback(
    async (mKey) => {
      setLoading(true);
      const { start, end } = monthRange(mKey);
      const { data } = await supabase
        .from("rota_entries")
        .select("*")
        .eq("household_id", householdId)
        .gte("date", start)
        .lt("date", end)
        .order("date");

      let rows = data || [];
      if (rows.length === 0 && activeMembers.length > 0) {
        rows = generateMonthEntries(mKey, activeMembers);
      }
      setEntries(rows);
      setLoading(false);
      return rows;
    },
    [householdId, activeMembers]
  );

  useEffect(() => {
    load(monthKey);
  }, [monthKey, load]);

  useEffect(() => {
    const channel = supabase
      .channel(`rota-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rota_entries", filter: `household_id=eq.${householdId}` },
        () => load(monthKey)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, monthKey, load]);

  useEffect(() => {
    // always resolve today's duty regardless of which month is being viewed
    (async () => {
      if (monthKey === todayMonthKey) return; // covered by entries already
      const rows = await load(todayMonthKey);
      const t = rows.find((e) => e.date === todayKey);
      setTodayEntry(t || null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (monthKey === todayMonthKey) {
      setTodayEntry(entries.find((e) => e.date === todayKey) || null);
    }
  }, [entries, monthKey, todayMonthKey, todayKey]);

  const persistEntries = async (rows) => {
    if (!isAdmin) return;
    await supabase
      .from("rota_entries")
      .upsert(
        rows.map((r) => ({ household_id: householdId, date: r.date, cook_id: r.cook_id, clean_id: r.clean_id })),
        { onConflict: "household_id,date" }
      );
  };

  const updateEntry = async (date, field, value) => {
    const next = entries.map((e) => (e.date === date ? { ...e, [field]: value } : e));
    setEntries(next);
    const row = next.find((e) => e.date === date);
    await persistEntries([row]);
  };

  const regenerate = async () => {
    const fresh = generateMonthEntries(monthKey, activeMembers);
    setEntries(fresh);
    await persistEntries(fresh);
  };

  return (
    <div className="px-4 pt-4 pb-24">
      <DutyStub cook={memberById[todayEntry?.cook_id]} clean={memberById[todayEntry?.clean_id]} />

      <SectionCard className="!p-3 mb-3">
        <MonthNav monthKey={monthKey} onChange={setMonthKey} />
      </SectionCard>

      {isAdmin && (
        <button
          onClick={regenerate}
          className="w-full mb-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <RefreshCw size={15} /> Reshuffle this month
        </button>
      )}

      {loading ? (
        <div className="text-sm text-[var(--ink-soft)] text-center py-8">Loading…</div>
      ) : activeMembers.length === 0 ? (
        <div className="text-sm text-[var(--ink-soft)] text-center py-8">
          Add active housemates in the Me tab to build a rota.
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const cook = memberById[e.cook_id];
            const clean = memberById[e.clean_id];
            const isToday = e.date === todayKey;
            const isOpen = expanded === e.date;
            const dnum = e.date.split("-")[2];
            return (
              <div key={e.date}>
                <button
                  onClick={() => isAdmin && setExpanded(isOpen ? null : e.date)}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                  style={{
                    background: isToday ? "var(--stub)" : "var(--card)",
                    outline: isToday ? "1.5px solid var(--mustard)" : "none",
                  }}
                >
                  <div className="w-10 text-center shrink-0">
                    <div className="font-mono font-bold text-sm leading-none">{dnum}</div>
                    <div className="text-[9px] uppercase text-[var(--ink-soft)] mt-0.5">{weekdayShort(e.date)}</div>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase text-[var(--ink-soft)] flex items-center gap-1">
                        <ChefHat size={10} /> Cook
                      </div>
                      <MemberChip member={cook} small />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] uppercase text-[var(--ink-soft)] flex items-center gap-1">
                        <Sparkles size={10} /> Clean
                      </div>
                      <MemberChip member={clean} small />
                    </div>
                  </div>
                </button>
                {isOpen && isAdmin && (
                  <div className="flex gap-2 px-3 py-2.5 rounded-xl mt-1" style={{ background: "var(--card)" }}>
                    <select
                      value={e.cook_id || ""}
                      onChange={(ev) => updateEntry(e.date, "cook_id", ev.target.value)}
                      className="flex-1 rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: "var(--line)" }}
                    >
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          Cook: {m.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={e.clean_id || ""}
                      onChange={(ev) => updateEntry(e.date, "clean_id", ev.target.value)}
                      className="flex-1 rounded-lg border px-2 py-2 text-sm"
                      style={{ borderColor: "var(--line)" }}
                    >
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          Clean: {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
