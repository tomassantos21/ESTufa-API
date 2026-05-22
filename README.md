# 🌿 ESTufa-API

An extremely fast, secure, and modern **Serverless Node.js API** for the **ESTufa** ecosystem. Built using the modern **Azure Functions Node.js Programming Model v4**, it integrates state-of-the-art Azure Cloud services, automated AI plant detection, secure media uploads, and high-performance Redis caching.

---

## 🏗️ Architecture & Stack

The ESTufa API is built entirely on a serverless, cloud-native architecture for maximum scalability and efficiency:

*   **Runtime & Model**: Node.js (v22) using the **Azure Functions v4 Programming Model** (`@azure/functions`) with automatic worker indexing.
*   **Database**: **Azure Cosmos DB (NoSQL)** for high-availability, low-latency, and serverless metadata storage of users and plant detections.
*   **Storage**: **Azure Blob Storage** for holding plant photos, secured using transient **Shared Access Signatures (SAS)**.
*   **Artificial Intelligence**: **Azure AI Vision (Image Analysis v4.0)** for extracting semantic tags, captions, and automatically identifying whether an uploaded image contains a plant.
*   **Caching**: **Azure Container Instance (Redis)** for high-performance lazy-loaded caching to optimize read-heavy GET feeds and galleries.
*   **Infrastructure**: Fully orchestrated using **Terraform** for reproducible, declarative multi-service deployments.

---

## ⚡ Key Features

1.  **Serverless gRPC Node Worker**: Built using modern JavaScript structures with clean handlers.
2.  **Robust Redis Caching Utility**: Fully lazy-loaded and decoupled caching layer (`src/utils/cache.js`). Connects to Redis only when necessary to prevent startup gRPC blocking or timeouts, and fails back to Cosmos DB gracefully if Redis goes offline.
3.  **Active Cache Invalidation**: When a new plant photo is successfully analysed via the AI endpoint, it instantly invalidates the cache for the global feed and the specific user's gallery.
4.  **Secure Direct Uploads**: Clients fetch short-lived, permission-restricted Blob SAS tokens to upload files directly to Azure Blob Storage rather than streaming heavy files through the API.
5.  **Secure Authentication**: Secure sign-ups and sign-ins utilizing `bcryptjs` for standard password hashing.

---

## 🛠️ Installation & Local Development

### Prerequisites
*   [Node.js v22+](https://nodejs.org/)
*   [Azure Functions Core Tools v4](https://github.com/Azure/azure-functions-core-tools)
*   An active Azure Subscription (or local Azure Emulators like Azurite and Cosmos Emulator)

### Setup Steps
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/tomassantos21/ESTufa-API.git
    cd ESTufa-API
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Create a `local.settings.json` file in the project root:
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "COSMOS_DB_CONNECTION": "<YOUR_COSMOS_DB_CONNECTION_STRING>",
        "BLOB_CONNECTION_STRING": "<YOUR_AZURE_STORAGE_CONNECTION_STRING>",
        "AI_SERVICE_KEY": "<YOUR_AZURE_AI_VISION_KEY>",
        "AI_SERVICE_ENDPOINT": "<YOUR_AZURE_AI_VISION_ENDPOINT>",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
    ```
    > [!NOTE]
    > If `REDIS_URL` is omitted, the API will disable caching and fall back to querying Cosmos DB directly without throwing any errors.

4.  **Run the local dev server**:
    ```bash
    npm start
    ```
    The console will output the local HTTP endpoints (usually under `http://localhost:7071/api/`).

---

## ⚙️ Configuration & Environment Variables

| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `COSMOS_DB_CONNECTION` | **Yes** | Connection string for Azure Cosmos DB Account. |
| `BLOB_CONNECTION_STRING` | **Yes** | Connection string for Azure Storage Account (Blob container: `fotos-plantas`). |
| `AI_SERVICE_KEY` | **Yes** | API key for the Azure Computer Vision resource. |
| `AI_SERVICE_ENDPOINT` | **Yes** | Endpoint URL for the Azure Computer Vision resource. |
| `REDIS_URL` | *No* | The connection URL for Redis cache (e.g., `redis://<host>:<port>`). |

---

## 📡 API Reference

### 1. Authentication Endpoints

#### `POST /api/registerUser`
Registers a new user and hashes their password with bcrypt.

*   **Request Body**:
    ```json
    {
      "username": "jane_doe",
      "password": "securepassword123",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "bio": "Plant lover"
    }
    ```
*   **Success Response (`200 OK`)**:
    ```json
    {
      "id": "jane_doe",
      "username": "jane_doe",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "bio": "Plant lover",
      "createdAt": "2026-05-22T19:00:00.000Z"
    }
    ```
*   **Error Responses**:
    *   `400 Bad Request`: If username or password is missing.
    *   `409 Conflict`: If the username is already registered in Cosmos DB.

#### `POST /api/loginUser`
Authenticates a user and returns their profile.

*   **Request Body**:
    ```json
    {
      "username": "jane_doe",
      "password": "securepassword123"
    }
    ```
*   **Success Response (`200 OK`)**:
    ```json
    {
      "id": "jane_doe",
      "username": "jane_doe",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "bio": "Plant lover",
      "createdAt": "2026-05-22T19:00:00.000Z"
    }
    ```
*   **Error Response (`401 Unauthorized`)**: Invalid credentials or user not found.

#### `POST /api/updateUser`
Updates user profile settings (fullName, email, bio).

---

### 2. Media & AI Detection Endpoints

#### `GET /api/getUploadToken`
Generates a short-lived Shared Access Signature (SAS) URL for direct secure browser/client photo upload.

*   **Query Parameters**:
    *   `fileName` (Optional): The target name of the file. Defaults to `upload-<timestamp>.jpg`.
*   **Success Response (`200 OK`)**:
    ```json
    {
      "sasUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg?sv=...",
      "blobUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg"
    }
    ```

#### `POST /api/detectPlant`
Submits a photo URL for Azure AI Vision analysis, checks if it is a plant, saves metadata, and invalidates the cached feed/gallery.

*   **Request Body**:
    ```json
    {
      "imageUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg",
      "userId": "jane_doe",
      "username": "Jane Doe"
    }
    ```
*   **Success Response (`200 OK`)**:
    ```json
    {
      "id": "1779461118190",
      "userId": "jane_doe",
      "username": "Jane Doe",
      "imageUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg",
      "plantName": "Rose",
      "scientificName": "Rose",
      "confidence": 0.985,
      "description": "A close up of a red rose.",
      "detectedTags": ["rose", "flower", "plant", "red"],
      "isPlant": true,
      "timestamp": "2026-05-22T19:02:00.000Z"
    }
    ```

---

### 3. Read Feed Endpoints (Cached)

#### `GET /api/getFeed`
Retrieves a global chronological feed of plant uploads. Fully cached in Redis for **5 minutes** (`plants:feed`). Falls back gracefully to Cosmos DB.

*   **Success Response (`200 OK`)**:
    ```json
    [
      {
        "id": "1779461118190",
        "userId": "jane_doe",
        "username": "Jane Doe",
        "imageUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg",
        "plantName": "Rose",
        "scientificName": "Rose",
        "confidence": 0.985,
        "isPlant": true,
        "timestamp": "2026-05-22T19:02:00.000Z"
      }
    ]
    ```

#### `GET /api/getGallery`
Retrieves plant uploads uploaded by a specific user. Cached in Redis per user for **5 minutes** (`plants:gallery:<username>`).

*   **Query Parameters**:
    *   `username` (Required): The username of the user.
*   **Success Response (`200 OK`)**: Returns a filtered list of plant items.

---

## 🚀 Cloud Deployment

The production API is deployed onto an **Azure Windows Consumption Function App** and utilizes the **Run-From-Package** setting to ensure atomic, secure deployments.

### Infrastructure Deploy (Terraform)
Navigate to the Terraform folder and run:
```bash
terraform init
terraform plan
terraform apply -auto-approve
```

### Publishing Code
To deploy code directly from the local terminal to the cloud, use Azure Functions Core Tools:
```bash
func azure functionapp publish <YOUR_FUNCTION_APP_NAME> --javascript
```
This automatically resolves and pushes the complete package including pre-packaged production `node_modules`.

### Deployment Settings (WEBSITE_RUN_FROM_PACKAGE)
To guarantee that files are read directly from the zip package and never experience missing `node_modules` errors, the Azure Function setting is pinned to:
```hcl
"WEBSITE_RUN_FROM_PACKAGE" = "1"
```
This completely avoids Kudu Git Sync conflicts and provides instant, zero-downtime hot-reloads.

---

## 📝 License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
