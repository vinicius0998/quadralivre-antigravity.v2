import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, ChevronLeft, Loader2, CalendarDays, Clock, CheckCircle2, XCircle, Calendar, Plus, Minus, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import logo from "@/assets/quadralivre-logo.png";
import CancelBookingFlow from "@/components/CancelBookingDialog";

type Profile = Tables<"profiles">;
type Court = Tables<"courts">;
type Reservation = Tables<"reservations">;
type ScheduleConfig = Tables<"schedule_configs">;

type Step = "home" | "courts" | "times" | "form" | "payment" | "manual_payment" | "manual_waiting" | "done" | "cancel";

function PixPolling({ reservationId, onPaid }: { reservationId: string | null; onPaid: () => void }) {
  useEffect(() => {
    if (!reservationId) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/check-payment?reservationId=${reservationId}`);
        const data = await response.json();
        if (data?.paid) {
          clearInterval(interval);
          onPaid();
        }
      } catch (e) {
        // ignora erros de rede
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [reservationId, onPaid]);
  return null;
}

export default function PublicBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Selection state
  const [step, setStep] = useState<Step>("home");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState("");

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [observation, setObservation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixCode, setPixCode] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [manualAmount, setManualAmount] = useState(0);
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);

  // Load arena data
  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("arena_slug", slug)
        .maybeSingle();

      if (!prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(prof);

      const [courtsRes, schedRes] = await Promise.all([
        supabase.from("courts").select("*").eq("user_id", prof.user_id).eq("active", true).order("name"),
        supabase.from("schedule_configs").select("*").eq("user_id", prof.user_id),
      ]);
      setCourts(courtsRes.data ?? []);
      setScheduleConfigs(schedRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [slug]);

  // Load reservations when court/date changes (expire old manual pending first)
  useEffect(() => {
    if (!selectedCourt || !selectedDate || !profile) return;
    const expireThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    supabase
      .from("reservations")
      .update({ status: "expirada" })
      .eq("user_id", profile.user_id)
      .eq("status", "aguardando_confirmacao")
      .lt("created_at", expireThreshold)
      .then(() => {
        supabase
          .from("reservations")
          .select("*")
          .eq("court_id", selectedCourt.id)
          .eq("date", selectedDate)
          .in("status", ["agendado", "aguardando_confirmacao", "aguardando_pagamento"])
          .then(({ data }) => setReservations(data ?? []));
      });
  }, [selectedCourt, selectedDate, profile]);

  // Generate available time slots
  const dayOfWeek = new Date(selectedDate + "T12:00:00").getDay();
  const config = scheduleConfigs.find((s) => s.day_of_week === dayOfWeek);

  // Available durations based on config
  const durationOptions = useMemo(() => {
    if (!config) return [60];
    const interval = config.min_interval || 60;
    const maxDuration = (() => {
      const [startH, startM] = config.start_time.split(":").map(Number);
      const [endH, endM] = config.end_time.split(":").map(Number);
      return (endH * 60 + endM) - (startH * 60 + startM);
    })();
    const options: number[] = [];
    for (let d = interval; d <= maxDuration; d += interval) {
      options.push(d);
    }
    return options.length > 0 ? options : [60];
  }, [config]);

  const timeSlots = useMemo(() => {
    if (!config) return [];
    const slots: { time: string; available: boolean }[] = [];
    const [startH, startM] = config.start_time.split(":").map(Number);
    const [endH, endM] = config.end_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const interval = config.min_interval || 60;

    for (let m = startMinutes; m + selectedDuration <= endMinutes; m += interval) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const time = `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
      const endSlotM = m + selectedDuration;
      const endSlotTime = `${Math.floor(endSlotM / 60).toString().padStart(2, "0")}:${(endSlotM % 60).toString().padStart(2, "0")}`;

      const isOccupied = reservations.some((r) => {
        const rStart = r.start_time.substring(0, 5);
        const rEnd = r.end_time.substring(0, 5);
        return time < rEnd && endSlotTime > rStart;
      });

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const isPast = selectedDate === today && (h * 60 + min) <= (now.getHours() * 60 + now.getMinutes());

      slots.push({ time, available: !isOccupied && !isPast });
    }
    return slots;
  }, [config, reservations, selectedDate, selectedDuration]);

  const endTimeForSlot = (startTime: string) => {
    const [h, m] = startTime.split(":").map(Number);
    const endM = h * 60 + m + selectedDuration;
    return `${Math.floor(endM / 60).toString().padStart(2, "0")}:${(endM % 60).toString().padStart(2, "0")}`;
  };

  const getCourtSports = (court: Court) => court.type.split(",").map((s) => s.trim()).filter(Boolean);

  const handleSelectCourt = (court: Court) => {
    setSelectedCourt(court);
    setSelectedSlot(null);
    const sports = getCourtSports(court);
    setSelectedSport(sports[0] || "");
    setStep("times");
  };

  const handleSelectSlot = (time: string) => {
    setSelectedSlot(time);
    setStep("form");
  };

  const notifyArena = (paymentMethodUsed: string) => {
    if (!profile || !selectedCourt || !selectedSlot) return;
    const endTime = endTimeForSlot(selectedSlot);
    const dateFormatted = new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const paymentLabel =
      paymentMethodUsed === "manual" ? "PIX direto — aguardando comprovante" :
      paymentMethodUsed === "automatic" ? "PIX automático" :
      "Sem cobrança antecipada";
    const message =
      `🏟️ *Nova Reserva — ${profile.arena_name}*\n\n` +
      `👤 *Cliente:* ${clientName}\n` +
      `📞 *Telefone:* ${clientPhone || "Não informado"}\n\n` +
      `🎾 *Esporte:* ${selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis"}\n` +
      `🏟️ *Quadra:* ${selectedCourt.name}\n` +
      `📅 *Data:* ${dateFormatted}\n` +
      `⏰ *Horário:* ${selectedSlot.slice(0, 5)} às ${endTime.slice(0, 5)}\n\n` +
      `💳 *Pagamento:* ${paymentLabel}\n\n` +
      `_Reserva realizada via QuadraLivre_ ✅`;
    fetch("https://n8n.loopwise.com.br/webhook/notification-quadralivre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arena_name: profile.arena_name,
        arena_whatsapp: (profile as any).whatsapp_phone,
        client_name: clientName,
        client_phone: clientPhone || null,
        court_name: selectedCourt.name,
        date: dateFormatted,
        start_time: selectedSlot.slice(0, 5),
        end_time: endTime.slice(0, 5),
        sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis",
        payment_method: paymentMethodUsed,
        message,
      }),
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt || !selectedSlot || !profile) return;
    setSubmitting(true);

    const endTime = endTimeForSlot(selectedSlot);
    const totalAmount = selectedCourt.price_per_hour * (selectedDuration / 60);
    const advancePercentage = (profile as any).advance_percentage || 0;
    const paymentMethod = (profile as any).payment_method || "automatic";
    const advanceAmount = advancePercentage > 0 ? (totalAmount * advancePercentage) / 100 : totalAmount;

    // No payment flow
    if (paymentMethod === "none") {
      const { error: resError } = await supabase.from("reservations").insert({
        user_id: profile.user_id,
        court_id: selectedCourt.id,
        client_name: clientName,
        client_phone: clientPhone || null,
        date: selectedDate,
        start_time: selectedSlot,
        end_time: endTime,
        sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis",
        status: "agendado",
        payment_method: "none",
      });
      if (resError) { toast.error("Erro ao realizar reserva."); setSubmitting(false); return; }
      notifyArena("none");
      setSubmitting(false);
      setStep("done");
      return;
    }

    // Manual payment flow
    if (paymentMethod === "manual") {
      const { data: reservation, error: resError } = await supabase.from("reservations").insert({
        user_id: profile.user_id,
        court_id: selectedCourt.id,
        client_name: clientName,
        client_phone: clientPhone || null,
        date: selectedDate,
        start_time: selectedSlot,
        end_time: endTime,
        sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis",
        status: "aguardando_confirmacao",
        payment_method: "manual",
      }).select().single();

      if (resError) {
        toast.error(`Erro ao realizar reserva: ${resError.message}`);
        setSubmitting(false);
        return;
      }

      notifyArena("manual");
      setPendingReservationId(reservation.id);

      // Calcular valor e enviar requisição PIX via uazapi
      const pixAmount = advancePercentage > 0 ? advanceAmount : totalAmount;
      setManualAmount(pixAmount);
      if (clientPhone && (profile as any).manual_pix_key) {
        fetch("/api/send-pix-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientPhone,
            amount: pixAmount,
            pixKey: (profile as any).manual_pix_key,
            arenaName: profile.arena_name,
            courtName: selectedCourt.name,
          }),
        })
          .catch(() => {});
      }

      setSubmitting(false);
      setStep("manual_payment");
      return;
    }

    const { data: reservation, error: resError } = await supabase.from("reservations").insert({
      user_id: profile.user_id,
      court_id: selectedCourt.id,
      client_name: clientName,
      client_phone: clientPhone || null,
      date: selectedDate,
      start_time: selectedSlot,
      end_time: endTime,
      sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis",
      status: advancePercentage > 0 ? "aguardando_pagamento" : "agendado",
      payment_method: "automatic",
    }).select().single();

    if (resError) {
      toast.error("Erro ao realizar reserva.");
      setSubmitting(false);
      return;
    }

    if (advancePercentage > 0 && reservation) {
      try {
        const response = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId: reservation.id,
            amountCents: Math.round(advanceAmount * 100),
          }),
        });

        const pix = await response.json();

        if (!response.ok || !pix?.brCode) {
          throw new Error(pix?.error || "Erro ao gerar PIX");
        }

        setPixCode(pix.brCode);
        setPendingReservationId(reservation.id);
        notifyArena("automatic");
        setSubmitting(false);
        setStep("payment");
        return;
      } catch (err: any) {
        toast.error("Erro ao processar pagamento: " + err.message);
        setSubmitting(false);
        return;
      }
    }

    const dateFormatted = new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const msg = encodeURIComponent(
      `🏐 *Nova Reserva – ${profile.arena_name}*\n\n` +
      `👤 Cliente: ${clientName}\n` +
      `📞 Telefone: ${clientPhone || "Não informado"}\n` +
      `🏟️ Quadra: ${selectedCourt.name}\n` +
      `🏅 Esporte: ${selectedSport}\n` +
      `📅 Data: ${dateFormatted}\n` +
      `⏰ Horário: ${selectedSlot} - ${endTime}\n` +
      (observation ? `📝 Obs: ${observation}\n` : "") +
      `\n✅ Reserva solicitada via QuadraLivre`
    );

    const phone = profile.whatsapp_phone?.replace(/\D/g, "") || "";

    notifyArena("automatic");
    setSubmitting(false);
    setStep("done");

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    }
  };

  const handleBack = () => {
    if (step === "form") { setStep("times"); setSelectedSlot(null); }
    else if (step === "times") { setStep("courts"); setSelectedCourt(null); }
    else if (step === "courts") { setStep("home"); }
    else if (step === "cancel") { setStep("home"); }
  };

  const handleNewReservation = () => {
    setStep("home");
    setSelectedCourt(null);
    setSelectedSlot(null);
    setSelectedSport("");
    setSelectedDuration(60);
    setClientName("");
    setClientPhone("");
    setObservation("");
    setTermsAccepted(false);
    setPixCode("");
    setPixCopied(false);

    setPendingReservationId(null);
  };

  // Date options (next 7 days)
  const dateOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      options.push({
        value: d.toISOString().split("T")[0],
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }),
      });
    }
    return options;
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <img src={logo} alt="QuadraLivre" className="h-12 w-12 mb-4" />
        <h1 className="text-xl font-bold text-foreground">Arena não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-lg border-0 bg-subtle px-4 py-3 text-base text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena placeholder:text-muted-foreground/50";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="QuadraLivre" className="h-7 w-7" />
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">{profile.arena_name}</h1>
              {profile.address && (
                <p className="text-[11px] text-muted-foreground leading-tight">{profile.address}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {((profile as any).location_link || profile.address) && (
              <a
                href={(profile as any).location_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle text-muted-foreground hover:text-foreground transition-arena"
                aria-label="Abrir no Google Maps"
              >
                <MapPin size={16} />
              </a>
            )}
            {profile.whatsapp_phone && (
              <a
                href={`https://wa.me/${profile.whatsapp_phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground transition-arena hover:brightness-95"
                aria-label="WhatsApp"
              >
                <Phone size={16} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Banner */}
      {(profile as any).banner_url && (
        <div className="mx-auto max-w-lg">
          <img
            src={(profile as any).banner_url}
            alt={profile.arena_name}
            className="w-full h-44 object-cover"
          />
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 pb-8">
        {/* Back button */}
        {step !== "home" && step !== "done" && (
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-arena mt-4 mb-2">
            <ChevronLeft size={16} /> Voltar
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* HOME: Two action buttons */}
          {step === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="mt-8 mb-6 text-center">
                <h2 className="text-xl font-bold text-foreground tracking-tight">O que deseja fazer?</h2>
                <p className="text-sm text-muted-foreground mt-1">Escolha uma opção abaixo</p>
              </div>
              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("courts")}
                  className="w-full rounded-xl bg-accent p-5 text-left shadow-sm transition-arena hover:brightness-95 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-foreground/10">
                      <Calendar size={24} className="text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-accent-foreground">Reservar Quadra</p>
                      <p className="text-xs text-accent-foreground/70 mt-0.5">Escolha uma quadra e horário disponível</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("cancel")}
                  className="w-full rounded-xl bg-card p-5 text-left shadow-card ring-1 ring-inset ring-border transition-arena hover:ring-destructive/30 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                      <XCircle size={24} className="text-destructive" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">Cancelar Reserva</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Busque pelo seu telefone para cancelar</p>
                    </div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 1: Courts */}
          {step === "courts" && (
            <motion.div key="courts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="mt-6 mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Escolha a quadra</h2>
                <p className="text-sm text-muted-foreground">Selecione uma quadra para ver os horários disponíveis</p>
              </div>
              <div className="space-y-3">
                {courts.map((court) => {
                  const sports = getCourtSports(court);
                  return (
                    <motion.button
                      key={court.id}
                      onClick={() => handleSelectCourt(court)}
                      whileTap={{ scale: 0.98 }}
                      className="w-full rounded-xl bg-card p-4 shadow-card text-left transition-arena hover:ring-2 hover:ring-primary/30 active:scale-[0.98]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{court.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sports.map((s) => (
                              <span key={s} className="inline-flex items-center rounded-md bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">
                            R$ {court.price_per_hour.toFixed(2).replace(".", ",")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">por hora</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
                {courts.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhuma quadra disponível no momento.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 2: Date & Time */}
          {step === "times" && selectedCourt && (
            <motion.div key="times" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="mt-4 mb-4">
                <p className="text-xs text-muted-foreground">{selectedCourt.name}</p>
                <h2 className="text-lg font-bold text-foreground tracking-tight">Escolha o horário</h2>
              </div>

              {/* Sport selector (if multiple) */}
              {getCourtSports(selectedCourt).length > 1 && (
                <div className="mb-4">
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Esporte</label>
                  <div className="flex flex-wrap gap-2">
                    {getCourtSports(selectedCourt).map((sport) => (
                      <button
                        key={sport}
                        type="button"
                        onClick={() => setSelectedSport(sport)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-arena ${
                          selectedSport === sport
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-subtle text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
                        }`}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration selector */}
              {durationOptions.length > 1 && (
                <div className="mb-4 bg-card p-4 rounded-xl shadow-sm ring-1 ring-inset ring-border">
                  <label className="text-sm font-bold text-foreground mb-3 block text-center">Tempo de reserva</label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      disabled={durationOptions.indexOf(selectedDuration) <= 0}
                      onClick={() => {
                        const idx = durationOptions.indexOf(selectedDuration);
                        if (idx > 0) {
                          setSelectedDuration(durationOptions[idx - 1]);
                          setSelectedSlot(null);
                        }
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-foreground disabled:opacity-30 active:scale-95 transition-transform ring-1 ring-inset ring-border hover:bg-muted"
                    >
                      <Minus size={20} />
                    </button>
                    <div className="w-24 text-center">
                      <span className="text-2xl font-bold text-primary">
                        {selectedDuration >= 60 ? `${selectedDuration / 60}h` : `${selectedDuration}m`}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={durationOptions.indexOf(selectedDuration) >= durationOptions.length - 1}
                      onClick={() => {
                        const idx = durationOptions.indexOf(selectedDuration);
                        if (idx < durationOptions.length - 1) {
                          setSelectedDuration(durationOptions[idx + 1]);
                          setSelectedSlot(null);
                        }
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-foreground disabled:opacity-30 active:scale-95 transition-transform ring-1 ring-inset ring-border hover:bg-muted"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}

              {/* Date selector */}
              <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
                {dateOptions.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => { setSelectedDate(d.value); setSelectedSlot(null); }}
                    className={`flex-shrink-0 rounded-lg px-3.5 py-2 text-xs font-medium transition-arena ${
                      d.value === selectedDate
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-subtle text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Time grid */}
              {!config ? (
                <div className="text-center py-12">
                  <CalendarDays size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Não há horários configurados para este dia.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => handleSelectSlot(slot.time)}
                      className={`rounded-lg px-3 py-3 text-sm font-medium transition-arena ${
                        !slot.available
                          ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                          : selectedSlot === slot.time
                          ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                          : "bg-accent/10 text-accent hover:bg-accent/20"
                      }`}
                    >
                      <Clock size={14} className="mx-auto mb-0.5" />
                      {slot.time}
                    </button>
                  ))}
                  {timeSlots.length === 0 && (
                    <p className="col-span-3 text-center text-sm text-muted-foreground py-8">Nenhum horário disponível.</p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: Form */}
          {step === "form" && selectedCourt && selectedSlot && (
            <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="mt-4 mb-4">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Confirmar reserva</h2>
              </div>

              {/* Summary card */}
              <div className="rounded-xl bg-subtle p-4 mb-5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Quadra</span>
                  <span className="text-xs font-medium text-foreground">{selectedCourt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Esporte</span>
                  <span className="text-xs font-medium text-foreground">{selectedSport}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Data</span>
                  <span className="text-xs font-medium text-foreground">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Horário</span>
                  <span className="text-xs font-medium text-foreground">{selectedSlot} - {endTimeForSlot(selectedSlot)} ({selectedDuration >= 60 ? `${selectedDuration / 60}h` : `${selectedDuration}min`})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Valor</span>
                  <span className="text-xs font-bold text-primary">R$ {(selectedCourt.price_per_hour * (selectedDuration / 60)).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Avisos de política */}
              {(() => {
                const advPerc = (profile as any).advance_percentage ?? 0;
                const cancelLimit = (profile as any).cancellation_limit_hours ?? 0;
                const totalAmount = selectedCourt.price_per_hour * (selectedDuration / 60);
                const advanceAmount = (totalAmount * advPerc) / 100;
                const hasTerms = advPerc > 0 || cancelLimit > 0;

                if (!hasTerms) return null;

                return (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 mb-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500 shrink-0" />
                      <p className="text-xs font-bold text-amber-600">Condições desta reserva</p>
                    </div>
                    {advPerc > 0 && (
                      <p className="text-xs text-amber-700/90 leading-relaxed">
                        • Esta quadra exige o pagamento de <strong>{advPerc}% (R$ {advanceAmount.toFixed(2).replace(".", ",")}) via PIX</strong> para confirmar a reserva. Você será redirecionado ao pagamento após confirmar.
                      </p>
                    )}
                    {cancelLimit > 0 && (
                      <p className="text-xs text-amber-700/90 leading-relaxed">
                        • O cancelamento deve ser solicitado com no mínimo <strong>{cancelLimit} hora{cancelLimit > 1 ? "s" : ""} de antecedência</strong>. Cancelamentos fora deste prazo não serão aceitos.
                      </p>
                    )}
                    <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded accent-amber-500 shrink-0"
                      />
                      <span className="text-xs text-amber-700 font-medium leading-relaxed">
                        Li e concordo com as condições acima
                      </span>
                    </label>
                  </div>
                );
              })()}

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Seu nome *"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={inputClass}
                  required
                />
                <input
                  type="tel"
                  placeholder="Seu telefone *"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className={inputClass}
                  required
                />
                <textarea
                  placeholder="Observação (opcional)"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  className={`${inputClass} resize-none h-20`}
                />
                <motion.button
                  type="submit"
                  disabled={submitting || !clientName || !clientPhone || (
                    ((profile as any).advance_percentage > 0 || (profile as any).cancellation_limit_hours > 0) && !termsAccepted
                  )}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-sm transition-arena hover:brightness-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (profile as any).payment_method === "none" ? (
                    <>
                      <ShieldCheck size={16} />
                      Confirmar reserva
                    </>
                  ) : (profile as any).payment_method === "manual" ? (
                    <>
                      <ShieldCheck size={16} />
                      Confirmar e ver dados do PIX
                    </>
                  ) : (profile as any).advance_percentage > 0 ? (
                    <>
                      <ShieldCheck size={16} />
                      Confirmar e pagar via PIX
                    </>
                  ) : (
                    <>
                      <Phone size={16} />
                      Confirmar reserva via WhatsApp
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* STEP: Payment PIX */}
          {step === "payment" && pixCode && (
            <motion.div key="payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="py-6">
              <div className="text-center mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mx-auto mb-3">
                  <ShieldCheck size={28} className="text-accent" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Pague via PIX</h2>
                <p className="text-sm text-muted-foreground mt-1">Copie o código abaixo e pague no seu banco</p>
              </div>

              <div className="rounded-xl bg-subtle p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground text-center font-medium">PIX Copia e Cola</p>
                <div className="rounded-lg bg-card p-3 ring-1 ring-border">
                  <p className="text-[10px] text-muted-foreground break-all leading-relaxed font-mono select-all">{pixCode}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixCode);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 3000);
                  }}
                  className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-foreground transition-arena hover:brightness-95 flex items-center justify-center gap-2"
                >
                  {pixCopied ? <CheckCircle2 size={16} /> : <Phone size={16} />}
                  {pixCopied ? "Copiado!" : "Copiar código PIX"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Como pagar:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha a opção <strong>PIX Copia e Cola</strong></li>
                  <li>Cole o código acima e confirme o pagamento</li>
                  <li>Sua reserva será confirmada automaticamente</li>
                </ol>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                Verificando pagamento automaticamente...
              </div>

              <button
                onClick={async () => {
                  if (!pendingReservationId) return;
                  const response = await fetch(`/api/check-payment?reservationId=${pendingReservationId}`);
                  const data = await response.json();
                  if (data?.paid) {
                    setStep("done");
                  } else {
                    toast.info("Pagamento ainda não identificado. Tente novamente em alguns segundos.");
                  }
                }}
                className="mt-3 w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground transition-arena hover:bg-subtle"
              >
                Já paguei — verificar agora
              </button>

              {/* Polling: verifica a cada 5s se o pagamento foi confirmado */}
              <PixPolling
                reservationId={pendingReservationId}
                onPaid={() => setStep("done")}
              />
            </motion.div>
          )}

          {/* STEP: Manual Payment */}
          {step === "manual_payment" && (
            <motion.div key="manual_payment" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="py-8">
              {/* Ícone + título */}
              <div className="text-center mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 200 }}>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mx-auto mb-4">
                    <CheckCircle2 size={36} className="text-accent" />
                  </div>
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Reserva registrada!</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                  Sua reserva está aguardando o pagamento via PIX.
                </p>
              </div>

              {/* Resumo */}
              {selectedCourt && selectedSlot && (
                <div className="rounded-xl bg-subtle p-4 mb-5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Quadra</span>
                    <span className="text-xs font-medium text-foreground">{selectedCourt.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Horário</span>
                    <span className="text-xs font-medium text-foreground">{selectedSlot} – {endTimeForSlot(selectedSlot)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Valor</span>
                    <span className="text-xs font-bold text-primary">R$ {manualAmount.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              )}

              {/* Instrução principal */}
              <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-5 mb-5 text-center">
                <p className="text-sm font-semibold text-foreground mb-1">
                  📲 Verifique seu WhatsApp
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos uma <strong>solicitação de pagamento PIX</strong> com o valor já preenchido. Pague por lá e envie o comprovante para a arena.
                </p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Sua reserva será <strong>confirmada após o pagamento</strong>.
                </p>
              </div>

              {/* Botão WhatsApp da arena */}
              {(profile as any).whatsapp_phone && (
                <a
                  href={`https://wa.me/${((profile as any).whatsapp_phone as string).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Acabei de fazer uma reserva na ${profile.arena_name} e quero enviar o comprovante do PIX.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-sm transition-arena hover:brightness-95 flex items-center justify-center gap-2 mb-3"
                >
                  <Phone size={16} />
                  Abrir WhatsApp da arena
                </a>
              )}

              <button
                onClick={handleNewReservation}
                className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-subtle transition-arena"
              >
                Voltar ao início
              </button>
            </motion.div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="text-center py-16">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 200 }}>
                <CheckCircle2 size={56} className="mx-auto text-accent mb-4" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">Reserva confirmada!</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Sua reserva foi agendada automaticamente. Os detalhes foram enviados via WhatsApp.
              </p>
              <button
                onClick={handleNewReservation}
                className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-arena hover:brightness-95"
              >
                Voltar ao início
              </button>
            </motion.div>
          )}

          {/* STEP: Cancel */}
          {step === "cancel" && profile && (
            <motion.div key="cancel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <CancelBookingFlow
                profileUserId={profile.user_id}
                courts={courts}
                onCancelled={() => {}}
                onClose={() => setStep("home")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <img src={logo} alt="" className="h-4 w-4 opacity-40" />
          <span className="text-[11px] text-muted-foreground/50">QuadraLivre</span>
        </div>
      </footer>
    </div>
  );
}
