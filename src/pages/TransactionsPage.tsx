import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

type DateFilter = "today" | "this_month" | "last_30" | "last_90" | "custom";

export default function TransactionsPage() {
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const getFilterDates = (filter: DateFilter) => {
    const now = new Date();
    switch (filter) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "this_month":
        return { from: startOfMonth(now), to: endOfDay(now) };
      case "last_30":
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case "last_90":
        return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
      case "custom":
        return { from: dateRange.from, to: dateRange.to ? endOfDay(dateRange.to) : undefined };
      default:
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  };

  const handleFilterChange = (value: DateFilter) => {
    setDateFilter(value);
    if (value !== "custom") {
      setDateRange(getFilterDates(value));
    }
  };

  const currentDates = getFilterDates(dateFilter);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", user?.id, currentDates.from?.toISOString(), currentDates.to?.toISOString()],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (currentDates.from) {
        query = query.gte("created_at", currentDates.from.toISOString());
      }
      if (currentDates.to) {
        query = query.lte("created_at", currentDates.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const formatCurrency = (cents: number) => {
    const value = Math.abs(cents) / 100;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
    
    return cents < 0 ? `-${formatted}` : formatted;
  };

  const getTypeLabel = (type: string) => {
    if (type === "pix_payment") return { label: "Entrada • Pix", isPositive: true };
    return { label: "Saída • Pix", isPositive: false };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Extrato</h1>
          <p className="text-muted-foreground mt-1">
            Histórico completo de transações da sua arena.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Movimentações</CardTitle>
            
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: "today", label: "Hoje" },
                  { value: "this_month", label: "Esse mês" },
                  { value: "last_30", label: "Últimos 30 dias" },
                  { value: "last_90", label: "Últimos 90 dias" },
                  { value: "custom", label: "Personalizado" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={dateFilter === option.value ? "default" : "outline"}
                    className={dateFilter === option.value ? "bg-emerald-500 hover:bg-emerald-600 border-none px-4 rounded-xl" : "px-4 rounded-xl border-border bg-transparent text-muted-foreground hover:bg-subtle"}
                    onClick={() => handleFilterChange(option.value as DateFilter)}
                    size="sm"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[240px] justify-start text-left font-normal rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange as any}
                      onSelect={(range: any) => setDateRange(range || {})}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : transactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhuma transação encontrada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions?.map((transaction) => {
                    const { label, isPositive } = getTypeLabel(transaction.type);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {transaction.description}
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {isPositive ? (
                              <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-red-500" />
                            )}
                            {label}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatCurrency(transaction.amount_cents)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
