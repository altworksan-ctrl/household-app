import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, Receipt, Trash2, Camera, CheckCircle2, Banknote } from "lucide-react";
import { supabase } from "../supabaseClient";
import { MonthNav, SectionCard, MemberChip } from "./Shared";
import { monthRange, money, tapeHex, pad } from "../lib/helpers";
import { triggerNotification } from "../lib/notify";

function Lightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,22,17,0.9)" }}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white p-2">
        <X size={24} />
      </button>
      <img src={url} alt="Receipt" className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  );
}

function BalanceRow({ member, owed, settled, onAdjust }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [sign, setSign] = useState("+");

  const submit = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || isNaN(val)) return;
    onAdjust(member.id, sign === "+" ? val : -val);
    setAmount("");
    setSign("+");
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{member.name}</div>
          {settled > 0.01 && (
            <div className="text-[10px] text-[var(--ink-soft)] mt-0.5">{money(settled)} settled so far</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="font-mono font-semibold"
            style={{ color: owed > 0.01 ? "var(--rust)" : "var(--moss)" }}
          >
            {owed > 0.01 ? money(owed) : "Settled"}
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-semibold rounded-md px-2 py-1"
            style={{ background: "var(--paper)", color: "var(--ink-soft)" }}
          >
            Adjust
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border shrink-0" style={{ borderColor: "var(--line)" }}>
              <button
                onClick={() => setSign("+")}
                className="w-9 py-1.5 font-bold"
                style={{
                  background: sign === "+" ? "var(--moss-tint)" : "transparent",
                  color: sign === "+" ? "var(--moss)" : "var(--ink-soft)",
                }}
              >
                +
              </button>
              <button
                onClick={() => setSign("-")}
                className="w-9 py-1.5 font-bold"
                style={{
                  background: sign === "-" ? "var(--rust-tint)" : "transparent",
                  color: sign === "-" ? "var(--rust)" : "var(--ink-soft)",
                }}
              >
                −
              </button>
            </div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded-lg border px-2 py-1.5 text-sm font-mono"
              style={{ borderColor: "var(--line)" }}
            />
            <button onClick={submit} className="text-xs font-semibold rounded-md px-3 py-1.5 text-white shrink-0" style={{ background: "var(--moss)" }}>
              Save
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-[var(--ink-soft)] px-1 shrink-0">
              Cancel
            </button>
          </div>
          <div className="text-[10px] text-[var(--ink-soft)]">
            + records a payment received. − corrects a mistake (e.g. logged too much).
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoneyTab({
  householdId,
  activeMembers,
  currentMember,
  isAdmin,
  memberById,
  monthKey,
  setMonthKey,
}) {
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [receiptUrls, setReceiptUrls] = useState({});
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const adminMembers = activeMembers.filter((m) => m.is_admin);
  const [payer, setPayer] = useState(currentMember?.id || adminMembers[0]?.id || "");
  const [day, setDay] = useState(pad(new Date().getDate()));

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthRange(monthKey);
    const [{ data: expenseRows }, { data: settlementRows }] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("household_id", householdId)
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: false }),
      supabase.from("settlements").select("*").eq("household_id", householdId).eq("month", monthKey),
    ]);
    const rows = expenseRows || [];
    setExpenses(rows);
    setSettlements(settlementRows || []);
    setLoading(false);

    const withReceipts = rows.filter((r) => r.receipt_path);
    if (withReceipts.length > 0) {
      const urlMap = {};
      await Promise.all(
        withReceipts.map(async (r) => {
          const { data: signed } = await supabase.storage.from("receipts").createSignedUrl(r.receipt_path, 3600);
          if (signed) urlMap[r.id] = signed.signedUrl;
        })
      );
      setReceiptUrls(urlMap);
    } else {
      setReceiptUrls({});
    }
  }, [householdId, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`money-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settlements", filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load]);

  useEffect(() => {
    if (currentMember?.is_admin) setPayer(currentMember.id);
  }, [currentMember]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const share = activeMembers.length ? total / activeMembers.length : 0;

  const balances = activeMembers.map((m) => {
    const paid = expenses.filter((e) => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0);
    const settled = settlements.filter((s) => s.member_id === m.id).reduce((s, s2) => s + Number(s2.amount), 0);
    return { id: m.id, name: m.name, color: tapeHex(m), owed: Math.max(0, share - paid - settled), settled };
  });
  const myBalance = balances.find((b) => b.id === currentMember?.id);
  const nonAdminBalances = balances.filter((b) => !memberById[b.id]?.is_admin);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !payer) return;
    setUploading(true);

    const expenseId = crypto.randomUUID();
    let receiptPath = null;

    if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${householdId}/${expenseId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, receiptFile, { contentType: receiptFile.type });
      if (upErr) {
        setUploading(false);
        return;
      }
      receiptPath = path;
    }

    const dd = /^\d{1,2}$/.test(day) ? pad(day) : pad(new Date().getDate());
    const finalDesc = desc.trim() || "Groceries";
    const { error } = await supabase.from("expenses").insert({
      id: expenseId,
      household_id: householdId,
      member_id: payer,
      amount: amt,
      description: finalDesc,
      date: `${monthKey}-${dd}`,
      receipt_path: receiptPath,
    });

    setUploading(false);
    if (!error) {
      triggerNotification(supabase, { type: "expense", expenseDescription: finalDesc, expenseAmount: amt });
      setAmount("");
      setDesc("");
      setReceiptFile(null);
      setFormOpen(false);
      load();
    }
  };

  const removeExpense = async (e) => {
    if (e.receipt_path) {
      await supabase.storage.from("receipts").remove([e.receipt_path]);
    }
    await supabase.from("expenses").delete().eq("id", e.id);
    load();
  };

  const adjustSettlement = async (memberId, amt) => {
    await supabase.from("settlements").insert({
      household_id: householdId,
      member_id: memberId,
      month: monthKey,
      amount: amt,
    });
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24">
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      <SectionCard className="!p-3 mb-3">
        <MonthNav monthKey={monthKey} onChange={setMonthKey} />
      </SectionCard>

      <SectionCard className="mb-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)] font-semibold">
              Common groceries
            </div>
            <div className="font-display font-bold text-2xl mt-0.5">{money(total)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)] font-semibold">
              Fair share / person
            </div>
            <div className="font-mono font-semibold text-lg mt-0.5">{money(share)}</div>
          </div>
        </div>

        {!isAdmin && myBalance && (
          <div
            className="mt-3 rounded-xl px-3 py-3 flex items-center justify-between"
            style={{ background: myBalance.owed > 0.01 ? "var(--rust-tint)" : "var(--moss-tint)" }}
          >
            <span className="text-sm font-semibold" style={{ color: myBalance.owed > 0.01 ? "var(--rust)" : "var(--moss)" }}>
              {myBalance.owed > 0.01 ? "You owe the admin" : "You're settled up"}
            </span>
            {myBalance.owed > 0.01 && (
              <span className="font-mono font-bold" style={{ color: "var(--rust)" }}>
                {money(myBalance.owed)}
              </span>
            )}
          </div>
        )}
        {!isAdmin && myBalance?.settled > 0.01 && (
          <div className="text-xs text-[var(--ink-soft)] mt-2 px-1">
            {money(myBalance.settled)} already paid toward this month.
          </div>
        )}
      </SectionCard>

      {isAdmin && (
        <>
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="w-full mb-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--ink)" }}
          >
            {formOpen ? <X size={16} /> : <Plus size={16} />}
            {formOpen ? "Cancel" : "Add expense"}
          </button>

          {formOpen && (
            <SectionCard className="mb-3 space-y-2.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Amount</label>
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border px-2.5 py-2 text-base font-mono"
                    style={{ borderColor: "var(--line)" }}
                  />
                </div>
                <div className="w-24">
                  <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Day</label>
                  <input
                    inputMode="numeric"
                    value={day}
                    onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="mt-1 w-full rounded-lg border px-2.5 py-2 text-base font-mono"
                    style={{ borderColor: "var(--line)" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">
                  Description <span className="opacity-60">(optional if attaching a photo)</span>
                </label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Big Tesco shop"
                  className="mt-1 w-full rounded-lg border px-2.5 py-2 text-base"
                  style={{ borderColor: "var(--line)" }}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Photo of the bill</label>
                <label
                  className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium cursor-pointer"
                  style={{ borderColor: "var(--line)", borderStyle: "dashed" }}
                >
                  <Camera size={16} />
                  {receiptFile ? receiptFile.name : "Take or choose a photo"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                </label>
                {receiptFile && (
                  <button onClick={() => setReceiptFile(null)} className="text-xs text-[var(--ink-soft)] underline mt-1">
                    Remove photo
                  </button>
                )}
              </div>
              {adminMembers.length > 1 && (
                <div>
                  <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Paid by</label>
                  <select
                    value={payer}
                    onChange={(e) => setPayer(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-2.5 py-2 text-base"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {adminMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={submit}
                disabled={uploading}
                className="w-full rounded-lg py-2.5 font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--moss)" }}
              >
                {uploading ? "Saving…" : "Save expense"}
              </button>
            </SectionCard>
          )}
        </>
      )}

      <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">Expenses this month</div>
      <div className="space-y-1.5 mb-4">
        {loading && <div className="text-sm text-[var(--ink-soft)] text-center py-6">Loading…</div>}
        {!loading && expenses.length === 0 && (
          <div className="text-sm text-[var(--ink-soft)] text-center py-6">Nothing logged yet.</div>
        )}
        {expenses.map((e) => {
          const m = memberById[e.member_id];
          const url = receiptUrls[e.id];
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--card)" }}>
              <button
                onClick={() => url && setLightboxUrl(url)}
                disabled={!url}
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                style={{ background: "var(--paper)" }}
              >
                {url ? (
                  <img src={url} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                ) : (
                  <Receipt size={16} className="text-[var(--ink-soft)]" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.description}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {m && <MemberChip member={m} small />}
                  <span className="text-[10px] font-mono text-[var(--ink-soft)]">{e.date.slice(5)}</span>
                </div>
              </div>
              <div className="font-mono font-semibold text-sm shrink-0">{money(Number(e.amount))}</div>
              {isAdmin && (
                <button onClick={() => removeExpense(e)} className="p-1 text-[var(--ink-soft)]">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <>
          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1 flex items-center gap-1.5">
            <Banknote size={12} /> Balances
          </div>
          <SectionCard className="space-y-3">
            {nonAdminBalances.length === 0 ? (
              <div className="text-sm text-[var(--ink-soft)] text-center py-2 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} /> No housemates to track yet.
              </div>
            ) : (
              nonAdminBalances.map((b) => (
                <BalanceRow
                  key={b.id}
                  member={{ id: b.id, name: b.name }}
                  owed={b.owed}
                  settled={b.settled}
                  onAdjust={adjustSettlement}
                />
              ))
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
