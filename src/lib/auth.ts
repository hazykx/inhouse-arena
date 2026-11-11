import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const env = process.env;

/** Poskytovatele zapínáme jen tehdy, když mají vyplněné klíče v .env */
const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};

if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
  socialProviders.discord = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    // Později můžeš přidat "guilds.join" a hráče automaticky přidávat na svůj server
  };
}
if (env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) {
  socialProviders.twitch = {
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    disableSignUp: true, // Twitch slouží jen k propojení, ne k registraci
  };
}
if (env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET) {
  socialProviders.kick = {
    clientId: env.KICK_CLIENT_ID,
    clientSecret: env.KICK_CLIENT_SECRET,
    disableSignUp: true, // Kick slouží jen k propojení, ne k registraci
  };
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  socialProviders,
  // Chyby přihlášení zobrazíme na vlastní české stránce
  onAPIError: { errorURL: "/chyba" },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["discord", "twitch", "kick"],
      // Twitch/Kick účet může mít jiný e-mail než Discord – propojení probíhá
      // jen u přihlášeného hráče, takže je to v pořádku.
      allowDifferentEmails: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Každý nový hráč dostane herní profil se startovním MMR
        after: async (u) => {
          await db.insert(schema.profile).values({ userId: u.id }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export const enabledProviders = {
  discord: !!socialProviders.discord,
  twitch: !!socialProviders.twitch,
  kick: !!socialProviders.kick,
};
