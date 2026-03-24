import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE = "https://genialchat.uazapi.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("uazapi_token")
    .eq("user_id", user.id)
    .single();

  if (!profile?.uazapi_token) {
    return res.status(400).json({ error: "Inst\u00e2ncia n\u00e3o criada ainda" });
  }

  const instanceToken = profile.uazapi_token;

  // Tenta 1: GET /instance/qrcode (endpoint dedicado de QR)
  try {
    const qrRes = await fetch(`${BASE}/instance/qrcode`, {
      method: "GET",
      headers: { Accept: "application/json", token: instanceToken },
    });
    const qrData = await qrRes.json();
    console.log("[whatsapp-connect] GET /instance/qrcode response:", JSON.stringify(qrData));

    const qr = extractQr(qrData);
    if (qr) {
      await createWebhook(instanceToken);
      return res.status(200).json({ qrcode: qr, _raw: qrData });
    }

    if (isConnected(qrData)) {
      await createWebhook(instanceToken);
      return res.status(200).json({ connected: true, status: "open", _raw: qrData });
    }
  } catch (e) {
    console.warn("[whatsapp-connect] GET /instance/qrcode failed:", e);
  }

  // Tenta 2: POST /instance/connect
  try {
    const connectRes = await fetch(`${BASE}/instance/connect`, {
      method: "POST",
      headers: { Accept: "application/json", token: instanceToken, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const connectData = await connectRes.json();
    console.log("[whatsapp-connect] POST /instance/connect response:", JSON.stringify(connectData));

    const qr = extractQr(connectData);
    if (qr) {
      await createWebhook(instanceToken);
      return res.status(200).json({ qrcode: qr, _raw: connectData });
    }

    if (isConnected(connectData)) {
      await createWebhook(instanceToken);
      return res.status(200).json({ connected: true, status: "open", _raw: connectData });
    }

    return res.status(200).json({ _raw: connectData, _debug: "no_qr_found" });
  } catch (e: any) {
    console.error("[whatsapp-connect] POST /instance/connect failed:", e);
    return res.status(500).json({ error: e.message || "Erro ao conectar" });
  }
}

function extractQr(data: any): string | null {
  const candidates = [
    data?.qrcode,
    data?.qr,
    data?.QRCode,
    data?.qrCode,
    data?.base64,
    data?.data?.qrcode,
    data?.data?.qr,
    data?.data?.QRCode,
    data?.data?.base64,
    data?.instance?.qrcode,
    data?.instance?.qr,
  ];
  return candidates.find((c) => typeof c === "string" && c.length > 20) ?? null;
}

function isConnected(data: any): boolean {
  const instanceStatus = (data?.instance?.status || "").toLowerCase();
  const statusConnected = data?.status?.connected === true;
  const statusLoggedIn = data?.status?.loggedIn === true;
  const legacyStatus = (data?.status || data?.state || "").toLowerCase();
  return (
    instanceStatus === "connected" ||
    statusConnected ||
    statusLoggedIn ||
    legacyStatus === "open" ||
    legacyStatus === "connected" ||
    !!data?.connected
  );
}

async function createWebhook(instanceToken: string): Promise<void> {
  // URL de callback — usada como refer\u00eancia mesmo desabilitada
  const appUrl = process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://quadralivre.vercel.app");

  const webhookUrl = `${appUrl}/api/whatsapp-webhook`;

  try {
    const body = JSON.stringify({
      action: "add",
      enabled: false,          // desabilitado: s\u00f3 envia, n\u00e3o recebe mensagens
      url: webhookUrl,
      events: ["messages"],
      excludeMessages: [
        "wasSentByApi",
        "fromMeYes",
        "isGroupYes",
      ],
    });

    const webhookRes = await fetch(`https://genialchat.uazapi.com/webhook`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        token: instanceToken,
        "Content-Type": "application/json",
      },
      body,
    });

    const webhookData = await webhookRes.json().catch(() => ({}));
    console.log("[whatsapp-connect] webhook criado:", JSON.stringify(webhookData));
  } catch (e) {
    // N\u00e3o bloqueia o fluxo se o webhook falhar
    console.warn("[whatsapp-connect] falha ao criar webhook:", e);
  }
}
