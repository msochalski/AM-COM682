import { ApiError } from "./errors";

export async function callLogicAppWebhook(
  url: string | undefined,
  payload: Record<string, unknown>,
  correlationId: string
): Promise<void> {
  if (!url) {
    throw new ApiError(500, "Logic App webhook URL not configured", "config_error");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": correlationId
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new ApiError(502, "Logic App webhook call failed", "logicapp_error", {
      status: response.status
    });
  }
}