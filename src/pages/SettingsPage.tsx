import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Copy, ExternalLink, Upload, X, ImageIcon, Building2, Globe, Phone, Banknote, Wallet } from "lucide-react";

type Profile = Tables<"profiles">;

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [arenaName, setArenaName] = useState("");
  const [arenaSlug, setArenaSlug] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [address, setAddress] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [cancellationLimit, setCancellationLimit] = useState<number>(0);
  const [advancePercentage, setAdvancePercentage] = useState<number>(0);
  const [pixKey, setPixKey] = useState("");
  const [balanceCents, setBalanceCents] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setArenaName(data.arena_name);
        setArenaSlug(data.arena_slug ?? "");
        setWhatsappPhone(data.whatsapp_phone ?? "");
        setAddress(data.address ?? "");
        setLocationLink(data.location_link ?? "");
        setBannerUrl(data.banner_url ?? "");
        setCancellationLimit(data.cancellation_limit_hours ?? 0);
        setAdvancePercentage((data as any).advance_percentage ?? 0);
        setPixKey((data as any).pix_key ?? "");
        setBalanceCents((data as any).balance_cents ?? 0);
      }
      setLoading(false);
    });
  }, [user]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB."); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/banner.${ext}`;
    const { error } = await supabase.storage.from("arena-images").upload(filePath, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem."); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("arena-images").getPublicUrl(filePath);
    setBannerUrl(urlData.publicUrl + "?t=" + Date.now());
    setUploading(false);
    toast.success("Imagem enviada! Salve para confirmar.");
  };

  const handleRemoveImage = () => { setBannerUrl(""); toast.info("Imagem removida. Salve para confirmar."); };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const slug = arenaSlug || arenaName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    const payload = {
      user_id: user.id,
      arena_name: arenaName,
      arena_slug: slug,
      whatsapp_phone: whatsappPhone,
      address: address || null,
      location_link: locationLink || null,
      banner_url: bannerUrl || null,
      cancellation_limit_hours: cancellationLimit,
      advance_percentage: advancePercentage,
      pix_key: pixKey || null,
    } as any;

    let error;
    
    if (profile?.id) {
      // Se o perfil já existe (carregado no useEffect), fazemos UPDATE pelo ID
      const res = await supabase.from("profiles").update(payload).eq("id", profile.id);
      error = res.error;
    } else {
      // Falback para upsert
      const res = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
      error = res.error;
    }

    setSaving(false);
    
    if (error) { 
      console.error("Erro no save (profiles):", error);
      if (error.message?.includes("duplicate")) {
        toast.error("Esse slug já está em uso por outra arena.");
      } else {
        toast.error(`Erro ao salvar: ${error.message}`);
      }
      return; 
    }
    
    setArenaSlug(slug);
    toast.success("Configurações salvas!");
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amountCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      toast.error("Informe um valor válido para saque.");
      return;
    }
    setWithdrawing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { toast.error("Sessão expirada. Faça login novamente."); setWithdrawing(false); return; }

    const response = await fetch("/api/create-withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amountCents }),
    });
    const result = await response.json();
    setWithdrawing(false);
    if (!response.ok) {
      toast.error(result.error || "Erro ao solicitar saque.");
    } else {
      toast.success("Saque solicitado! O valor será enviado para sua chave PIX em breve.");
      setWithdrawAmount("");
    }
  };

  const inputClass = "w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena min-h-[44px]";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie os dados da sua arena</p>
      </div>

      <div className="max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Section */}
        <div className="md:col-span-2 rounded-2xl bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Imagem da Arena</h2>
          </div>
          {bannerUrl ? (
            <div className="relative rounded-xl overflow-hidden ring-1 ring-border">
              <img src={bannerUrl} alt="Banner da arena" className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-card/90 text-foreground hover:bg-destructive hover:text-destructive-foreground transition-arena backdrop-blur-sm shadow-sm"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-12 text-muted-foreground hover:border-primary hover:text-primary transition-arena cursor-pointer"
            >
              {uploading ? <Loader2 size={28} className="animate-spin" /> : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <ImageIcon size={24} className="text-primary" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold block">Clique para enviar</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 5MB</span>
                  </div>
                </>
              )}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
          {bannerUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-3"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Trocar imagem
            </button>
          )}
        </div>

        {/* Arena Data */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Dados da Arena</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome da arena</label>
            <input type="text" value={arenaName} onChange={(e) => setArenaName(e.target.value)} placeholder="Nome da arena" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Slug (link público)</label>
            <input type="text" value={arenaSlug} onChange={(e) => setArenaSlug(e.target.value)} placeholder="minha-arena" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Endereço</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" className={inputClass} />
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Phone size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Contato</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">WhatsApp</label>
            <input type="tel" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="+5511999999999" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Link da localização</label>
            <input type="url" value={locationLink} onChange={(e) => setLocationLink(e.target.value)} placeholder="https://maps.google.com/..." className={inputClass} />
          </div>
        </div>

        {/* Cancellation Rule */}
        <div className="md:col-span-2 rounded-2xl bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <X size={16} className="text-destructive" />
            <h2 className="text-sm font-bold text-foreground">Regras de Cancelamento</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Limite de antecedência (horas)</label>
            <p className="text-[11px] text-muted-foreground mb-2">Quantas horas antes do início o cliente PODE cancelar a reserva.</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                value={cancellationLimit}
                onChange={(e) => setCancellationLimit(Number(e.target.value))}
                className={`${inputClass} max-w-[120px]`}
              />
              <span className="text-sm text-foreground font-medium">horas</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Ex: Se definir 2 horas, o cliente não poderá cancelar se faltar menos de 2h para a reserva.</p>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="md:col-span-2 rounded-2xl bg-card p-6 shadow-card space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Banknote size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Pagamentos</h2>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Percentual cobrado no ato da reserva (%)</label>
            <p className="text-[11px] text-muted-foreground">Quanto do valor total o cliente paga ao reservar. Use 0 para desativar o pagamento online.</p>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min="0"
                max="100"
                value={advancePercentage}
                onChange={(e) => setAdvancePercentage(Number(e.target.value))}
                className={`${inputClass} max-w-[120px]`}
              />
              <span className="text-sm text-foreground font-medium">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Ex: 30% → cliente paga R$ 30 numa reserva de R$ 100. Use 100 para cobrar o valor total.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Chave PIX para saques</label>
            <p className="text-[11px] text-muted-foreground">Chave PIX onde você receberá os saques do seu saldo na plataforma (CPF, CNPJ, e-mail, telefone ou chave aleatória).</p>
            <input
              type="text"
              placeholder="Sua chave PIX"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className={`${inputClass} mt-2`}
            />
          </div>
        </div>

        {/* Saldo e Saque */}
        <div className="md:col-span-2 rounded-2xl bg-card p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-accent" />
            <h2 className="text-sm font-bold text-foreground">Saldo na Plataforma</h2>
          </div>
          <div className="rounded-xl bg-accent/10 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Disponível para saque</p>
              <p className="text-2xl font-bold text-accent mt-0.5">
                R$ {(balanceCents / 100).toFixed(2).replace(".", ",")}
              </p>
            </div>
            <Wallet size={32} className="text-accent/30" />
          </div>
          {pixKey ? (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">O valor será enviado para a chave PIX <strong>{pixKey}</strong>.</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-[200px]">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount || balanceCents === 0}
                  className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-arena hover:brightness-95 disabled:opacity-50"
                >
                  {withdrawing ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />}
                  Sacar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Configure sua chave PIX acima para habilitar saques.</p>
          )}
        </div>

        {/* Public Link */}
        {arenaSlug && (
          <div className="md:col-span-2 rounded-2xl bg-primary/5 border border-primary/10 p-6">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-primary" />
              <h2 className="text-sm font-bold text-foreground">Link Público de Reservas</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Envie este link para seus clientes reservarem horários.</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/reservar/${arenaSlug}`}
                className="flex-1 rounded-xl border-0 bg-card px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-border outline-none select-all font-medium"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/reservar/${arenaSlug}`);
                  toast.success("Link copiado!");
                }}
                className="flex h-11 items-center gap-2 rounded-xl gradient-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg shrink-0"
              >
                <Copy size={16} />
                Copiar
              </button>
              <a
                href={`/reservar/${arenaSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground hover:text-foreground transition-arena ring-1 ring-inset ring-border"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="md:col-span-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </>
  );
}
