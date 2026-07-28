import React from "react";
import { Bell, X, Check } from "lucide-react";

export default function NotificationDetailModal({ notification, onAcknowledge, onClose }) {
  if (!notification) return null;
  return (
    <div
      onClick={onClose}
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
          <button onClick={onClose} className="p-1 text-[var(--ink-soft)]">
            <X size={20} />
          </button>
        </div>
        <div className="font-display font-bold text-xl">{notification.title}</div>
        <div className="text-sm text-[var(--ink-soft)] mt-2 leading-relaxed">{notification.body}</div>
        <div className="text-[10px] font-mono text-[var(--ink-soft)] mt-3">
          {new Date(notification.created_at).toLocaleString("en-GB")}
        </div>
        <button
          onClick={() => onAcknowledge(notification)}
          className="w-full mt-5 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white"
          style={{ background: notification.acknowledged_at ? "var(--ink-soft)" : "var(--moss)" }}
        >
          <Check size={16} /> {notification.acknowledged_at ? "Acknowledged" : "Okay, got it"}
        </button>
      </div>
    </div>
  );
}
