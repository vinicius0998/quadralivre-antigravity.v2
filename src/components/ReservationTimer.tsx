import { useState, useEffect } from "react";
import { Timer, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  endTime: string; // HH:mm format
  date: string; // YYYY-MM-DD
  extraTime: number; // minutes
  status: string;
}

export default function ReservationTimer({ endTime, date, extraTime, status }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "agendado") return;

    const calcRemaining = () => {
      const [h, m] = endTime.split(":").map(Number);
      const end = new Date(`${date}T${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`);
      end.setMinutes(end.getMinutes() + extraTime);
      const diff = end.getTime() - Date.now();
      return Math.floor(diff / 1000);
    };

    setRemaining(calcRemaining());
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, [endTime, date, extraTime, status]);

  if (status === "encerrado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        <CheckCircle2 size={12} /> Encerrado
      </span>
    );
  }

  if (status === "cancelado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
        ✕ Cancelado
      </span>
    );
  }

  if (remaining === null) return null;

  if (remaining <= 0) {
    const overMinutes = Math.abs(Math.ceil(remaining / 60));
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] font-bold text-destructive animate-pulse">
        <AlertTriangle size={12} />
        +{overMinutes}min extra
      </span>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 600; // 10 min

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums ${
      isUrgent ? "bg-pending/15 text-pending animate-pulse" : "bg-accent/10 text-accent"
    }`}>
      <Timer size={12} />
      {hours > 0 && `${hours}h `}{minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
