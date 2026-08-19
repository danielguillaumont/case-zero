import "server-only";

import { cookies } from "next/headers";


const API_BASE_URL =
  process.env.CASE_ZERO_API_URL
  ?? "http://127.0.0.1:8000";


const IS_PRODUCTION =
  process.env.NODE_ENV
  === "production";


export const SESSION_COOKIE_NAME =
  IS_PRODUCTION
    ? "__Host-casezero_access_token"
    : "casezero_access_token";


export type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
  role:
    | "administrator"
    | "analyst"
    | "viewer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};


export async function getAccessToken():
Promise<string | null> {
  const cookieStore =
    await cookies();

  return (
    cookieStore.get(
      SESSION_COOKIE_NAME
    )?.value
    ?? null
  );
}


export async function getAuthorizationHeaders():
Promise<Record<string, string>> {
  const accessToken =
    await getAccessToken();

  if (!accessToken) {
    return {};
  }

  return {
    Authorization:
      `Bearer ${accessToken}`,
  };
}


export async function getCurrentUser():
Promise<CurrentUser | null> {
  const accessToken =
    await getAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/auth/me`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}