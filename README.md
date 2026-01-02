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
- `GET /health` - Health check with dependency status
- `GET /version` - Version and build info
- `POST /admin/init-sql` - Initialize SQL schema (requires X-ADMIN-KEY header)
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

---

## Azure Portal Setup (No CLI)

This section provides step-by-step portal-only instructions for configuring all Azure resources.

### 1. Create Required Azure Resources

Before setting up CI/CD, create these resources in Azure Portal:

1. **Resource Group**: Create a resource group (e.g., `rg-micromeals-cw2`)
2. **Storage Account**: General Purpose v2, Standard_LRS
3. **Azure SQL Database**: Basic tier is sufficient for CW2
4. **Cosmos DB Account**: API: NoSQL (Core), Serverless capacity
5. **Function App**: Node.js 20 LTS, Windows, Consumption plan
6. **Logic App** (optional): For moderation workflow

### 2. Storage Account Setup

#### Enable Static Website Hosting
1. Go to your **Storage Account** → **Data management** → **Static website**
2. Click **Enabled**
3. Set **Index document name**: `index.html`
4. Set **Error document path**: `index.html` (for SPA routing)
5. Click **Save**
6. Copy the **Primary endpoint** URL (e.g., `https://youraccount.z6.web.core.windows.net/`)

#### Create Blob Containers
1. Go to **Storage Account** → **Data storage** → **Containers**
2. Click **+ Container** and create:
   - `raw` (Private access)
   - `processed` (Blob anonymous read access for public images, or Private if using SAS)

#### Create Queue
1. Go to **Storage Account** → **Data storage** → **Queues**
2. Click **+ Queue** and create: `media-process`

#### Get Storage Account Keys
1. Go to **Storage Account** → **Security + networking** → **Access keys**
2. Copy **Storage account name** and **key1** (for GitHub secrets)

#### Configure Blob CORS (for SAS uploads from browser)
1. Go to **Storage Account** → **Settings** → **Resource sharing (CORS)**
2. Under **Blob service**, add a rule:
   - **Allowed origins**: `http://localhost:5173, https://youraccount.z6.web.core.windows.net`
   - **Allowed methods**: `GET, PUT, POST, HEAD, OPTIONS`
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: `3600`
3. Click **Save**

### 3. Azure SQL Database Setup

#### Run SQL Schema
1. Go to **SQL Database** → **Query editor (preview)**
2. Login with your SQL admin credentials
3. Copy contents of `api/sql/001_init.sql`
4. Paste into query editor and click **Run**
5. Verify tables created: `schema_migrations`, `users`, `recipes`, `reviews`, `favorites`, `ingredients`, `recipe_ingredients`, `categories`, `recipe_categories`

**Alternative**: After deployment, call `POST /api/v1/admin/init-sql` with `X-ADMIN-KEY` header.

#### Get SQL Connection Info
1. Go to **SQL Database** → **Overview**
2. Copy **Server name** (e.g., `yourserver.database.windows.net`)
3. Go to **SQL Server** → **Settings** → **SQL databases** to find database name

### 4. Cosmos DB Setup

#### Create Database and Containers
1. Go to **Cosmos DB Account** → **Data Explorer**
2. Click **New Database**: `micromeals`
3. Click **New Container** in `micromeals` database:
   - Container: `feed`, Partition key: `/pk`
   - Container: `comments`, Partition key: `/recipeId`
   - Container: `tags`, Partition key: `/pk`

#### Get Cosmos DB Keys
1. Go to **Cosmos DB Account** → **Settings** → **Keys**
2. Copy **URI** (for COSMOS_ENDPOINT)
3. Copy **PRIMARY KEY** (for COSMOS_KEY)

### 5. Function App Configuration

#### Get Publish Profile (for GitHub Actions)
1. Go to **Function App** → **Overview**
2. Click **Get publish profile** (downloads XML file)
3. Copy entire file contents for GitHub secret

#### Configure Application Settings
Go to **Function App** → **Settings** → **Environment variables** → **App settings**

Add these settings:

| Setting | Value | Where to find |
|---------|-------|---------------|
| `FUNCTIONS_WORKER_RUNTIME` | `node` | Static |
| `SQL_SERVER` | `yourserver.database.windows.net` | SQL Database → Overview |
| `SQL_DATABASE` | `your-db-name` | SQL Database → Overview |
| `SQL_USER` | `your-admin-user` | Set during SQL Server creation |
| `SQL_PASSWORD` | `your-admin-password` | Set during SQL Server creation |
| `SQL_ENCRYPT` | `true` | Static (Azure SQL requires encryption) |
| `COSMOS_ENDPOINT` | `https://xxx.documents.azure.com:443/` | Cosmos DB → Keys |
| `COSMOS_KEY` | `your-cosmos-primary-key` | Cosmos DB → Keys |
| `COSMOS_DB` | `micromeals` | Cosmos DB → Data Explorer |
| `BLOB_ACCOUNT` | `yourstorageaccount` | Storage Account → Overview |
| `BLOB_KEY` | `your-storage-key` | Storage Account → Access keys |
| `RAW_CONTAINER` | `raw` | Static |
| `PROCESSED_CONTAINER` | `processed` | Static |
| `MEDIA_QUEUE` | `media-process` | Static |
| `LOGICAPP_WEBHOOK_URL` | `https://...` | Logic App → HTTP trigger URL |
| `CORS_ORIGIN` | `https://youraccount.z6.web.core.windows.net` | Storage Account → Static website |
| `ADMIN_KEY` | `your-secret-admin-key` | Generate a strong random string |

Click **Apply** after adding all settings.

#### Configure Function App CORS
1. Go to **Function App** → **API** → **CORS**
2. Add allowed origins:
   - `http://localhost:5173` (local development)
   - `https://youraccount.z6.web.core.windows.net` (your static website URL)
3. Check **Enable Access-Control-Allow-Credentials** if needed
4. Click **Save**

### 6. GitHub Secrets Configuration

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these **Repository secrets**:

| Secret Name | Value |
|-------------|-------|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Entire contents of downloaded publish profile XML |
| `AZURE_STORAGE_ACCOUNT` | Storage account name |
| `AZURE_STORAGE_KEY` | Storage account key1 |

Add this **Repository variable** (Settings → Variables → Actions):

| Variable Name | Value |
|---------------|-------|
| `VITE_API_BASE_URL` | `https://your-function-app.azurewebsites.net` |

### 7. Validate End-to-End Setup

#### Test Health Endpoint
```bash
curl https://your-function-app.azurewebsites.net/api/v1/health
```

Expected response (all dependencies healthy):
```json
{
  "ok": true,
  "checks": {
    "sql": { "ok": true },
    "cosmos": { "ok": true },
    "blob": { "ok": true },
    "queue": { "ok": true }
  }
}
```

If any check fails, the response includes error details:
```json
{
  "ok": false,
  "checks": {
    "sql": { "ok": false, "error": "Login failed for user 'xxx'" },
    "cosmos": { "ok": true },
    "blob": { "ok": true },
    "queue": { "ok": true }
  }
}
```

#### Test Version Endpoint
```bash
curl https://your-function-app.azurewebsites.net/api/v1/version
```

#### Initialize SQL Schema (Alternative to Portal Query Editor)
```bash
curl -X POST https://your-function-app.azurewebsites.net/api/v1/admin/init-sql \
  -H "X-ADMIN-KEY: your-admin-key"
```

---

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
- `ADMIN_KEY` (required for `/api/v1/admin/init-sql` endpoint)

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
- Run migrations via API (after deployment):
  - `POST /api/v1/admin/init-sql` with `X-ADMIN-KEY` header
- Run migrations via Azure Portal:
  - SQL Database → Query editor → paste and run `001_init.sql`

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

### Required Secrets
| Secret | Description |
|--------|-------------|
| `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` | Function App publish profile XML |
| `AZURE_STORAGE_ACCOUNT` | Storage account name for static website |
| `AZURE_STORAGE_KEY` | Storage account access key |

### Required Variables
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Function App URL (e.g., `https://xxx.azurewebsites.net`) |

## Storage setup
- Create blob containers `raw` and `processed`.
- Create queue `media-process`.
- Enable static website hosting for the `$web` container.
- Ensure `processed` is readable by your SPA (public access or SAS-protected URLs).

## Troubleshooting

### Health Check Returns 503
1. Check the response JSON for which dependency failed
2. Common issues:
   - **SQL**: Firewall rules not set, wrong credentials
   - **Cosmos**: Wrong endpoint/key, database doesn't exist
   - **Blob**: Container doesn't exist, wrong account/key
   - **Queue**: Queue doesn't exist

### Deployment Fails
1. Check GitHub Actions logs
2. Ensure all secrets are set correctly
3. For Functions: verify publish profile is complete XML

### Static Website Returns 404
1. Ensure static website hosting is enabled
2. Check that `index.html` exists in `$web` container
3. Verify VITE_API_BASE_URL is set correctly

### CORS Errors
1. Add your domain to Function App CORS settings
2. Add your domain to Storage Account Blob CORS settings

## Postman
- Collection: `postman/AM-COM682.postman_collection.json`
- Set `baseUrl` variable to your Function App URL
