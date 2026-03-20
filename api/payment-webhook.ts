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

    const pixEvents = ["billing.paid", "pixQrCode.paid", "checkout.completed", "transparent.completed"];
    if (!pixEvents.includes(eventType)) {
      console.log("Evento ignorado:", eventType);
      return res.status(200).json({ received: true });
    }

    // Tenta extrair externalId e paymentId de vários formatos possíveis
    const externalId: string =
      paymentData?.externalId ??
      paymentData?.billing?.externalId ??
      paymentData?.pixQrCode?.externalId ??
      paymentData?.checkout?.externalId ?? "";

    const paymentId: string =
      paymentData?.id ??
      paymentData?.billing?.id ??
      paymentData?.pixQrCode?.id ??
      paymentData?.checkout?.id ?? "";

    const amountPaidCents: number =
      paymentData?.amount ??
      paymentData?.billing?.amount ??
      paymentData?.pixQrCode?.amount ??
      paymentData?.checkout?.amount ?? 0;

    console.log("Webhook recebido:", eventType, "externalId:", externalId, "paymentId:", paymentId);

    if (!externalId && !paymentId) {
      return res.status(200).json({ received: true });
    }

    // Busca a reserva pelo externalId ou pelo payment_id
    let reservation: any = null;

    if (externalId) {
      const { data } = await supabaseAdmin
        .from("reservations")
        .select("id, user_id")
        .eq("id", externalId)
        .maybeSingle();
      reservation = data;
    }

    if (!reservation && paymentId) {
      const { data } = await supabaseAdmin
        .from("reservations")
        .select("id, user_id")
        .eq("payment_id", paymentId)
        .maybeSingle();
      reservation = data;
    }

    if (!reservation) {
      console.warn("Reserva não encontrada. externalId:", externalId, "paymentId:", paymentId);
      return res.status(200).json({ received: true });
    }

    // Atualiza a reserva como paga
    await supabaseAdmin
      .from("reservations")
      .update({
        status_pagamento: "pago",
        amount_paid: amountPaidCents / 100,
        status: "agendado",
        payment_id: paymentId || undefined,
      })
      .eq("id", reservation.id);

    // Credita o saldo da arena na plataforma
    await supabaseAdmin.rpc("increment_balance", {
      p_user_id: reservation.user_id,
      p_amount_cents: amountPaidCents,
    });

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("payment-webhook error:", error);
    return res.status(500).json({ error: error.message });
  }
}
