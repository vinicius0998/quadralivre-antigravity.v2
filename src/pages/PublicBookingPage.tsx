import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, CalendarDays, Clock, Check, X, CreditCard, ChevronLeft, ChevronRight, Share2, MapPin, Send, MessageSquare, ShieldCheck, ClipboardCheck, Timer, AlertCircle, Phone, User, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import ConfettiExplosion from "react-confetti-explosion";

type Profile = Tables<"profiles">;
type Court = Tables<"courts">;
type Reservation = Tables<"reservations">;
type ScheduleConfig = Tables<"schedule_configs">;

export default function PublicBookingPage() {
  const { arenaSlug } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [scheduleConfigs, setScheduleConfigs] = useState<ScheduleConfig[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [observation, setObservation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<"court" | "details" | "payment" | "success">("court");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState<number>(0);

  const today = new Date().toISOString().split("T")[0];

  // Fetch arena details
  useEffect(() => {
    const fetchArena = async () => {
      if (!arenaSlug) return;
      const { data: profileRes, error: pError } = await supabase.from("profiles").select("*").eq("slug", arenaSlug).single();
      if (pError || !profileRes) { setNotFound(true); setLoading(false); return; }
      setProfile(profileRes);
      const { data: courtsRes } = await supabase.from("courts").select("*").eq("user_id", profileRes.id).eq("active", true);
      setCourts(courtsRes ?? []);
      const { data: configsRes } = await supabase.from("schedule_configs").select("*").eq("user_id", profileRes.id);
      setScheduleConfigs(configsRes ?? []);
      setLoading(false);
    };
    fetchArena();
  }, [arenaSlug]);

  const cleanCancelledSlots = async (courtId: string, date: string, startTime: string, endTime: string) => {
    try {
      const { data: cancelled } = await supabase.from("reservations").select("id, start_time, end_time").eq("court_id", courtId).eq("date", date).eq("status", "cancelado");
      if (!cancelled || cancelled.length === 0) return;
      const startTimeMinutes = (t: string) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1] || "0");
      const startM = startTimeMinutes(startTime);
      const endM = startTimeMinutes(endTime);
      const conflicts = cancelled.filter((r) => {
        const rStart = startTimeMinutes(r.start_time);
        const rEnd = startTimeMinutes(r.end_time);
        return startM < rEnd && endM > rStart;
      });
      if (conflicts.length > 0) {
        const idsToDelete = conflicts.map((r) => r.id);
        await supabase.from("reservations").delete().in("id", idsToDelete);
        console.log(`[cleanCancelledSlots] Removed ${idsToDelete.length} 'cancelado' slots to free up for new booking.`);
      }
    } catch (e) {
      console.warn("[cleanCancelledSlots] Error:", e);
    }
  };

  const getCourtSports = (court: Court) => { try { return (court.sports as string[]) || ["Beach Tennis"]; } catch { return ["Beach Tennis"]; } };

  const notifyArena = (paymentMethodUsed: string) => {
    if (!profile || !selectedCourt || !selectedSlot) return;
    const endTime = endTimeForSlot(selectedSlot);
    const dateFormatted = new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const paymentLabel = paymentMethodUsed === "manual" ? "PIX direto — aguardando comprovante" : paymentMethodUsed === "automatic" ? "PIX automático" : "Sem cobrança antecipada";
    const message = `🏟️ *Nova Reserva — ${profile.arena_name}*\n\n👤 *Cliente:* ${clientName}\n📞 *Telefone:* ${clientPhone || "Não informado"}\n\n🎾 *Esporte:* ${selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis"}\n🏟️ *Quadra:* ${selectedCourt.name}\n📅 *Data:* ${dateFormatted}\n⏰ *Horário:* ${selectedSlot.slice(0, 5)} às ${endTime.slice(0, 5)}\n\n💳 *Pagamento:* ${paymentLabel}\n\n_Reserva realizada via QuadraLivre_ ✅`;
    fetch("https://n8n.loopwise.com.br/webhook/notification-quadralivre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arena_name: profile.arena_name,
        arena_whatsapp: (profile as any).whatsapp_phone ? "+55" + (profile as any).whatsapp_phone.replace(/\D/g, "") : null,
        client_name: clientName,
        client_phone: clientPhone ? "+55" + clientPhone.replace(/\D/g, "") : null,
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

  const endTimeForSlot = (start: string) => {
    const [h, m] = start.split(":").map(Number);
    const totalMin = h * 60 + m + selectedDuration;
    const endH = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const endM = (totalMin % 60).toString().padStart(2, "0");
    return `${endH}:${endM}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCourt || !selectedSlot) return;
    setSubmitting(true);
    const endTime = endTimeForSlot(selectedSlot);
    const paymentMethodUsed = profile.payment_method || "none";
    if (paymentMethodUsed === "none") {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: profile.id, court_id: selectedCourt.id, client_name: clientName, client_phone: clientPhone || null, date: selectedDate, start_time: selectedSlot, end_time: endTime, price: selectedDuration === 60 ? selectedCourt.price_hour : selectedCourt.price_90min || selectedCourt.price_hour * 1.5, sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis", status: "agendado", observation
      }).select().single();
      if (error) { toast({ variant: "destructive", title: "Erro ao reservar", description: error.message }); setSubmitting(false); return; }
      await cleanCancelledSlots(selectedCourt.id, selectedDate, selectedSlot, endTime);
      notifyArena("none"); setSubmitting(false); setStep("success");
    } else if (paymentMethodUsed === "manual") {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: profile.id, court_id: selectedCourt.id, client_name: clientName, client_phone: clientPhone || null, date: selectedDate, start_time: selectedSlot, end_time: endTime, price: selectedDuration === 60 ? selectedCourt.price_hour : selectedCourt.price_90min || selectedCourt.price_hour * 1.5, sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis", status: "aguardando_confirmacao", observation
      }).select().single();
      if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); setSubmitting(false); return; }
      notifyArena("manual");
      await cleanCancelledSlots(selectedCourt.id, selectedDate, selectedSlot, endTime);
      setPendingReservationId(data.id); setManualAmount(data.price);
      // Send Pix Request via WhatsApp
      const rawRes = await fetch("/api/send-pix-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientPhone: clientPhone.replace(/\D/g, ""),
          amount: data.price,
          arenaName: profile.arena_name,
          pixKey: profile.pix_key,
          pixType: profile.pix_type,
          token: (profile as any).uazapi_token,
          instance: (profile as any).uazapi_instance_name
        })
      });
      console.log("[PIX WhatsApp] Status:", rawRes.status);
      setSubmitting(false); setStep("payment");
    } else if (paymentMethodUsed === "automatic") {
      const { data, error } = await supabase.from("reservations").insert({
        user_id: profile.id, court_id: selectedCourt.id, client_name: clientName, client_phone: clientPhone || null, date: selectedDate, start_time: selectedSlot, end_time: endTime, price: selectedDuration === 60 ? selectedCourt.price_hour : selectedCourt.price_90min || selectedCourt.price_hour * 1.5, sport: selectedSport || getCourtSports(selectedCourt)[0] || "Beach Tennis", status: "aguardando_pagamento", observation
      }).select().single();
      if (error) { toast({ variant: "destructive", title: "Erro", description: error.message }); setSubmitting(false); return; }
      const pixCodeRes = "00020126360014br.gov.bcb.pix0114" + profile.pix_key + "5204000053039865404" + data.price.toFixed(2) + "5802BR5913" + profile.arena_name + "6008BRASILIA62070503***6304";
      setPixCode(pixCodeRes); setPendingReservationId(data.id);
      notifyArena("automatic");
      await cleanCancelledSlots(selectedCourt.id, selectedDate, selectedSlot, endTime);
      setSubmitting(false); setStep("payment");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, ""); if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 10) v = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
    else if (v.length > 6) v = `(${v.substring(0, 2)}) ${v.substring(2, 6)}-${v.substring(6)}`;
    else if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    else if (v.length > 0) v = `(${v}`; setClientPhone(v);
  };

  const isPhoneValid = clientPhone.replace(/\D/g, "").length === 11;

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-subtle"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (notFound || !profile) return <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center"> <Badge variant="destructive" className="mb-4">404</Badge> <h1 className="text-2xl font-bold mb-2">Arena não encontrada</h1> <p className="text-muted-foreground mb-6">O link que você acessou pode estar incorreto ou a arena não existe mais.</p> <Button onClick={() => navigate("/")}>Voltar ao Início</Button> </div>;

  return (
    <div className="min-h-screen bg-subtle pb-20 selection:bg-primary/10">
      <div className="max-w-xl mx-auto px-4 pt-8">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center text-primary-foreground text-4xl font-black shadow-xl shadow-primary/20 mb-6"> {profile.arena_name.charAt(0)} </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground truncate w-full px-2"> {profile.arena_name} </h1>
          {profile.address && <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5 mt-2 font-medium"> <MapPin size={14} className="text-primary" /> {profile.address} </p>}
        </header>

        <AnimatePresence mode="wait">
          {step === "court" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <Card className="border-none shadow-card rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-4"> <CardTitle className="text-xl font-bold flex items-center gap-2"> <MapPin size={20} className="text-primary" /> Selecione a Quadra </CardTitle> <CardDescription>Escolha em qual quadra deseja jogar</CardDescription> </CardHeader>
                <CardContent className="grid gap-3">
                  {courts.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedCourt(c); setStep("details"); }} className="group relative flex items-center justify-between p-4 rounded-2xl border-2 border-transparent bg-subtle hover:bg-white hover:border-primary/30 transition-arena text-left shadow-sm hover:shadow-md">
                      <div className="min-w-0 pr-4"> <p className="font-bold text-foreground text-lg mb-0.5 group-hover:text-primary transition-colors">{c.name}</p> {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>} <div className="flex gap-1.5 mt-2"> {getCourtSports(c).map(s => <Badge key={s} variant="secondary" className="text-[10px] py-0 px-1.5 bg-white/60">{s}</Badge>)} </div> </div>
                      <div className="text-right shrink-0"> <p className="text-sm font-bold text-primary">R$ {c.price_hour.toFixed(0)}</p> <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Por hora</p> </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "details" && selectedCourt && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="flex items-center gap-2 mb-2"> <Button variant="ghost" size="sm" onClick={() => setStep("court")} className="rounded-xl h-8 text-muted-foreground hover:bg-white/50"> <ChevronLeft size={16} /> Voltar </Button> <Badge variant="outline" className="rounded-lg bg-primary/5 text-primary border-primary/20 px-3 py-1 font-semibold">{selectedCourt.name}</Badge> </div>
              <Card className="border-none shadow-card rounded-3xl bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-4"> <CardTitle className="text-xl font-extrabold flex items-center gap-2 tracking-tight"> <Timer size={22} className="text-primary" /> Configure sua reserva </CardTitle> </CardHeader>
                <CardContent className="space-y-6 pt-2">
                  <div className="space-y-3"> <Label className="text-sm font-bold text-foreground/80 flex items-center gap-2"> <CalendarDays size={16} className="text-primary" /> Data </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                        const d = new Date(); d.setDate(d.getDate() + offset);
                        const iso = d.toISOString().split("T")[0];
                        const isToday = iso === today;
                        const isSelected = selectedDate === iso;
                        return (
                          <button key={iso} onClick={() => setSelectedDate(iso)} className={`flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-arena ${isSelected ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-subtle/50 text-muted-foreground border-transparent hover:bg-white/80 hover:border-primary/20"}`}> <span className="text-[10px] uppercase font-bold tracking-tighter opacity-70 mb-0.5">{d.toLocaleDateString("pt-BR", { weekday: "short" })}</span> <span className="text-lg font-black leading-none">{d.getDate()}</span> </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-foreground/80 flex items-center gap-2"> <Clock size={16} className="text-primary" /> Horários livres </Label>
                    <div className="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                      {["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"].map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <button key={slot} onClick={() => setSelectedSlot(slot)} className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-arena ${isSelected ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-subtle/50 text-foreground border-transparent hover:bg-white hover:border-primary/20"}`}> {slot} </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="space-y-2"> <Label className="text-sm font-bold text-foreground/80">Seu Nome</Label> <Input placeholder="Quem vai reservar?" value={clientName} onChange={(e) => setClientName(e.target.value)} className="rounded-2xl bg-subtle/50 border-none focus-visible:ring-2 focus-visible:ring-primary h-12 font-medium" /> </div>
                    <div className="space-y-2"> <Label className="text-sm font-bold text-foreground/80">WhatsApp</Label> <Input placeholder="(DDD) 99999-9999" value={clientPhone} onChange={handlePhoneChange} className="rounded-2xl bg-subtle/50 border-none focus-visible:ring-2 focus-visible:ring-primary h-12 font-medium" /> </div>
                  </div>
                </CardContent>
                <CardFooter className="pb-6 px-6"> <Button className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/20 gradient-primary transition-arena hover:scale-[1.02]" disabled={!selectedSlot || !clientName || !isPhoneValid || submitting} onClick={handleSubmit}> {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />} Confirmar Reserva </Button> </CardFooter>
              </Card>
            </motion.div>
          )}

          {step === "payment" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-card/90 backdrop-blur-md ring-1 ring-border/50">
                <CardHeader className="text-center pt-8 pb-4"> <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"> <CreditCard className="text-blue-600 h-8 w-8" /> </div> <CardTitle className="text-2xl font-black tracking-tight text-foreground">Pagamento</CardTitle> <CardDescription className="text-base font-medium">Finalize sua reserva via PIX</CardDescription> </CardHeader>
                <CardContent className="space-y-6 px-8 flex flex-col items-center">
                  <div className="w-full bg-subtle rounded-3xl p-6 text-center space-y-2 ring-1 ring-border/40"> <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Valor Total</p> <p className="text-4xl font-black text-foreground">R$ {manualAmount.toFixed(2)}</p> </div>
                  {pixCode ? (
                    <div className="w-full space-y-4">
                      <div className="bg-white p-4 rounded-3xl shadow-sm border border-border/40 mx-auto w-fit"> <div className="h-48 w-48 bg-subtle rounded-2xl flex items-center justify-center font-bold text-muted-foreground text-xs text-center px-4"> QR Code Gerado<br />Clique no botão abaixo para copiar o código </div> </div>
                      <Button onClick={() => { navigator.clipboard.writeText(pixCode); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); toast({ title: "Copiado!", description: "Código Pix copiado para a área de transferência." }); }} className="w-full h-14 rounded-2xl font-bold bg-foreground text-background hover:bg-foreground/90 transition-all"> {pixCopied ? <><ClipboardCheck className="mr-2 h-5 w-5" /> Copiado!</> : <><Share2 className="mr-2 h-5 w-5" /> Copiar Código PIX</>} </Button>
                    </div>
                  ) : (
                    <div className="w-full space-y-6 py-4 text-center">
                      <div className="h-14 w-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce"> <MessageSquare className="text-green-600 h-7 w-7" /> </div>
                      <div className="space-y-3"> <p className="text-lg font-bold text-foreground">Verifique seu WhatsApp! ✅</p> <p className="text-sm text-muted-foreground leading-relaxed px-4">O código Pix para pagamento foi enviado automaticamente para o número: <br/><strong className="text-foreground">{clientPhone}</strong></p> </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100/50"> <p className="text-[11px] text-amber-700 leading-tight flex items-start gap-2 text-left shrink-0"> <AlertCircle size={14} className="shrink-0 mt-0.5" /> Caso não receba em 1 minuto, efetue o pagamento diretamente na chave Pix da arena no local. </p> </div>
                    </div>
                  )}
                  <div className="w-full space-y-4 pt-4"> <Separator className="bg-border/40" /> <div className="grid grid-cols-2 gap-4"> <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quadra</p> <p className="text-sm font-bold text-foreground">{selectedCourt.name}</p> </div> <div className="space-y-1"> <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data e Hora</p> <p className="text-sm font-bold text-foreground">{new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} • {selectedSlot}</p> </div> </div> </div>
                </CardContent>
                <CardFooter className="px-8 pb-8 pt-0"> <Button variant="outline" onClick={() => setStep("success")} className="w-full h-12 rounded-2xl font-bold border-border/50 hover:bg-subtle transition-arena"> Já realizei o pagamento </Button> </CardFooter>
              </Card>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
              <div className="relative"> <div className="h-24 w-24 bg-accent/20 rounded-full flex items-center justify-center mb-6 relative z-10 animate-in zoom-in duration-500"> <Check className="text-accent h-12 w-12" strokeWidth={3} /> </div> <div className="absolute top-0 left-0"> <ConfettiExplosion force={0.6} duration={3000} particleCount={80} width={400} /> </div> </div>
              <h2 className="text-4xl font-black text-foreground mb-4 tracking-tight">Tudo pronto! 🎾</h2>
              <div className="space-y-6 max-w-sm mx-auto"> <p className="text-lg text-muted-foreground font-medium">Sua reserva foi enviada com sucesso para a <strong className="text-foreground">{profile.arena_name}</strong>. </p> <div className="bg-card shadow-card rounded-3xl p-6 ring-1 ring-border/50 space-y-4"> <div className="flex items-center justify-between text-sm"> <span className="text-muted-foreground font-semibold">Horário:</span> <span className="text-foreground font-bold">{selectedSlot} às {endTimeForSlot(selectedSlot || "00:00")}</span> </div> <div className="flex items-center justify-between text-sm"> <span className="text-muted-foreground font-semibold">Data:</span> <span className="text-foreground font-bold">{new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}</span> </div> <div className="flex items-center justify-between text-sm border-t border-border/50 pt-4"> <span className="text-muted-foreground font-semibold">Status:</span> <Badge className="bg-accent/10 text-accent hover:bg-accent/10 border-none font-bold">RESERVADO ✅</Badge> </div> </div> <Button onClick={() => window.location.reload()} className="w-full h-14 rounded-2xl font-extrabold text-lg gradient-primary shadow-xl shadow-primary/20 transition-all hover:scale-102"> Reservar outro horário </Button> </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
