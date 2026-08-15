"use server";

import { revalidatePath } from "next/cache";


async function patchAlert(
  alertId: string,
  updateData: Record<string, string>
) {
  const response = await fetch(
    `http://127.0.0.1:8000/api/alerts/${alertId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update alert.");
  }

  revalidatePath(`/alerts/${alertId}`);
  revalidatePath("/alerts");
  revalidatePath("/");
}


export async function updateAlertStatus(
  alertId: string,
  status: string,
  _formData: FormData
) {
  await patchAlert(alertId, {
    status,
  });
}


export async function assignAlertToMe(
  alertId: string,
  _formData: FormData
) {
  await patchAlert(alertId, {
    assigned_analyst: "Daniel Guillaumont",
  });
}