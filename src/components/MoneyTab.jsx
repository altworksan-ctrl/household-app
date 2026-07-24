bash

cat > /home/claude/household-app/src/components/MoneyTab.jsx << 'JSXEOF'
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, X, Receipt, Trash2, Camera, ImageOff } from "lucide-react";
import { supabase } from "../supabaseClient";
import { MonthNav, SectionCard, MemberChip } from "./Shared";
import { monthRange, money, tapeHex, pad } from "../lib/helpers";

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
  const [signedUrls, setSignedUrls] = useState({}); // expense.id -> signed url
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = useRef(null);
  const adminMembers = activeMembers.filter((m) => m.is_admin);
  const [payer, setPayer] = useState(currentMember?.id || adminMembers[0]?.id || "");
  const [day, setDay] = useState(pad(new Date().getDate()));

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthRange(monthKey);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("household_id", householdId)
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false });
    const rows = data || [];
    setExpenses(rows);
    setLoading(false);

    const withReceipts = rows.filter((r) => r.receipt_path);
    if (withReceipts.length > 0) {
      const { data: signed } = await supabase.storage
        .from("receipts")
        .createSignedUrls(withReceipts.map((r) => r.receipt_path), 3600);
      if (signed) {
        const map = {};
        signed.forEach((s, i) => {
          if (s.signedUrl) map[withReceipts[i].id] = s.signedUrl;
        });
        setSignedUrls(map);
      }
    }
  }, [householdId, monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (currentMember?.is_admin) setPayer(currentMember.id);
  }, [currentMember]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const share = activeMembers.length ? total / activeMembers.length : 0;

  const balances = activeMembers.map((m) => {
    const paid = expenses.filter((e) => e.member_id === m.id).reduce((s, e) => s + Number(e.amount), 0);
    return { id: m.id, name: m.name, color: tapeHex(m), owed: Math.max(0, share - paid) };
  });
  const myBalance = balances.find((b) => b.id === currentMember?.id);
  const owingMembers = balances.filter((b) => b.owed > 0.01 && !memberById[b.id]?.is_admin);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !payer) return;
    setUploading(true);
    const dd = /^\d{1,2}$/.test(day) ? pad(day) : pad(new Date().getDate());
    const expenseId = crypto.randomUUID();

    let receiptPath = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      receiptPath = `${householdId}/${expenseId}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(receiptPath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setUploading(false);
        return;
      }
    }

    const { error } = await supabase.from("expenses").insert({
      id: expenseId,
      household_id: householdId,
      member_id: payer,
      amount: amt,
      description: desc.trim() || "Groceries",
      date: `${monthKey}-${dd}`,
      receipt_path: receiptPath,
    });

    setUploading(false);
    if (!error) {
      setAmount("");
      setDesc("");
      setFile(null);
      setFilePreview(null);
      setFormOpen(false);
      load();
    }
  };

  const removeExpense = async (exp) => {
    if (exp.receipt_path) {
      await supabase.storage.from("receipts").remove([exp.receipt_path]);
    }
    await supabase.from("expenses").delete().eq("id", exp.id);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24">
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
              <div>
                <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Bill photo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFileChange}
                  className="hidden"
                />
                {filePreview ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 w-full rounded-lg overflow-hidden border"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <img src={filePreview} alt="Receipt preview" className="w-full h-40 object-cover" />
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <Camera size={22} className="text-[var(--ink-soft)]" />
                    <span className="text-xs text-[var(--ink-soft)] font-medium">Take or choose a photo</span>
                  </button>
                )}
              </div>
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
                <label className="text-[10px] uppercase font-semibold text-[var(--ink-soft)]">Label (optional)</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Big Tesco shop"
                  className="mt-1 w-full rounded-lg border px-2.5 py-2 text-base"
                  style={{ borderColor: "var(--line)" }}
                />
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
                disabled={uploading}
                onClick={submit}
                className="w-full rounded-lg py-2.5 font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--moss)" }}
              >
                {uploading ? "Saving…" : "Save expense"}
              </button>
            </SectionCard>
          )}
        </>
      )}

      <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">
        Bills this month
      </div>
      <div className="space-y-1.5 mb-4">
        {loading && <div className="text-sm text-[var(--ink-soft)] text-center py-6">Loading…</div>}
        {!loading && expenses.length === 0 && (
          <div className="text-sm text-[var(--ink-soft)] text-center py-6">Nothing logged yet.</div>
        )}
        {expenses.map((e) => {
          const m = memberById[e.member_id];
          const url = signedUrls[e.id];
          return (
            <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--card)" }}>
              {url ? (
                <button
                  onClick={() => setLightbox(url)}
                  className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border"
                  style={{ borderColor: "var(--line)" }}
                >
                  <img src={url} alt="Receipt" className="w-full h-full object-cover" />
                </button>
              ) : (
                <div
                  className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: "var(--paper)" }}
                >
                  {e.receipt_path ? (
                    <ImageOff size={16} className="text-[var(--ink-soft)]" />
                  ) : (
                    <Receipt size={16} className="text-[var(--ink-soft)]" />
                  )}
                </div>
              )}
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
          <div className="text-[10px] uppercase font-semibold text-[var(--ink-soft)] mb-1.5 px-1">Who owes you</div>
          <SectionCard className="space-y-2">
            {owingMembers.length === 0 ? (
              <div className="text-sm text-[var(--ink-soft)] text-center py-2">Everyone's settled up.</div>
            ) : (
              owingMembers.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{b.name}</span>
                  <span className="font-mono font-semibold" style={{ color: "var(--rust)" }}>
                    {money(b.owed)}
                  </span>
                </div>
              ))
            )}
          </SectionCard>
        </>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(35,40,31,0.9)" }}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 text-white">
            <X size={26} />
          </button>
          <img src={lightbox} alt="Receipt full size" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
JSXEOF
echo "written"
Output

written
Done


