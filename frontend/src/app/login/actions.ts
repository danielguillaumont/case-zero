"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE_NAME,
} from "@/lib/auth";


const API_BASE_URL =
  process.env.CASE_ZERO_API_URL
  ?? "http://127.0.0.1:8000";


const IS_PRODUCTION =
  process.env.NODE_ENV
  === "production";


type LoginResponse = {
  access_token: string;
  token_type: string;
};


function redirectToLoginError(
  message: string
): never {
  redirect(
    `/login?error=${encodeURIComponent(
      message
    )}`
  );
}


export async function loginAction(
  formData: FormData
) {
  const emailValue =
    formData.get("email");

  const passwordValue =
    formData.get("password");

  if (
    typeof emailValue !== "string"
    || typeof passwordValue !== "string"
  ) {
    redirectToLoginError(
      "Email and password are required."
    );
  }

  const email =
    emailValue.trim().toLowerCase();

  const password =
    passwordValue;

  if (
    email.length === 0
    || password.length === 0
  ) {
    redirectToLoginError(
      "Email and password are required."
    );
  }

  const loginBody =
    new URLSearchParams({
      username: email,
      password,
    });

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: loginBody.toString(),
        cache: "no-store",
      }
    );
  } catch {
    redirectToLoginError(
      "CASE//ZERO API is unavailable."
    );
  }

  if (response.status === 401) {
    redirectToLoginError(
      "Invalid email or password."
    );
  }

  if (response.status === 403) {
    redirectToLoginError(
      "This account is inactive."
    );
  }

  if (!response.ok) {
    redirectToLoginError(
      "Unable to sign in."
    );
  }

  const loginResponse = (
    await response.json()
  ) as LoginResponse;

  if (
    !loginResponse.access_token
    || loginResponse.token_type
      !== "bearer"
  ) {
    redirectToLoginError(
      "Invalid authentication response."
    );
  }

  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    loginResponse.access_token,
    {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "lax",
      path: "/",
    }
  );

  redirect("/");
}


export async function logoutAction() {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    SESSION_COOKIE_NAME
  );

  redirect("/login");
}