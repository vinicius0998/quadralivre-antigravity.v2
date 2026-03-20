import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Reservation = Tables<"reservations">;

interface Props {
  profileUserId: string;
  courts: Tables<"courts">[];
  onCancelled?: () => void;
  onClose: () => void;
}

export default function CancelBookingFlow({ profileUserId, courts, onCancelled, onClose }: Props) {
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Reservation[] | null>(null);
  const [cancellationLimit, setCancellationLimit] = useState<number>(0);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const getCourtName = (id: string) => courts.find((c) => c.id === id)?.name ?? "—";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSearching(true);
    const cleaned = phone.replace(/\D/g, "");
    
    // Fetch both reservations and the arena's cancellation limit
    const [{ data: reservationsData }, { data: profileData }] = await Promise.all([
      supabase
        .from("reservations")
        .select("*")
        .eq("user_id", profileUserId)
        .eq("client_phone", cleaned)
        .eq("status", "agendado")
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date")
        .order("start_time"),
      supabase
        .from("profiles")
        .select("cancellation_limit_hours")
        .eq("user_id", profileUserId)
        .single()
    ]);

    if (profileData) setCancellationLimit(profileData.cancellation_limit_hours ?? 0);
    setResults(reservationsData ?? []);
    setSearching(false);
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    await supabase.from("reservations").update({ status: "cancelado" }).eq("id", id);
    setCancelling(null);
    setDone(true);
    setResults((prev) => prev?.filter((r) => r.id !== id) ?? []);
    onCancelled?.();
  };

  const inputClass = "w-full rounded-lg border-0 bg-subtle px-4 py-3 text-base text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena placeholder:text-muted-foreground/50";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground tracking-tight">Cancelar reserva</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle text-muted-foreground hover:text-foreground transition-arena">
          <X size={16} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Digite seu número de telefone para buscar suas reservas.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="tel"
          placeholder="Seu telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={searching}
          className="flex-shrink-0 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-arena hover:brightness-95 disabled:opacity-50"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </form>

      {done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-accent/10 p-3 mb-4 text-sm text-accent font-medium text-center">
          ✓ Reserva cancelada com sucesso!
        </motion.div>
      )}

      <AnimatePresence>
        {results !== null && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            {results.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nenhuma reserva ativa encontrada para este telefone.
              </p>
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <div key={r.id} className="rounded-xl bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{getCourtName(r.court_id)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(r.date + "T12:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {r.start_time.substring(0, 5)} - {r.end_time.substring(0, 5)}
                        </p>
                        <p className="text-xs text-muted-foreground">{r.sport}</p>
                      </div>
                      {(() => {
                        const start = new Date(`${r.date}T${r.start_time}`);
                        const now = new Date();
                        const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
                        const canCancel = diffHours >= cancellationLimit;

                        return (
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              onClick={() => handleCancel(r.id)}
                              disabled={cancelling === r.id || !canCancel}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-arena disabled:opacity-50 ${
                                canCancel 
                                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20" 
                                  : "bg-muted text-muted-foreground cursor-not-allowed"
                              }`}
                            >
                              {cancelling === r.id ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                              Cancelar
                            </button>
                            {!canCancel && (
                              <p className="text-[10px] text-destructive font-medium max-w-[120px] text-right">
                                Limite de {cancellationLimit}h excedido
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
