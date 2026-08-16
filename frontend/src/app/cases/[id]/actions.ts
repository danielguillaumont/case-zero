"use server";

import { revalidatePath } from "next/cache";


async function patchCase(
  caseId: string,
  updateData: Record<string, string>
) {
  const response = await fetch(
    `http://127.0.0.1:8000/api/cases/${caseId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update case.");
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/");
}


export async function updateCaseStatus(
  caseId: string,
  status: string,
  _formData: FormData
) {
  await patchCase(caseId, {
    status,
  });
}