import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

/** Aktuální přihlášený uživatel (nebo null). Volá se jen jednou za request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
