import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// drive.file scope: the app can only see/create files it created itself, not
// Scott's whole Drive. That's enough for our dedicated "Biographer Data"
// folder and avoids Google's stricter verification requirements for
// broader Drive scopes.
const DRIVE_SCOPE = "openid email profile https://www.googleapis.com/auth/drive.file";

/**
 * Google access tokens expire after ~1 hour. Exchanges the stored refresh
 * token for a fresh one via Google's token endpoint.
 */
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const tokens = await response.json();
  if (!response.ok) throw tokens;
  return {
    accessToken: tokens.access_token as string,
    expiresAt: Math.floor(Date.now() / 1000 + tokens.expires_in),
    // Google doesn't always return a new refresh token - keep the old one if absent.
    refreshToken: (tokens.refresh_token as string | undefined) ?? refreshToken,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: DRIVE_SCOPE,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      const stillValid = token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000;
      if (stillValid) return token;

      if (!token.refreshToken) {
        token.error = "RefreshTokenError";
        return token;
      }

      try {
        const refreshed = await refreshAccessToken(token.refreshToken);
        token.accessToken = refreshed.accessToken;
        token.expiresAt = refreshed.expiresAt;
        token.refreshToken = refreshed.refreshToken;
        delete token.error;
      } catch {
        // Refresh failed (e.g. revoked) - drop the stale access token so
        // callers fall back to their "not signed in" path instead of
        // hitting Google with an expired credential.
        delete token.accessToken;
        token.error = "RefreshTokenError";
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.expiresAt = token.expiresAt as number | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    expiresAt?: number;
    error?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
