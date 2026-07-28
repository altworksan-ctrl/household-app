import React, { useEffect, useState, useCallback } from "react";
import { Bell, X, Check } from "lucide-react";
import { supabase } from "../supabaseClient";
import { SectionCard } from "./Shared";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NotificationsTab({ currentMember }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data || []);
    setLoading(false);
  }, [currentMember.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${currentMember.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `member_id=eq.${currentMember.id}` },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMember.id, load]);

  const acknowledge = async (item) => {
    await supabase.from("notifications").update({ acknowledged_at: new Date().toISOString() }).eq("id", item.id);
    setSelected(null);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">
        Recent notifications
      </div>

      {loading ? (
        <div className="text-sm text-[var(--ink-soft)] text-center py-8">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-[var(--ink-soft)] text-center py-8">Nothing yet.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((n) => {
            const unread = !n.acknowledged_at;
            return (
              <button
                key={n.id}
                onClick={() => setSelected(n)}
                className="w-full flex items-start gap-3 rounded-xl px-3 py-3 text-left"
                style={{ background: "var(--card)", outline: unread ? "1.5px solid var(--mustard)" : "none" }}
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: unread ? "var(--mustard)" : "transparent" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{n.title}</div>
                  <div className="text-xs text-[var(--ink-soft)] truncate mt-0.5">{n.body}</div>
                </div>
                <div className="text-[10px] font-mono text-[var(--ink-soft)] shrink-0 mt-0.5">
                  {timeAgo(n.created_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(20,22,17,0.6)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "var(--stub)" }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--mustard)" }}
              >
                <Bell size={18} className="text-white" />
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-[var(--ink-soft)]">
                <X size={20} />
              </button>
            </div>
            <div className="font-display font-bold text-xl">{selected.title}</div>
            <div className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">{selected.body}</div>
            <div className="text-[10px] font-mono text-[var(--ink-soft)] mt-3">
              {new Date(selected.created_at).toLocaleString("en-GB")}
            </div>
            <button
              onClick={() => acknowledge(selected)}
              className="w-full mt-5 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white"
              style={{ background: selected.acknowledged_at ? "var(--ink-soft)" : "var(--moss)" }}
            >
              <Check size={16} /> {selected.acknowledged_at ? "Acknowledged" : "Okay, got it"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
