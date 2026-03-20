import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Trash2, Filter, X, Phone, Calendar, Clock } from "lucide-react";
import { motion } from "framer-motion";
import ExtraTimeDialog from "@/components/ExtraTimeDialog";

type Reservation = Tables<"reservations"> & { extra_time: number };
type Court = Tables<"courts">;

export default function ReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourt, setFilterCourt] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [extraTimeTarget, setExtraTimeTarget] = useState<Reservation | null>(null);

  const fetchData = async () => {
    if (!user) return;
    const [rRes, cRes] = await Promise.all([
      supabase.from("reservations").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("courts").select("*").eq("user_id", user.id),
    ]);
    setReservations((rRes.data as Reservation[]) ?? []);
    setCourts(cRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const getCourtName = (id: string) => courts.find((c) => c.id === id)?.name ?? "—";

  const filtered = reservations.filter((r) => {
    if (filterCourt && r.court_id !== filterCourt) return false;
    if (filterDate && r.date !== filterDate) return false;
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status }).eq("id", id);
    const labels: Record<string, string> = { agendado: "Reserva agendada!", cancelado: "Reserva cancelada.", encerrado: "Reserva encerrada." };
    toast.success(labels[status] || "Status atualizado.");
    fetchData();
  };

  const deleteReservation = async (id: string) => {
    await supabase.from("reservations").delete().eq("id", id);
    toast.success("Reserva excluída.");
    fetchData();
  };

  const statusColor = (s: string) => {
    if (s === "agendado") return "bg-accent/10 text-accent";
    if (s === "encerrado") return "bg-muted text-muted-foreground";
    return "bg-destructive/10 text-destructive";
  };

  const inputClass = "rounded-xl border-0 bg-subtle px-3.5 py-2.5 text-sm text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Reservas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Lista completa de reservas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
        </div>
        <select value={filterCourt} onChange={(e) => setFilterCourt(e.target.value)} className={inputClass}>
          <option value="">Todas as quadras</option>
          {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={inputClass} />
        {(filterCourt || filterDate) && (
          <button
            onClick={() => { setFilterCourt(""); setFilterDate(""); }}
            className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-arena"
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-subtle/80 border-b border-border">
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quadra</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Horário</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Esporte</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className={`transition-arena hover:bg-subtle/50 ${i % 2 === 1 ? "bg-subtle/30" : ""}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {r.client_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{r.client_name}</p>
                      {r.client_phone && <p className="text-[11px] text-muted-foreground">{r.client_phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{getCourtName(r.court_id)}</td>
                <td className="px-5 py-3.5 text-muted-foreground tabular-nums">{new Date(r.date + "T12:00").toLocaleDateString("pt-BR")}</td>
                <td className="px-5 py-3.5">
                  <span className="text-muted-foreground tabular-nums">{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</span>
                  {(r.extra_time || 0) > 0 && (
                    <span className="ml-1 text-[10px] font-medium text-pending">+{r.extra_time}min</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center rounded-lg bg-subtle px-2 py-1 text-xs font-medium text-foreground">
                    {r.sport}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold border-0 outline-none cursor-pointer transition-arena ${statusColor(r.status)}`}
                  >
                    <option value="agendado">Agendado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    {r.status === "agendado" && (
                      <button
                        onClick={() => setExtraTimeTarget(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-pending/10 hover:text-pending transition-arena"
                        title="Hora extra"
                      >
                        <Clock size={15} strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteReservation(r.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-arena"
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-16 text-center text-muted-foreground text-sm">Nenhuma reserva encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {r.client_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{r.client_name}</p>
                  <p className="text-xs text-muted-foreground">{getCourtName(r.court_id)}</p>
                </div>
              </div>
              <select
                value={r.status}
                onChange={(e) => updateStatus(r.id, e.target.value)}
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold border-0 outline-none ${statusColor(r.status)}`}
              >
                <option value="agendado">Agendado</option>
                <option value="cancelado">Cancelado</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(r.date + "T12:00").toLocaleDateString("pt-BR")}</span>
              <span className="tabular-nums">
                {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                {(r.extra_time || 0) > 0 && <span className="text-pending font-medium"> +{r.extra_time}min</span>}
              </span>
              <span className="rounded-md bg-subtle px-1.5 py-0.5 font-medium text-foreground">{r.sport}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                {r.client_phone && (
                  <a href={`tel:${r.client_phone}`} className="flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Phone size={12} /> {r.client_phone}
                  </a>
                )}
                {r.status === "agendado" && (
                  <button
                    onClick={() => setExtraTimeTarget(r)}
                    className="flex items-center gap-1.5 text-xs text-pending font-medium"
                  >
                    <Clock size={12} /> Hora extra
                  </button>
                )}
              </div>
              <button
                onClick={() => deleteReservation(r.id)}
                className="flex items-center gap-1.5 text-xs text-destructive font-medium ml-auto"
              >
                <Trash2 size={12} /> Excluir
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card p-12 shadow-card text-center text-sm text-muted-foreground">
            Nenhuma reserva encontrada.
          </div>
        )}
      </div>

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
