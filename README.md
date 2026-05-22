# 🌿 ESTufa-API

Uma API Serverless em Node.js extremamente rápida, segura e moderna para o ecossistema **ESTufa**. Desenvolvida com o moderno **Modelo de Programação v4 do Azure Functions para Node.js**, integra serviços nativos da cloud da Microsoft Azure, deteção automática de plantas por Inteligência Artificial, uploads seguros de ficheiros multimédia e uma camada de cache de alta performance em Redis.

---

## 🏗️ Arquitetura e Tecnologias

A API do ESTufa foi desenhada sob uma arquitetura serverless nativa na nuvem para garantir máxima escalabilidade e eficiência:

*   **Runtime e Modelo**: Node.js (v22) utilizando o **Azure Functions v4 Programming Model** (`@azure/functions`) com indexação automática de funções.
*   **Base de Dados**: **Azure Cosmos DB (NoSQL)** configurado em modo Serverless para persistência escalável e de baixa latência dos utilizadores e das deteções botânicas.
*   **Armazenamento**: **Azure Blob Storage** para armazenar as fotos das plantas, protegido por regras de CORS e chaves temporárias SAS.
*   **Inteligência Artificial**: **Azure AI Vision (Image Analysis v4.0)** para extração automática de tags, legendas semânticas e validação de espécies botânicas.
*   **Cache de Alto Rendimento**: **Azure Container Instance (Redis)** para cache de leitura super rápida nos endpoints de feed comunitário e galerias.
*   **Infraestrutura como Código**: Totalmente orquestrado com **Terraform** na pasta `/terraform` do repositório principal para implementações reproduzíveis e automatizadas.

---

## ⚡ Funcionalidades Principais

1.  **Processamento Serverless via gRPC**: Construído com o modelo moderno v4, otimizando o ciclo de vida do worker de Node.js.
2.  **Camada de Cache Redis Robusta**: Módulo de cache completamente lazy-loaded e desacoplado (`src/utils/cache.js`). A ligação ao Redis só é iniciada quando a primeira operação é solicitada para evitar bloqueios ou timeouts de gRPC no arranque das Azure Functions. Caso o Redis fique offline, o sistema efetua o fallback automático e transparente para o Cosmos DB.
3.  **Invalidação Ativa de Cache**: Ao registar com sucesso uma nova planta identificada por IA, os caches globais do feed comunitário (`plants:feed`) e da galeria pessoal do utilizador (`plants:gallery:<username>`) são imediatamente invalidados.
4.  **Uploads Seguros Diretos (SAS)**: Os clientes web obtêm chaves temporárias SAS com permissões restritas para carregar imagens diretamente para o Blob Storage, reduzindo a carga de rede na API.
5.  **Autenticação Segura**: Registo e login de utilizadores protegidos com cifragem de passwords via `bcryptjs`.

---

## 🛠️ Instalação e Desenvolvimento Local

### Pré-requisitos
*   [Node.js v22+](https://nodejs.org/)
*   [Azure Functions Core Tools v4](https://github.com/Azure/azure-functions-core-tools)
*   Uma subscrição ativa da Azure (ou emuladores locais como o Azurite e Cosmos DB Emulator)

### Passos de Configuração
1.  **Clonar o repositório**:
    ```bash
    git clone https://github.com/tomassantos21/ESTufa-API.git
    cd ESTufa-API
    ```

2.  **Instalar as dependências**:
    ```bash
    npm install
    ```

3.  **Configurar variáveis de ambiente**:
    Crie um ficheiro `local.settings.json` na raiz do projeto:
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "AzureWebJobsStorage": "UseDevelopmentStorage=true",
        "COSMOS_DB_CONNECTION": "<SUA_CONNECTION_STRING_COSMOS_DB>",
        "BLOB_CONNECTION_STRING": "<SUA_CONNECTION_STRING_STORAGE_ACCOUNT>",
        "AI_SERVICE_KEY": "<SUA_CHAVE_AZURE_AI_VISION>",
        "AI_SERVICE_ENDPOINT": "<SEU_ENDPOINT_AZURE_AI_VISION>",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
    ```
    > [!NOTE]
    > Se a variável `REDIS_URL` for omitida ou estiver incorreta, a API desativa silenciosamente o cache e continua a responder a todas as solicitações acedendo diretamente ao Cosmos DB, sem interrupções.

4.  **Iniciar o servidor local**:
    ```bash
    npm start
    ```
    O terminal exibirá os endereços das funções locais (geralmente sob `http://localhost:7071/api/`).

---

## ⚙️ Variáveis de Ambiente em Produção

| Nome da Variável | Obrigatório | Descrição |
| :--- | :---: | :--- |
| `COSMOS_DB_CONNECTION` | **Sim** | Connection string da conta do Azure Cosmos DB. |
| `BLOB_CONNECTION_STRING` | **Sim** | Connection string do Azure Storage Account (contentor: `fotos-plantas`). |
| `AI_SERVICE_KEY` | **Sim** | Chave de acesso do recurso do Azure Computer Vision. |
| `AI_SERVICE_ENDPOINT` | **Sim** | URL de Endpoint do recurso do Azure Computer Vision. |
| `REDIS_URL` | *Não* | URL de ligação ao Redis (ex: `redis://<host>:<port>`). |

---

## 📡 Referência da API

### 1. Endpoints de Autenticação

#### `POST /api/registerUser`
Regista um novo utilizador cifrando a password com o bcrypt.

*   **Corpo do Pedido (Request)**:
    ```json
    {
      "username": "jane_doe",
      "password": "securepassword123",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "bio": "Entusiasta de botânica"
    }
    ```
*   **Resposta de Sucesso (`200 OK`)**:
    ```json
    {
      "id": "jane_doe",
      "username": "jane_doe",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "bio": "Entusiasta de botânica",
      "createdAt": "2026-05-22T19:00:00.000Z"
    }
    ```
*   **Respostas de Erro**:
    *   `400 Bad Request`: Se o username ou password não forem fornecidos.
    *   `409 Conflict`: Se o username já estiver registado na base de dados.

#### `POST /api/loginUser`
Autentica o utilizador e devolve o seu perfil.

*   **Corpo do Pedido (Request)**:
    ```json
    {
      "username": "jane_doe",
      "password": "securepassword123"
    }
    ```
*   **Resposta de Sucesso (`200 OK`)**: Devolve os dados do perfil (excluindo a hash da password).
*   **Resposta de Erro (`401 Unauthorized`)**: Credenciais inválidas ou utilizador não encontrado.

#### `POST /api/updateUser`
Atualiza os campos de perfil do utilizador (fullName, email, bio).

---

### 2. Endpoints de Multimédia e Deteção por IA

#### `GET /api/getUploadToken`
Gera um token SAS (Shared Access Signature) temporário para permitir o upload direto e seguro de fotos para o Blob Storage a partir do cliente.

*   **Parâmetros de Consulta (Query)**:
    *   `fileName` (Opcional): Nome desejado do ficheiro. Por defeito é `upload-<timestamp>.jpg`.
*   **Resposta de Sucesso (`200 OK`)**:
    ```json
    {
      "sasUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg?sv=...",
      "blobUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg"
    }
    ```

#### `POST /api/detectPlant`
Submete o URL de uma imagem carregada para análise botânica por IA, guarda os metadados no Cosmos DB e invalida automaticamente os caches afetados.

*   **Corpo do Pedido (Request)**:
    ```json
    {
      "imageUrl": "https://saestufa.blob.core.windows.net/fotos-plantas/upload-12345.jpg",
      "userId": "jane_doe",
      "username": "Jane Doe"
    }
    ```
*   **Resposta de Sucesso (`200 OK`)**:
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

### 3. Endpoints de Leitura (Com Cache)

#### `GET /api/getFeed`
Obtém o feed comunitário de plantas registadas por ordem cronológica. É mantido em cache Redis por **5 minutos** (`plants:feed`) e possui fallback robusto para o Cosmos DB.

*   **Resposta de Sucesso (`200 OK`)**: Devolve a lista de deteções de toda a comunidade.

#### `GET /api/getGallery`
Obtém o histórico de plantas registadas por um utilizador específico. É mantido em cache Redis por **5 minutos** (`plants:gallery:<username>`).

*   **Parâmetros de Consulta (Query)**:
    *   `username` (Obrigatório): Nome de utilizador.

---

## 🚀 Publicação na Nuvem (Cloud Deployment)

O ecossistema em produção corre sob um plano **Azure Windows Consumption** utilizando o método **Run-From-Package** para garantir atualizações atómicas, rápidas e sem falhas de carregamento.

### Provisionamento (Terraform)
Navegue até à pasta do Terraform no repositório principal e execute:
```bash
terraform init
terraform plan
terraform apply -auto-approve
```

### Publicar Código da API
Para empacotar e enviar o código da API para a Azure utilizando as Core Tools, execute na raiz do projeto:
```bash
func azure functionapp publish <NOME_DA_SUA_FUNCTION_APP> --javascript
```
Este comando empacota localmente a pasta do projeto (incluindo as dependências resolvidas em `node_modules`) e faz o upload do ficheiro zip.

### Configuração Recomenda (Run From Package)
Para garantir que as Azure Functions lêem os ficheiros diretamente a partir do ficheiro zip montado em modo leitura, a definição da Function App está fixada em:
```hcl
"WEBSITE_RUN_FROM_PACKAGE" = "1"
```
Isto assegura arranques rápidos e previne conflitos de sincronização.

---

## 👥 Autores
Trabalho académico realizado por:
*   **Catarina Antunes** (nº 20170667)
*   **Martim Martins** (nº 20230327)
*   **Tomás Santos** (nº 20220896)

---

## 📄 Licença
Este projeto encontra-se sob a licença MIT. Para mais informações, consulte o ficheiro [LICENSE](LICENSE).
