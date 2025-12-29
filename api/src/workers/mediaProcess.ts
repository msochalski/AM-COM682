import { app } from "@azure/functions";
import { processMediaJob } from "./mediaProcessor";

app.storageQueue("mediaProcess", {
  queueName: process.env.MEDIA_QUEUE ?? "media-process",
  connection: "AzureWebJobsStorage",
  handler: async (message: unknown, context) => {
    let payload: { recipeId?: string; blobName?: string } = {};

    if (typeof message === "string") {
      try {
        payload = JSON.parse(message);
      } catch {
        payload = {};
      }
    } else if (typeof message === "object" && message !== null) {
      payload = message as { recipeId?: string; blobName?: string };
    }

    await processMediaJob({
      recipeId: payload.recipeId ?? "",
      blobName: payload.blobName ?? ""
    }, context);
  }
});
