import { app } from "@azure/functions";
import { createHttpHandler, jsonResponse, readJson } from "../lib/http";
import { createUploadInit } from "../lib/uploads";
import { asRecord, readString } from "../lib/validation";

export const uploadInit = createHttpHandler(async (request) => {
  const body = await readJson<unknown>(request);
  const data = asRecord(body ?? {});
  const fileName = readString(data.fileName, "fileName", { minLength: 1 });
  const contentType = readString(data.contentType, "contentType", { minLength: 1 });
  const init = await createUploadInit({
    fileName: fileName ?? undefined,
    contentType: contentType ?? undefined
  });

  return jsonResponse(200, {
    blobName: init.blobName,
    rawBlobUrl: init.rawBlobUrl,
    uploadUrl: init.uploadUrl,
    expiresOn: init.expiresOn
  });
});

app.http("uploadInit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "api/v1/upload-init",
  handler: uploadInit
});
