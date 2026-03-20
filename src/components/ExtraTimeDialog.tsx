import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Minus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  clientName: string;
  currentExtraTime: number;
  onUpdated?: () => void;
}

export default function ExtraTimeDialog({ open, onOpenChange, reservationId, clientName, currentExtraTime, onUpdated }: Props) {
  const [minutes, setMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({ extra_time: currentExtraTime + minutes })
      .eq("id", reservationId);
    setSaving(false);
    if (error) { toast.error("Erro ao adicionar tempo."); return; }
    toast.success(`+${minutes}min adicionados para ${clientName}`);
    onOpenChange(false);
    onUpdated?.();
  };

  const inputClass = "w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl shadow-card border-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Hora Extra</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Adicionar tempo extra para <strong>{clientName}</strong>
        </p>
        {currentExtraTime > 0 && (
          <p className="text-xs text-pending font-medium">Já tem +{currentExtraTime}min extra</p>
        )}
        <div className="flex items-center justify-center gap-4 my-4">
          <button
            onClick={() => setMinutes(Math.max(15, minutes - 15))}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-foreground hover:bg-muted transition-arena"
          >
            <Minus size={18} />
          </button>
          <span className="text-3xl font-extrabold text-foreground tabular-nums w-24 text-center">{minutes}min</span>
          <button
            onClick={() => setMinutes(minutes + 15)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-subtle text-foreground hover:bg-muted transition-arena"
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : `Adicionar +${minutes}min`}
        </button>
      </DialogContent>
    </Dialog>
  );
}
