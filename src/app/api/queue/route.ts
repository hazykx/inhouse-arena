import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { ROLES, type Role } from "@/db/schema";
import { parseRofl, RoflError } from "@/lib/rofl";
import {
  adminCancel, adminResolve, choose, chooseSide, confirmResult, fillWithBots, getQueueState, joinQueue,
  leaveQueue, listActiveLobbies, pick, QueueError, setDraftUrl, setReady, submitResult, createTestGame, endTestGame, testToolsEnabled,
} from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  const state = await getQueueState(s?.user.id ?? null);
  const admin = await isAdmin(s?.user.id);
  return NextResponse.json({ ...state, loggedIn: !!s, admin, testTools: testToolsEnabled(admin), adminLobbies: admin ? await listActiveLobbies() : [] });
}

const side = (v: unknown) => (v === "RED" ? "RED" : "BLUE");

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Nejsi přihlášený." }, { status: 401 });
  const uid = s.user.id;

  try {
    // Nahrání výsledku s ROFL souborem (multipart)
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("rofl");
      let rofl = null;
      if (file instanceof File && file.size > 0) {
        if (file.size > 200 * 1024 * 1024) throw new QueueError("Soubor je příliš velký.");
        rofl = parseRofl(Buffer.from(await file.arrayBuffer()));
      }
      await submitResult(uid, side(form.get("winner")), rofl);
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    switch (body.action) {
      case "join":
        if (!ROLES.includes(body.role)) throw new QueueError("Vyber roli.");
        await joinQueue(uid, body.role as Role);
        break;
      case "leave": await leaveQueue(uid); break;
      case "accept": await setReady(uid, true); break;
      case "decline": await setReady(uid, false); break;
      case "choose": await choose(uid, body.option === "SIDE" ? "SIDE" : "PICK", body.option === "SIDE" ? side(body.side) : undefined); break;
      case "side": await chooseSide(uid, side(body.side)); break;
      case "pick": await pick(uid, String(body.target)); break;
      case "confirm": await confirmResult(uid, !!body.accept); break;
      case "draftUrl": await setDraftUrl(uid, String(body.url ?? "")); break;
      case "test":
        if (!testToolsEnabled(await isAdmin(uid))) throw new QueueError("Testovací režim je jen pro adminy.");
        await createTestGame(uid, body.role as Role, ["win", "lose"].includes(body.coin) ? body.coin : "random");
        break;
      case "testEnd":
        await endTestGame(uid);
        break;
      case "testSimulate":
        await submitResult(uid, side(body.winner), null);
        break;
      case "bots":
        if (!testToolsEnabled(await isAdmin(uid))) throw new QueueError("Jen pro adminy.");
        await fillWithBots();
        break;
      case "cancel":
      case "resolve":
        if (!(await isAdmin(uid))) throw new QueueError("Jen pro adminy.");
        if (body.action === "cancel") await adminCancel(Number(body.lobbyId));
        if (body.action === "resolve") await adminResolve(Number(body.lobbyId), side(body.winner));
        break;
      default:
        throw new QueueError("Neznámá akce.");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof QueueError || e instanceof RoflError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Něco se pokazilo." }, { status: 500 });
  }
}
