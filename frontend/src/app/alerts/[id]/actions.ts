"use server";

import { revalidatePath } from "next/cache";


export async function updateAlertStatus(
  alertId: string,
  status: string,
  _formData: FormData
) {
  const response = await fetch(
    `http://127.0.0.1:8000/api/alerts/${alertId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update alert status.");
  }

  revalidatePath(`/alerts/${alertId}`);
  revalidatePath("/alerts");
  revalidatePath("/");
}