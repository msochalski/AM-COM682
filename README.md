# AM-COM682 Cloud Module CW2

Complete Azure serverless solution with a React SPA, Azure Functions API, queue-based media processing, Azure SQL, Cosmos DB, Logic App moderation, and CI/CD workflows.

## Architecture
- **Frontend**: React + Vite SPA hosted on Azure Storage static website.
- **Backend**: Azure Functions v4 (Node.js + TypeScript) with HTTP API + queue worker.
- **Storage**: Blob containers `raw` and `processed`, queue `media-process`.
- **Data**: Azure SQL (canonical relational model) and Cosmos DB (feed/comments/tags).
- **Moderation**: Logic App webhook invoked on publish; Logic App calls back approve/block endpoints.
- **Observability**: Structured logs with correlation id + health endpoint.

## Repo layout
- `api/` Azure Functions TypeScript app
- `web/` React + Vite SPA
- `.github/workflows/` GitHub Actions CI/CD
- `postman/` Postman collection

## API routes (base `/api/v1`)
- `GET /health`
- `POST /upload-init`
- `POST /recipes`
- `GET /recipes`
- `GET /recipes/{id}`
- `PATCH /recipes/{id}`
- `DELETE /recipes/{id}`
- `POST /recipes/{id}/publish`
- `POST /recipes/{id}/approve`
- `POST /recipes/{id}/block`
- `POST /recipes/{id}/reprocess-image`
- `GET /feed`
- `POST /recipes/{id}/comments`
- `GET /recipes/{id}/comments`
- `POST /recipes/{id}/favorite`
- `DELETE /recipes/{id}/favorite`

## Environment variables (Azure Function App)
Required values are read by the API at runtime:

- `AzureWebJobsStorage` (storage connection string for queue trigger)
- `FUNCTIONS_WORKER_RUNTIME` = `node`
- `SQL_SERVER`
- `SQL_DATABASE`
- `SQL_USER`
- `SQL_PASSWORD`
- `SQL_PORT` (optional)
- `SQL_ENCRYPT` (`true` or `false`)
- `SQL_TRUST_CERT` (`true` or `false`)
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `COSMOS_DB`
- `COSMOS_FEED_CONTAINER` (default `feed`)
- `COSMOS_COMMENTS_CONTAINER` (default `comments`)
- `COSMOS_TAGS_CONTAINER` (default `tags`)
- `BLOB_ACCOUNT` (or `BLOB_CONNECTION_STRING`)
- `BLOB_KEY` (required if not using `BLOB_CONNECTION_STRING`)
- `RAW_CONTAINER` (default `raw`)
- `PROCESSED_CONTAINER` (default `processed`)
- `MEDIA_QUEUE` (default `media-process`)
- `LOGICAPP_WEBHOOK_URL`
- `CORS_ORIGIN` (default `http://localhost:5173`)
- `DEFAULT_USER_ID` (default `00000000-0000-0000-0000-000000000001`)

Optional:
- `APPLICATIONINSIGHTS_CONNECTION_STRING` (if not provided by Azure)

## Cosmos container partition keys
- Database: `micromeals`
- Containers: `feed`, `comments`, `tags`
- Feed container: `/pk` (items use `pk: "feed"`)
- Comments container: `/recipeId`
- Tags container: `/pk`

## SQL migrations
- SQL schema is in `api/sql/001_init.sql`.
- Run migrations locally:
  - `npm --prefix api run migrate`

## Web environment
- `VITE_API_BASE_URL` (default `http://localhost:7071`)

## Local development
1. Install dependencies:
   - `npm install --prefix api`
   - `npm install --prefix web`
2. Create `api/local.settings.json` from `api/local.settings.example.json` and fill values.
3. Run migrations:
   - `npm --prefix api run migrate`
4. Start services:
   - API: `npm --prefix api run dev`
   - Web: `npm --prefix web run dev`

## Tests
- API unit tests: `npm --prefix api run test`

## CI/CD secrets (GitHub Actions)
- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
- `AZURE_FUNCTIONAPP_NAME`
- `AZURE_STORAGE_ACCOUNT`
- `AZURE_STORAGE_KEY`

## Storage setup
- Create blob containers `raw` and `processed`.
- Create queue `media-process`.
- Ensure `processed` is readable by your SPA (public access or SAS-protected URLs).

## Postman
- Collection: `postman/AM-COM682.postman_collection.json`
