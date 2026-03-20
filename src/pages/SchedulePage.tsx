import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ScheduleConfig = Tables<"schedule_configs">;

const dayNames: Record<number, string> = {
  0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado",
};

const dayShort: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

const dayColors: Record<number, string> = {
  0: "bg-destructive/10 text-destructive border-destructive/20",
  1: "bg-primary/10 text-primary border-primary/20",
  2: "bg-accent/10 text-accent border-accent/20",
  3: "bg-pending/10 text-pending border-pending/20",
  4: "bg-primary/10 text-primary border-primary/20",
  5: "bg-accent/10 text-accent border-accent/20",
  6: "bg-pending/10 text-pending border-pending/20",
};

export default function SchedulePage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [minInterval, setMinInterval] = useState("60");
  const [defaultDuration, setDefaultDuration] = useState("60");

  const fetchConfigs = async () => {
    if (!user) return;
    const { data } = await supabase.from("schedule_configs").select("*").eq("user_id", user.id).order("day_of_week");
    setConfigs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchConfigs(); }, [user]);

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const resetForm = () => {
    setSelectedDays([1, 2, 3, 4, 5]);
    setStartTime("08:00");
    setEndTime("22:00");
    setMinInterval("60");
    setDefaultDuration("60");
    setEditingId(null);
  };

  const handleEdit = (cfg: ScheduleConfig) => {
    setEditingId(cfg.id);
    setSelectedDays([cfg.day_of_week]);
    setStartTime(cfg.start_time.slice(0, 5));
    setEndTime(cfg.end_time.slice(0, 5));
    setMinInterval(String(cfg.min_interval));
    setDefaultDuration(String(cfg.default_duration));
    setShowForm(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedDays.length === 0) { toast.error("Selecione pelo menos um dia."); return; }

    if (editingId) {
      // Update existing config
      const { error } = await supabase.from("schedule_configs").update({
        start_time: startTime,
        end_time: endTime,
        min_interval: parseInt(minInterval),
        default_duration: parseInt(defaultDuration),
      }).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar horário."); return; }
      toast.success("Horário atualizado!");
    } else {
      const rows = selectedDays.map((day) => ({
        user_id: user.id,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        min_interval: parseInt(minInterval),
        default_duration: parseInt(defaultDuration),
      }));

      await supabase.from("schedule_configs").delete().eq("user_id", user.id).in("day_of_week", selectedDays);
      const { error } = await supabase.from("schedule_configs").insert(rows);
      if (error) { toast.error("Erro ao salvar horários."); return; }
      toast.success("Horários salvos!");
    }

    setShowForm(false);
    resetForm();
    fetchConfigs();
  };

  const removeConfig = async (id: string) => {
    await supabase.from("schedule_configs").delete().eq("id", id);
    toast.success("Horário removido.");
    fetchConfigs();
  };

  const inputClass = "w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  // Group configs by day
  const configsByDay = new Map<number, ScheduleConfig>();
  configs.forEach((c) => configsByDay.set(c.day_of_week, c));

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Horários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure os horários de funcionamento</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg hover:-translate-y-px"
        >
          <Plus size={16} />
          Novo Horário
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
            <form onSubmit={handleAdd} className="max-w-lg space-y-5 rounded-2xl bg-card p-6 shadow-card">
              <div>
                <label className="text-xs font-semibold text-foreground mb-3 block">
                  {editingId ? "Editando dia" : "Dias da semana"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => !editingId && toggleDay(d)}
                      disabled={!!editingId}
                      className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-arena min-w-[48px] ${
                        selectedDays.includes(d)
                          ? "gradient-primary text-primary-foreground shadow-sm"
                          : "bg-subtle text-muted-foreground ring-1 ring-border hover:ring-primary/50"
                      } ${editingId ? "cursor-default opacity-60" : ""}`}
                    >
                      {dayShort[d]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Início</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Fim</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Intervalo mínimo (min)</label>
                  <input type="number" value={minInterval} onChange={(e) => setMinInterval(e.target.value)} className={inputClass} min="15" step="15" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Duração padrão (min)</label>
                  <input type="number" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} className={inputClass} min="15" step="15" />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg"
              >
                {editingId ? "Atualizar Horário" : "Salvar Horários"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly view */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const cfg = configsByDay.get(day);
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: day * 0.04 }}
              className={`rounded-2xl bg-card p-5 shadow-card transition-arena hover:shadow-[var(--card-shadow-lg)] ${!cfg ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-bold border ${dayColors[day]}`}>
                  {dayNames[day]}
                </span>
                {cfg && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(cfg)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-arena"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => removeConfig(cfg.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-arena"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
              {cfg ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-primary" />
                    <span className="text-lg font-extrabold text-foreground tabular-nums">
                      {cfg.start_time.slice(0, 5)}
                    </span>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-lg font-extrabold text-foreground tabular-nums">
                      {cfg.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-xl bg-subtle px-3 py-2 flex-1 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Intervalo</p>
                      <p className="text-sm font-bold text-foreground">{cfg.min_interval}min</p>
                    </div>
                    <div className="rounded-xl bg-subtle px-3 py-2 flex-1 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Duração</p>
                      <p className="text-sm font-bold text-foreground">{cfg.default_duration}min</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sem horário configurado</p>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
