import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Users, ChevronRight, Loader2, Zap, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/quadralivre-logo.png";

const features = [
  { icon: CalendarDays, title: "Reservas inteligentes", desc: "Gerencie horários e reservas de forma simples e rápida." },
  { icon: MapPin, title: "Múltiplas quadras", desc: "Controle todas as suas quadras em um só lugar." },
  { icon: Users, title: "Gestão de clientes", desc: "Acompanhe seus clientes e histórico de reservas." },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [arenaName, setArenaName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !arenaName)) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      } else {
        navigate("/dashboard");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            arena_name: arenaName,
          },
        },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Cadastro realizado! Verifique seu e-mail ou faça login.");
        setIsLogin(true);
      }
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left – Gradient Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-hero">
        {/* Abstract SVG pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-1/4 right-10 w-60 h-60 rounded-full bg-accent/15 blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src={logo} alt="QuadraLivre" className="h-11 w-11" />
            <span className="text-lg font-bold text-primary-foreground tracking-tight">QuadraLivre</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
            className="space-y-10"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 mb-5">
                <Zap size={14} className="text-accent" />
                <span className="text-xs font-medium text-primary-foreground/80">Plataforma #1 para arenas</span>
              </div>
              <h2 className="text-4xl font-extrabold text-primary-foreground leading-[1.1] tracking-tight">
                A gestão da sua<br />arena, simplificada.
              </h2>
              <p className="mt-4 text-base text-primary-foreground/50 max-w-sm leading-relaxed">
                Organize reservas, quadras e horários com uma plataforma pensada para donos de arenas esportivas.
              </p>
            </div>

            <div className="space-y-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: [0.2, 0, 0, 1] }}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-strong">
                    <f.icon size={20} className="text-primary-foreground/90" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-foreground">{f.title}</p>
                    <p className="text-xs text-primary-foreground/40 mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <p className="text-xs text-primary-foreground/20">© 2026 QuadraLivre. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right – Login/Signup Form */}
      <div className="flex w-full items-center justify-center bg-background px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile header */}
          <div className="lg:hidden mb-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-lg mb-4">
              <img src={logo} alt="QuadraLivre" className="h-10 w-10" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">QuadraLivre</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestão inteligente de arenas</p>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {isLogin ? "Bem-vindo de volta" : "Criar sua conta"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isLogin ? "Entre com suas credenciais para acessar o painel." : "Comece a gerenciar sua arena agora mesmo."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nome da Arena</label>
                  <input
                    type="text"
                    placeholder="Ex: Arena Beach Tennis"
                    value={arenaName}
                    onChange={(e) => setArenaName(e.target.value)}
                    className="w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-0 bg-subtle px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none transition-arena pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-arena p-1.5"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-arena hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-px disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-medium text-primary hover:underline transition-arena"
              >
                {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entre"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
