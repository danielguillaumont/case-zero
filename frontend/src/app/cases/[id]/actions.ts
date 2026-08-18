"use server";

import { revalidatePath } from "next/cache";

import {
  getAuthorizationHeaders,
  getCurrentUser,
} from "@/lib/auth";


async function patchCase(
  caseId: string,
  updateData: Record<string, string>
) {
  const authorizationHeaders =
    await getAuthorizationHeaders();

  const response = await fetch(
    `http://127.0.0.1:8000/api/cases/${caseId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json",
        ...authorizationHeaders,
      },
      body: JSON.stringify(
        updateData
      ),
      cache: "no-store",
    }
  );

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to update cases."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Failed to update case."
    );
  }

  revalidatePath(
    `/cases/${caseId}`
  );

  revalidatePath(
    "/cases"
  );

  revalidatePath(
    "/"
  );
}


export async function updateCaseStatus(
  caseId: string,
  status: string,
  _formData: FormData
) {
  await patchCase(
    caseId,
    {
      status,
    }
  );
}


export async function assignCaseToMe(
  caseId: string,
  _formData: FormData
) {
  const currentUser =
    await getCurrentUser();

  if (!currentUser) {
    throw new Error(
      "You must be signed in to assign a case."
    );
  }

  await patchCase(
    caseId,
    {
      assigned_analyst:
        currentUser.display_name,
    }
  );
}


export async function addCaseNote(
  caseId: string,
  formData: FormData
) {
  const content =
    formData.get("content");

  if (
    typeof content !== "string"
    || content.trim().length === 0
  ) {
    throw new Error(
      "Investigation note cannot be empty."
    );
  }

  const authorizationHeaders =
    await getAuthorizationHeaders();

  const response = await fetch(
    `http://127.0.0.1:8000/api/cases/${caseId}/notes`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        ...authorizationHeaders,
      },
      body: JSON.stringify({
        content:
          content.trim(),
      }),
      cache: "no-store",
    }
  );

  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please sign in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to add investigation notes."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Failed to add investigation note."
    );
  }

  revalidatePath(
    `/cases/${caseId}`
  );
}