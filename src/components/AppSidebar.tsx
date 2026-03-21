import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarDays, MapPin, Clock, Settings, Menu, X, LogOut, User, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/quadralivre-logo.png";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reservas", label: "Reservas", icon: CalendarDays },
  { to: "/quadras", label: "Quadras", icon: MapPin },
  { to: "/horarios", label: "Horários", icon: Clock },
  { to: "/extrato", label: "Extrato", icon: FileText },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const userEmail = user?.email ?? "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card/95 backdrop-blur-lg px-4 py-3 shadow-sm md:hidden">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="QuadraLivre" className="h-8 w-8" />
          <span className="text-sm font-bold text-foreground tracking-tight">QuadraLivre</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-subtle text-muted-foreground transition-arena hover:bg-secondary"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-card border-r border-border transition-arena md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
          <img src={logo} alt="QuadraLivre" className="h-9 w-9" />
          <span className="text-base font-bold text-foreground tracking-tight">QuadraLivre</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-arena ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-subtle hover:text-foreground"
                }`}
              >
                <item.icon size={20} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-arena hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut size={18} strokeWidth={1.5} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
