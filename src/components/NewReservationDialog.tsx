import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";

type Court = Tables<"courts">;
type ScheduleConfig = Tables<"schedule_configs">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  presetCourtId?: string;
  presetTime?: string;
}

export default function NewReservationDialog({ open, onOpenChange, onCreated, presetCourtId, presetTime }: Props) {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("17:00");
  const [duration, setDuration] = useState(60);
  const [sport, setSport] = useState("");
  const [saving, setSaving] = useState(false);

  const hasPreset = !!presetCourtId;

  useEffect(() => {
    if (open && user) {
      Promise.all([
        supabase.from("courts").select("*").eq("user_id", user.id).eq("active", true),
        supabase.from("schedule_configs").select("*").eq("user_id", user.id),
      ]).then(([courtsRes, schedRes]) => {
        setCourts(courtsRes.data ?? []);
        setScheduleConfigs(schedRes.data ?? []);
      });
    }
  }, [open, user]);

  // Apply presets when dialog opens
  useEffect(() => {
    if (open && presetCourtId) {
      setCourtId(presetCourtId);
    }
    if (open && presetTime) {
      setStartTime(presetTime);
    }
    if (open) {
      setDuration(60);
    }
  }, [open, presetCourtId, presetTime]);

  const selectedCourt = courts.find((c) => c.id === courtId);
  const courtSports = selectedCourt ? selectedCourt.type.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  const config = scheduleConfigs.find((s) => s.day_of_week === dayOfWeek);

  const minInterval = config?.min_interval || 60;

  const endTime = useMemo(() => {
    const [h, m] = startTime.split(":").map(Number);
    const endM = h * 60 + m + duration;
    return `${Math.floor(endM / 60).toString().padStart(2, "0")}:${(endM % 60).toString().padStart(2, "0")}`;
  }, [startTime, duration]);

  // Auto-select first sport when court changes
  useEffect(() => {
    if (courtSports.length > 0 && !courtSports.includes(sport)) {
      setSport(courtSports[0]);
    }
  }, [courtId, courts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !courtId) return;
    setSaving(true);
    const { error } = await supabase.from("reservations").insert({
      user_id: user.id, court_id: courtId, client_name: clientName,
      client_phone: clientPhone || null, date, start_time: startTime,
      end_time: endTime, sport: sport || "Beach Tennis", status: "agendado",
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar reserva."); return; }
    toast.success("Reserva criada!");
    setClientName(""); setClientPhone(""); setCourtId(""); setStartTime("17:00"); setDuration(60); setSport("");
    onOpenChange(false);
    onCreated?.();
  };

  const inputClass = "w-full rounded-xl border-0 bg-subtle px-4 py-3 text-base text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  const formatDuration = (d: number) => {
    if (d % 60 === 0) return `${d / 60}h`;
    const h = Math.floor(d / 60);
    const m = d % 60;
    return h > 0 ? `${h}h${m}min` : `${m}min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl shadow-card border-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Nova Reserva</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome do cliente</label>
            <input type="text" placeholder="Nome completo" value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Telefone (opcional)</label>
            <input type="tel" placeholder="+5511999999999" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} />
          </div>

          {/* Court selector - only when no preset */}
          {!hasPreset && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Quadra</label>
              <select value={courtId} onChange={(e) => setCourtId(e.target.value)} className={inputClass} required>
                <option value="">Selecione a quadra</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Show court name when preset */}
          {hasPreset && selectedCourt && (
            <div className="rounded-lg bg-subtle px-4 py-2.5 text-xs text-muted-foreground">
              Quadra: <span className="font-medium text-foreground">{selectedCourt.name}</span>
            </div>
          )}

          {courtSports.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Esporte</label>
              {courtSports.length === 1 ? (
                <p className="text-sm text-foreground px-1">{courtSports[0]}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {courtSports.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSport(s)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-arena ${
                        sport === s
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-subtle text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>

          {/* Duration stepper */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Duração</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(minInterval, d - minInterval))}
                disabled={duration <= minInterval}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground transition-arena disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span className="text-sm font-bold text-foreground min-w-[48px] text-center">{formatDuration(duration)}</span>
              <button
                type="button"
                onClick={() => setDuration((d) => d + minInterval)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground transition-arena"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {!hasPreset && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Início</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
            </div>
          )}

          <div className="rounded-lg bg-subtle px-4 py-2.5 text-xs text-muted-foreground">
            Horário: <span className="font-medium text-foreground">{startTime} – {endTime}</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg hover:-translate-y-px disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Salvar Reserva"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
