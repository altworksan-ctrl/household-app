import * as XLSX from "xlsx";

export async function exportHouseholdData(supabase, household, members) {
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const [{ data: expenses }, { data: payments }, { data: rota }] = await Promise.all([
    supabase.from("expenses").select("*").eq("household_id", household.id).order("date"),
    supabase.from("payments").select("*").eq("household_id", household.id).order("month"),
    supabase.from("rota_entries").select("*").eq("household_id", household.id).order("date"),
  ]);

  const wb = XLSX.utils.book_new();

  const membersRows = members.map((m) => ({
    Name: m.name,
    Email: m.email,
    Role: m.is_admin ? "Admin" : "Member",
    Status: m.active ? "Active" : "Inactive",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membersRows), "Members");

  const expenseRows = (expenses || []).map((e) => ({
    Date: e.date,
    Description: e.description,
    "Amount (£)": Number(e.amount),
    "Paid By": memberById[e.member_id]?.name || "—",
    "Receipt Attached": e.receipt_path ? "Yes" : "No",
  }));
  const expSheet = XLSX.utils.json_to_sheet(expenseRows);
  XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");

  const paymentRows = (payments || []).map((p) => ({
    Month: p.month,
    Member: memberById[p.member_id]?.name || "—",
    "Rent Paid": p.rent_paid ? "Yes" : "No",
    "WiFi Paid": p.wifi_paid ? "Yes" : "No",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), "Rent & WiFi");

  const rotaRows = (rota || []).map((r) => ({
    Date: r.date,
    Cook: memberById[r.cook_id]?.name || "—",
    Clean: memberById[r.clean_id]?.name || "—",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rotaRows), "Chore Rota");

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = household.name.replace(/[^a-z0-9]+/gi, "-");
  XLSX.writeFile(wb, `${safeName}-records-${stamp}.xlsx`);
}
