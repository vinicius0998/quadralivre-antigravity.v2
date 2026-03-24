import { useState, useEffect, useMemo } from "react";
import { Plus, CalendarDays, Clock, ArrowRight, MapPin, ChevronLeft, ChevronRight, Hourglass, Check, X } from "lucide-react";
import { motion } from "framer-motion";

import NewReservationDialog from "@/components/NewReservationDialog";
import ReservationTimer from "@/components/ReservationTimer";
import ExtraTimeDialog from "@/components/ExtraTimeDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

type Court = Tables<"courts">;
type Reservation = Tables<"reservations"> & { extra_time: number };
type ScheduleConfig = Tables<"schedule_configs">;

export default function DashboardPage() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPreset, setDialogPreset] = useState<{ courtId?: string; time?: string } | undefined>(undefined);
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [extraTimeTarget, setExtraTimeTarget] = useState<Reservation | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [pendingReservations, setPendingReservations] = useState<(Reservation & { court_name?: string })[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const selectedDow = new Date(selectedDate + "T12:00").getDay(); // 0=Sun

  const timeSlots = useMemo(() => {
    const todayConfigs = scheduleConfigs.filter((c) => c.day_of_week === selectedDow);
    if (todayConfigs.length === 0) {
      // fallback: 06:00-23:00
      return Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, "0")}:00`);
    }
    const minStart = todayConfigs.reduce((min, c) => (c.start_time < min ? c.start_time : min), todayConfigs[0].start_time);
    const maxEnd = todayConfigs.reduce((max, c) => (c.end_time > max ? c.end_time : max), todayConfigs[0].end_time);
    const startH = parseInt(minStart.split(":")[0]);
    const endH = parseInt(maxEnd.split(":")[0]);
    const slots: string[] = [];
    for (let h = startH; h < endH; h++) {
      slots.push(`${h.toString().padStart(2, "0")}:00`);
    }
    return slots;
  }, [scheduleConfigs, selectedDow]);

  const fetchData = async () => {
    if (!user) return;
    const [courtsRes, reservationsRes, scheduleRes, pendingRes] = await Promise.all([
      supabase.from("courts").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("reservations").select("*").eq("user_id", user.id).eq("date", selectedDate),
      supabase.from("schedule_configs").select("*").eq("user_id", user.id),
      supabase.from("reservations").select("*, courts(name)").eq("user_id", user.id).eq("status", "aguardando_confirmacao"),
    ]);
    setCourts(courtsRes.data ?? []);
    setReservations((reservationsRes.data as Reservation[]) ?? []);
    setScheduleConfigs(scheduleRes.data ?? []);
    const pending = (pendingRes.data ?? []).map((r: any) => ({ ...r, court_name: r.courts?.name }));
    setPendingReservations(pending);
    setLoading(false);
  };

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    await supabase.from("reservations").update({ status: "confirmada" }).eq("id", id);
    setConfirmingId(null);
    fetchData();
  };

  const handleCancel = async (id: string) => {
    setConfirmingId(id);
    await supabase.from("reservations").update({ status: "cancelado" }).eq("id", id);
    setConfirmingId(null);
    fetchData();
  };

  // Auto-encerrar reservations that have passed
  useEffect(() => {
    if (reservations.length === 0) return;
    const interval = setInterval(async () => {
      const now = new Date();
      const _currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      const toClose = reservations.filter((r) => {
        if (r.status !== "agendado" || r.date !== today) return false;
        const [h, m] = r.end_time.split(":").map(Number);
        const endWithExtra = h * 60 + m + (r.extra_time || 0);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return nowMinutes >= endWithExtra;
      });
      if (toClose.length > 0) {
        await Promise.all(
          toClose.map((r) =>
            supabase.from("reservations").update({ status: "encerrado" }).eq("id", r.id)
          )
        );
        fetchData();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [reservations, today]);

  useEffect(() => { fetchData(); }, [user, selectedDate]);

  const navigateDay = (delta: number) => {
    const d = new Date(selectedDate + "T12:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const activeCourts = courts;
  const activeReservations = reservations.filter((r) => r.status === "agendado");
  const totalSlots = activeCourts.length * timeSlots.length;
  const occupiedSlots = activeReservations.length;
  const freeSlots = totalSlots - occupiedSlots;

  const now = new Date().toTimeString().slice(0, 5);
  const currentHour = parseInt(now.split(":")[0]);
  const nextReservation = activeReservations
    .filter((r) => r.start_time >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const courtColors = ["bg-primary/10 text-primary", "bg-accent/10 text-accent", "bg-pending/10 text-pending", "bg-destructive/10 text-destructive"];

  const statusLabel = (s: string) => {
    if (s === "agendado") return { text: "🟢 Agendado", cls: "bg-accent/15 text-accent" };
    if (s === "encerrado") return { text: "⏹ Encerrado", cls: "bg-muted text-muted-foreground" };
    return { text: "✕ Cancelado", cls: "bg-destructive/15 text-destructive" };
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Painel</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => navigateDay(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-subtle text-muted-foreground hover:bg-muted transition-arena">
              <ChevronLeft size={15} />
            </button>
            <p className="text-sm text-muted-foreground capitalize">
              {new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              {selectedDate === today && <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">Hoje</span>}
            </p>
            <button onClick={() => navigateDay(1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-subtle text-muted-foreground hover:bg-muted transition-arena">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <button
          onClick={() => { setDialogPreset(undefined); setDialogOpen(true); }}
          className="flex items-center gap-2 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg hover:-translate-y-px"
        >
          <Plus size={16} />
          Nova Reserva
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        <StatCard label="Agendados hoje" value={activeReservations.length} icon={CalendarDays} color="primary" />
        <StatCard label="Horários livres" value={freeSlots} icon={Clock} color="accent" />
        <StatCard
          label="Próxima reserva"
          value={nextReservation ? nextReservation.start_time.slice(0, 5) : "—"}
          subtitle={nextReservation?.client_name}
          icon={ArrowRight}
          color="pending"
        />
      </div>

      {/* Pending confirmations */}
      {pendingReservations.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hourglass size={15} className="text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-400">Reservas aguardando confirmação</h2>
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{pendingReservations.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {pendingReservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-card border border-amber-100 dark:border-amber-900/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.client_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {r.sport} • {r.start_time.slice(0,5)}–{r.end_time.slice(0,5)} • {r.court_name ?? "Quadra"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.date + "T12:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleConfirm(r.id)}
                    disabled={confirmingId === r.id}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:brightness-95 transition-arena disabled:opacity-50"
                  >
                    <Check size={12} /> Confirmar
                  </button>
                  <button
                    onClick={() => handleCancel(r.id)}
                    disabled={confirmingId === r.id}
                    className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/5 transition-arena disabled:opacity-50"
                  >
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Grid */}
      {activeCourts.length === 0 ? (
        <div className="rounded-2xl bg-card p-12 shadow-card text-center">
          <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-subtle">
            <MapPin size={24} className="text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Nenhuma quadra cadastrada.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Vá em <strong>Quadras</strong> para adicionar.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header */}
              <div
                className="grid bg-subtle/80 border-b border-border sticky top-0 z-10"
                style={{ gridTemplateColumns: `72px repeat(${activeCourts.length}, 1fr)` }}
              >
                <div className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Hora</div>
                {activeCourts.map((court, idx) => (
                  <div key={court.id} className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${courtColors[idx % courtColors.length]}`}>
                      {court.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {timeSlots.map((time) => {
                const hour = parseInt(time.split(":")[0]);
                const isNow = hour === currentHour;
                return (
                  <div
                    key={time}
                    className={`grid border-t transition-arena ${isNow ? "border-t-2 border-t-destructive/50 bg-destructive/[0.02]" : "border-border"}`}
                    style={{ gridTemplateColumns: `72px repeat(${activeCourts.length}, 1fr)`, minHeight: "68px" }}
                  >
                    <div className="flex items-start px-4 py-3 relative">
                      <span className={`text-xs font-semibold tabular-nums ${isNow ? "text-destructive" : "text-muted-foreground"}`}>
                        {time}
                      </span>
                      {isNow && <div className="absolute right-0 top-1/2 w-2 h-2 rounded-full bg-destructive animate-pulse" />}
                    </div>
                    {activeCourts.map((court) => {
                      // Find reservation that starts at this time
                      const reservation = reservations.find(
                        (r) => r.court_id === court.id && r.start_time.slice(0, 5) === time
                      );
                      // Check if this slot is covered by a reservation that started earlier
                      const coveredBy = !reservation && reservations.find((r) => {
                        if (r.court_id !== court.id) return false;
                        const rStartH = parseInt(r.start_time.split(":")[0]);
                        const rEndH = parseInt(r.end_time.split(":")[0]);
                        const rEndM = parseInt(r.end_time.split(":")[1] || "0");
                        const effectiveEndH = rEndM > 0 ? rEndH + 1 : rEndH;
                        return hour > rStartH && hour < effectiveEndH;
                      });

                      if (coveredBy) {
                        // This slot is part of a multi-hour reservation, render empty (spanned visually)
                        return <div key={court.id} className="relative px-2 py-1.5" />;
                      }

                      // Calculate row span for multi-hour reservations
                      let spanRows = 1;
                      if (reservation) {
                        const startH = parseInt(reservation.start_time.split(":")[0]);
                        const endH = parseInt(reservation.end_time.split(":")[0]);
                        const endM = parseInt(reservation.end_time.split(":")[1] || "0");
                        spanRows = endH - startH + (endM > 0 ? 1 : 0);
                        spanRows = Math.max(1, spanRows);
                      }

                      return (
                        <div key={court.id} className="relative px-2 py-1.5 group" style={reservation && spanRows > 1 ? { gridRow: `span 1` } : undefined}>
                          {reservation ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              style={spanRows > 1 ? { height: `${spanRows * 68 - 12}px`, position: "absolute", left: 8, right: 8, top: 6, zIndex: 5 } : undefined}
                              className={`rounded-xl p-3 cursor-pointer ${spanRows <= 1 ? "h-full" : ""} ${
                                reservation.status === "agendado"
                                  ? "bg-accent/8 border border-accent/20"
                                  : reservation.status === "encerrado"
                                  ? "bg-muted/50 border border-border"
                                  : "bg-destructive/5 border border-destructive/15 opacity-60"
                              }`}
                              onClick={() => reservation.status === "agendado" && setExtraTimeTarget(reservation)}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-xs font-bold text-foreground">{reservation.client_name}</p>
                                {reservation.status === "agendado" && (
                                  <ReservationTimer
                                    endTime={reservation.end_time}
                                    date={reservation.date}
                                    extraTime={reservation.extra_time || 0}
                                    status={reservation.status}
                                  />
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {reservation.sport} • {reservation.start_time.slice(0, 5)}–{reservation.end_time.slice(0, 5)}
                                {(reservation.extra_time || 0) > 0 && ` +${reservation.extra_time}min`}
                              </p>
                              <span className={`mt-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusLabel(reservation.status).cls}`}>
                                {statusLabel(reservation.status).text}
                              </span>
                            </motion.div>
                          ) : (
                            <div className="flex h-full items-center justify-center opacity-0 group-hover:opacity-100 transition-arena">
                              <button
                                onClick={() => { setDialogPreset({ courtId: court.id, time }); setDialogOpen(true); }}
                                className="flex h-8 w-8 items-center justify-center rounded-xl bg-subtle text-muted-foreground hover:gradient-primary hover:text-primary-foreground transition-arena shadow-sm"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <NewReservationDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setDialogPreset(undefined); }} onCreated={fetchData} presetCourtId={dialogPreset?.courtId} presetTime={dialogPreset?.time} />

      {extraTimeTarget && (
        <ExtraTimeDialog
          open={!!extraTimeTarget}
          onOpenChange={(open) => !open && setExtraTimeTarget(null)}
          reservationId={extraTimeTarget.id}
          clientName={extraTimeTarget.client_name}
          currentExtraTime={extraTimeTarget.extra_time || 0}
          onUpdated={fetchData}
        />
      )}
    </>
  );
}

const colorMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  pending: "bg-pending/10 text-pending",
};

function StatCard({ label, value, subtitle, icon: Icon, color = "primary" }: { label: string; value: string | number; subtitle?: string; icon: React.ElementType; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card p-5 shadow-card hover:shadow-[var(--card-shadow-lg)] transition-arena"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[color] || colorMap.primary}`}>
          <Icon size={18} strokeWidth={1.5} />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </motion.div>
  );
}
