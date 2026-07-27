import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tapeHex, monthLabel, shiftMonth } from "../lib/helpers";

export function Tape({ member, size = 10 }) {
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: size, height: size, background: tapeHex(member) }}
    />
  );
}

export function MemberChip({ member, small }) {
  if (!member) return <span className="text-sm text-[var(--ink-soft)]">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${small ? "text-xs" : "text-sm"}`}>
      <Tape member={member} size={small ? 8 : 10} />
      <span className="font-medium truncate">{member.name}</span>
    </span>
  );
}

export function MonthNav({ monthKey, onChange }) {
  return (
    <div className="flex items-center justify-between px-1">
      <button
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(monthKey, -1))}
        className="p-2 rounded-full active:bg-black/5"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="font-display font-bold text-base tracking-tight">{monthLabel(monthKey)}</div>
      <button
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(monthKey, 1))}
        className="p-2 rounded-full active:bg-black/5"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

export function SectionCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{ background: "var(--card)", boxShadow: "0 1px 2px rgba(35,40,31,0.06), 0 1px 12px rgba(35,40,31,0.04)" }}
    >
      {children}
    </div>
  );
}
