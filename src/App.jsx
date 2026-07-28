import React, { useEffect, useState, useCallback } from "react";
import { ChefHat, Wallet, CheckSquare, User, Bell } from "lucide-react";
import { supabase } from "./supabaseClient";
import LoginScreen from "./components/LoginScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import RotaTab from "./components/RotaTab";
import MoneyTab from "./components/MoneyTab";
import StatusTab from "./components/StatusTab";
import NotificationsTab from "./components/NotificationsTab";
import NotificationDetailModal from "./components/NotificationDetailModal";
import MeTab from "./components/MeTab";
import { tapeHex, monthKeyOf } from "./lib/helpers";

const KIND_TO_TAB = {
  rota: "rota",
  payment: "status",
  expense: "money",
  "grocery-balance": "money",
};

const TABS = [
  { id: "rota", label: "Rota", icon: ChefHat },
  { id: "money", label: "Money", icon: Wallet },
  { id: "status", label: "Status", icon: CheckSquare },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "me", label: "Me", icon: User },
];

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [session, setSession] = useState(null);

  const [resolveLoading, setResolveLoading] = useState(true);
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentMember, setCurrentMember] = useState(null);

  const [tab, setTab] = useState("rota");
  const [rotaMonth, setRotaMonth] = useState(monthKeyOf(new Date()));
  const [moneyMonth, setMoneyMonth] = useState(monthKeyOf(new Date()));
  const [statusMonth, setStatusMonth] = useState(monthKeyOf(new Date()));
  const [deepLinkNotification, setDeepLinkNotification] = useState(null);

  // -- auth session -----------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // -- resolve household + member for the logged-in email ---------------
  const resolveHousehold = useCallback(async () => {
    if (!session?.user?.email) return;
    setResolveLoading(true);

    const { data: memberRow } = await supabase
      .from("members")
      .select("*, households(*)")
      .eq("email", session.user.email)
      .limit(1)
      .maybeSingle();

    if (!memberRow) {
      setHousehold(null);
      setMembers([]);
      setCurrentMember(null);
      setResolveLoading(false);
      return;
    }

    const hh = memberRow.households;
    setHousehold(hh);

    const { data: allMembers } = await supabase
      .from("members")
      .select("*")
      .eq("household_id", hh.id)
      .order("created_at");

    setMembers(allMembers || []);
    setCurrentMember((allMembers || []).find((m) => m.email === session.user.email) || memberRow);
    setResolveLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) resolveHousehold();
  }, [session, resolveHousehold]);

  const refreshMembers = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from("members").select("*").eq("household_id", household.id).order("created_at");
    setMembers(data || []);
    setCurrentMember((data || []).find((m) => m.email === session?.user?.email) || null);
  }, [household, session]);

  const refreshHouseName = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase.from("households").select("*").eq("id", household.id).single();
    setHousehold(data);
  }, [household]);

  useEffect(() => {
    if (!household?.id) return;
    const channel = supabase
      .channel(`household-meta-${household.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `household_id=eq.${household.id}` },
        refreshMembers
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `id=eq.${household.id}` },
        refreshHouseName
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household?.id, refreshMembers, refreshHouseName]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const activeMembers = members.filter((m) => m.active);
  const isAdmin = !!currentMember?.is_admin;

  // -- deep-linking from a tapped push notification ----------------------
  const openNotificationById = useCallback(async (notificationId) => {
    if (!notificationId) return;
    const { data } = await supabase.from("notifications").select("*").eq("id", notificationId).maybeSingle();
    if (data) {
      setTab(KIND_TO_TAB[data.kind] || "alerts");
      setDeepLinkNotification(data);
    }
  }, []);

  useEffect(() => {
    if (!currentMember) return;
    const params = new URLSearchParams(window.location.search);
    const notif = params.get("notif");
    if (notif) {
      openNotificationById(notif);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [currentMember, openNotificationById]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event) => {
      if (event.data?.type === "notification-click" && event.data.notificationId) {
        openNotificationById(event.data.notificationId);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [openNotificationById]);

  const acknowledgeDeepLink = async (n) => {
    await supabase.from("notifications").update({ acknowledged_at: new Date().toISOString() }).eq("id", n.id);
    setDeepLinkNotification(null);
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="font-display font-bold text-[var(--ink-soft)] animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  if (resolveLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--paper)" }}>
        <div className="font-display font-bold text-[var(--ink-soft)] animate-pulse">Loading household…</div>
      </div>
    );
  }

  if (!household || !currentMember) {
    return <OnboardingScreen userEmail={session.user.email} onCreated={resolveHousehold} />;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <div className="max-w-md mx-auto min-h-screen relative" style={{ background: "var(--paper)" }}>
        <div className="sticky top-0 z-10 px-4 pt-4 pb-2 flex items-center justify-between" style={{ background: "var(--paper)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-[var(--ink-soft)]">
              {household.name}
            </div>
            <div className="font-display font-bold text-lg -mt-0.5">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-display font-bold text-sm shrink-0"
            style={{ background: tapeHex(currentMember) }}
            title={currentMember.name}
          >
            {currentMember.name[0]?.toUpperCase()}
          </div>
        </div>

        {tab === "rota" && (
          <RotaTab
            householdId={household.id}
            activeMembers={activeMembers}
            isAdmin={isAdmin}
            memberById={memberById}
            monthKey={rotaMonth}
            setMonthKey={setRotaMonth}
          />
        )}
        {tab === "money" && (
          <MoneyTab
            householdId={household.id}
            activeMembers={activeMembers}
            currentMember={currentMember}
            isAdmin={isAdmin}
            memberById={memberById}
            monthKey={moneyMonth}
            setMonthKey={setMoneyMonth}
          />
        )}
        {tab === "status" && (
          <StatusTab
            householdId={household.id}
            activeMembers={activeMembers}
            currentMember={currentMember}
            isAdmin={isAdmin}
            monthKey={statusMonth}
            setMonthKey={setStatusMonth}
          />
        )}
        {tab === "alerts" && <NotificationsTab currentMember={currentMember} />}
        {tab === "me" && (
          <MeTab
            currentMember={currentMember}
            members={members}
            householdId={household.id}
            houseName={household.name}
            refreshMembers={refreshMembers}
            refreshHouseName={refreshHouseName}
            isAdmin={isAdmin}
          />
        )}

        <NotificationDetailModal
          notification={deepLinkNotification}
          onAcknowledge={acknowledgeDeepLink}
          onClose={() => setDeepLinkNotification(null)}
        />

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t" style={{ background: "var(--stub)", borderColor: "var(--line)" }}>
          <div className="grid grid-cols-5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex flex-col items-center gap-1 py-2.5"
                  style={{ color: active ? "var(--ink)" : "var(--ink-soft)" }}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
