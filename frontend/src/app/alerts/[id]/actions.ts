"use server";

import { revalidatePath } from "next/cache";

import {
  getAuthorizationHeaders,
  getCurrentUser,
} from "@/lib/auth";


async function patchAlert(
  alertId: string,
  updateData: Record<string, string>
) {
  const authorizationHeaders =
    await getAuthorizationHeaders();

  const response = await fetch(
    `http://127.0.0.1:8000/api/alerts/${alertId}`,
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
      "You do not have permission to update alerts."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Failed to update alert."
    );
  }

  revalidatePath(
    `/alerts/${alertId}`
  );

  revalidatePath(
    "/alerts"
  );

  revalidatePath(
    "/cases"
  );

  revalidatePath(
    "/"
  );
}


export async function updateAlertStatus(
  alertId: string,
  status: string,
  _formData: FormData
) {
  await patchAlert(
    alertId,
    {
      status,
    }
  );
}


export async function assignAlertToMe(
  alertId: string,
  _formData: FormData
) {
  const currentUser =
    await getCurrentUser();

  if (!currentUser) {
    throw new Error(
      "You must be signed in to assign an alert."
    );
  }

  await patchAlert(
    alertId,
    {
      assigned_analyst:
        currentUser.display_name,
    }
  );
}


export async function createCaseFromAlert(
  alertId: string,
  _formData: FormData
) {
  const authorizationHeaders =
    await getAuthorizationHeaders();

  const response = await fetch(
    `http://127.0.0.1:8000/api/alerts/${alertId}/case`,
    {
      method: "POST",
      headers:
        authorizationHeaders,
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
      "You do not have permission to create cases."
    );
  }

  if (!response.ok) {
    throw new Error(
      "Failed to create investigation case."
    );
  }

  revalidatePath(
    `/alerts/${alertId}`
  );

  revalidatePath(
    "/alerts"
  );

  revalidatePath(
    "/cases"
  );

  revalidatePath(
    "/"
  );
}


export async function linkAlertToExistingCase(
  alertId: string,
  formData: FormData
) {
  const caseId =
    formData.get("case_id");

  if (
    typeof caseId !== "string"
    || caseId.trim().length === 0
  ) {
    throw new Error(
      "An investigation case must be selected."
    );
  }

  await patchAlert(
    alertId,
    {
      case_id: caseId,
    }
  );

  revalidatePath(
    `/cases/${caseId}`
  );
}