import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, MapPin, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Court = Tables<"courts">;

const sportTypes = ["Beach Tennis", "Vôlei", "Futsal", "Futebol", "Futevôlei", "Tênis", "Padel"];

export default function CourtsPage() {
  const { user } = useAuth();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>(["Beach Tennis"]);
  const [pricePerHour, setPricePerHour] = useState("");

  const fetchCourts = async () => {
    if (!user) return;
    const { data } = await supabase.from("courts").select("*").eq("user_id", user.id).order("created_at");
    setCourts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCourts(); }, [user]);

  const resetForm = () => { setName(""); setSelectedSports(["Beach Tennis"]); setPricePerHour(""); setEditingId(null); setShowForm(false); };

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.length > 1 ? prev.filter((s) => s !== sport) : prev
        : [...prev, sport]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const price = parseFloat(pricePerHour) || 0;
    const type = selectedSports.join(",");

    if (editingId) {
      const { error } = await supabase.from("courts").update({ name, type, price_per_hour: price }).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar quadra."); return; }
      toast.success("Quadra atualizada!");
    } else {
      const { error } = await supabase.from("courts").insert({ name, type, price_per_hour: price, user_id: user.id });
      if (error) { toast.error("Erro ao criar quadra."); return; }
      toast.success("Quadra adicionada!");
    }
    resetForm();
    fetchCourts();
  };

  const toggleActive = async (court: Court) => {
    await supabase.from("courts").update({ active: !court.active }).eq("id", court.id);
    fetchCourts();
  };

  const removeCourt = async (id: string) => {
    const { error } = await supabase.from("courts").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover. Pode haver reservas vinculadas."); return; }
    toast.success("Quadra removida.");
    fetchCourts();
  };

  const startEdit = (court: Court) => {
    setEditingId(court.id);
    setName(court.name);
    setSelectedSports(court.type.split(",").map((s) => s.trim()).filter(Boolean));
    setPricePerHour(court.price_per_hour.toString());
    setShowForm(true);
  };

  const inputClass = "w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Quadras</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie suas quadras esportivas</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg hover:-translate-y-px"
        >
          <Plus size={16} />
          Adicionar Quadra
        </button>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingId ? "Editar Quadra" : "Nova Quadra"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nome da quadra</label>
              <input type="text" placeholder="Quadra 1" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Tipos de esporte</label>
              <p className="text-[11px] text-muted-foreground">Selecione um ou mais esportes</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {sportTypes.map((sport) => {
                  const active = selectedSports.includes(sport);
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => toggleSport(sport)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-arena ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-subtle text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                      }`}
                    >
                      {sport}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Preço por hora (R$)</label>
              <input type="number" placeholder="100.00" value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} className={inputClass} step="0.01" min="0" />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg"
            >
              {editingId ? "Atualizar" : "Salvar"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Courts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courts.map((court, i) => {
          const sports = court.type.split(",").map((s) => s.trim()).filter(Boolean);
          return (
            <motion.div
              key={court.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl bg-card p-5 shadow-card transition-arena hover:shadow-[var(--card-shadow-lg)] ${!court.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <MapPin size={22} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{court.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sports.map((s) => (
                        <span key={s} className="inline-flex items-center rounded-md bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(court)}
                  className={`relative h-7 w-12 rounded-full transition-arena ${court.active ? "bg-accent" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-card shadow-sm transition-arena ${court.active ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <DollarSign size={14} className="text-accent" />
                  R$ {Number(court.price_per_hour).toFixed(2)}/h
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${court.active ? "text-accent" : "text-muted-foreground"}`}>
                    {court.active ? "Ativa" : "Inativa"}
                  </span>
                  <button onClick={() => startEdit(court)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-arena">
                    <Pencil size={15} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => removeCourt(court.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-arena">
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {courts.length === 0 && (
        <div className="rounded-2xl bg-card p-12 shadow-card text-center">
          <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-subtle text-2xl">🏟️</div>
          <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em "Adicionar Quadra" para começar.</p>
        </div>
      )}
    </>
  );
}
