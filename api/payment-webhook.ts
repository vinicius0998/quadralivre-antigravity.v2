import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;
    const eventType: string = event?.event ?? "";
    const paymentData = event?.data ?? {};

    // Só processa eventos de checkout/pagamento completado
    if (!["checkout.completed", "transparent.completed"].includes(eventType)) {
      return res.status(200).json({ received: true });
    }

    const externalId: string = paymentData?.externalId ?? paymentData?.checkout?.externalId ?? "";
    const paymentId: string = paymentData?.id ?? paymentData?.checkout?.id ?? "";
    const amountPaid: number = paymentData?.amount ?? paymentData?.checkout?.amount ?? 0;

    if (!externalId && !paymentId) {
      console.warn("Webhook sem externalId ou paymentId:", event);
      return res.status(200).json({ received: true });
    }

    // Busca a reserva pelo externalId (reservationId) ou payment_id
    let query = supabaseAdmin.from("reservations").select("id, status, user_id");

    if (externalId) {
      query = query.eq("id", externalId) as any;
    } else {
      query = query.eq("payment_id", paymentId) as any;
    }

    const { data: reservation, error } = await (query as any).single();

    if (error || !reservation) {
      console.warn("Reserva não encontrada para o webhook:", externalId || paymentId);
      return res.status(200).json({ received: true });
    }

    // Atualiza o status de pagamento
    await supabaseAdmin
      .from("reservations")
      .update({
        status_pagamento: "pago",
        amount_paid: amountPaid / 100, // AbacatePay envia em centavos
        status: "agendado",
        payment_id: paymentId || undefined,
      })
      .eq("id", reservation.id);

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("payment-webhook error:", error);
    return res.status(500).json({ error: error.message });
  }
}
