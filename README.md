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

## ☁️ Como Implementar e Executar na Nuvem (Microsoft Azure)

Esta plataforma foi desenhada especificamente para ser executada e orquestrada de forma nativa e automática na cloud da Microsoft Azure. Siga os passos abaixo para efetuar o provisionamento de recursos e a publicação do código.

### Pré-requisitos
*   Uma conta ativa na **Microsoft Azure** com uma subscrição válida.
*   [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) instalada e autenticada (`az login`).
*   [Azure Functions Core Tools v4](https://github.com/Azure/azure-functions-core-tools) instalada no seu sistema para publicação do código.
*   [Terraform](https://developer.hashicorp.com/terraform/downloads) instalado para provisionar a infraestrutura de rede e serviços automáticos.

---

### Passo 1: Provisionar a Infraestrutura Cloud (Terraform)
Todas as configurações de infraestrutura encontram-se declaradas na pasta `/terraform` do repositório principal do frontend. O Terraform encarrega-se de criar a base de dados, contas de armazenamento, inteligência artificial e os planos de aplicação necessários.

1.  Abra a consola na pasta `/terraform` do projeto principal.
2.  Inicialize o Terraform para descarregar os conectores da Azure:
    ```bash
    terraform init
    ```
3.  Valide o plano de recursos declarados:
    ```bash
    terraform plan
    ```
4.  Aplique a configuração e provisione os recursos na Azure:
    ```bash
    terraform apply -auto-approve
    ```
    *Isto irá gerar um grupo de recursos na Azure com a base de dados Cosmos DB, Blob Storage, a instância de contentor Docker Redis (ACI), o plano App Service e a respetiva Function App do backend.*

---

### Passo 2: Configuração e Variáveis de Ambiente na Cloud
O Terraform configura de forma automática as seguintes variáveis de ambiente diretamente nas **Configurações da Function App** (`app_settings`):

| Variável | Obrigatória | Descrição |
| :--- | :---: | :--- |
| `COSMOS_DB_CONNECTION` | **Sim** | Ligação segura ao Cosmos DB gerada dinamicamente. |
| `BLOB_CONNECTION_STRING` | **Sim** | Ligação de acesso seguro ao Azure Storage Account para as fotos das plantas. |
| `AI_SERVICE_KEY` | **Sim** | Chave privada para invocar o serviço de IA do Azure Computer Vision. |
| `AI_SERVICE_ENDPOINT` | **Sim** | Endpoint regional do serviço de Deteção e Análise de IA do Azure. |
| `REDIS_URL` | **Sim** | FQDN público da instância Redis Contentorizada: `redis://${fqdn}:6379`. |
| `WEBSITE_RUN_FROM_PACKAGE` | **Sim** | Configurada em **`1`** para ativar a execução a partir do pacote zip de forma segura. |

---

### Passo 3: Publicação e Execução do Código na Azure
Para enviar o código da API local para as funções da nuvem, garantindo a indexação automática de dependências e execução isolada:

1.  Certifique-se de que se encontra na raiz da pasta `ESTufa-API`.
2.  Instale localmente as dependências de produção para que sejam empacotadas:
    ```bash
    npm install
    ```
3.  Autentique-se na Azure CLI, se ainda não o fez:
    ```bash
    az login
    ```
4.  Efetue a publicação do código diretamente para a Function App na Azure utilizando as Core Tools (substitua `<NOME_DA_FUNCTION_APP>` pelo nome gerado no portal Azure, ex: `estufa-backend-jge55d`):
    ```bash
    func azure functionapp publish <NOME_DA_FUNCTION_APP> --javascript
    ```
    *Este comando empacota a pasta do projeto (incluindo as dependências resolvidas em `node_modules`), faz o upload do ficheiro zip e sincroniza as funções automaticamente na Azure. Uma vez concluído, as funções são indexadas com sucesso e ficam ativas e prontas a receber tráfego.*

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

#### `POST /api/loginUser`
Autentica o utilizador e devolve o seu perfil.

---

### 2. Endpoints de Multimédia e Deteção por IA

#### `GET /api/getUploadToken`
Gera um token SAS temporário para permitir o upload direto e seguro de fotos para o Blob Storage a partir do cliente.

#### `POST /api/detectPlant`
Submete o URL de uma imagem carregada para análise botânica por IA, guarda os metadados no Cosmos DB e invalida automaticamente os caches afetados.

---

### 3. Endpoints de Leitura (Com Cache)

#### `GET /api/getFeed`
Obtém o feed comunitário de plantas registadas por ordem cronológica. É mantido em cache Redis por **5 minutos** (`plants:feed`) e possui fallback robusto para o Cosmos DB.

#### `GET /api/getGallery`
Obtém o histórico de plantas registadas por um utilizador específico. É mantido em cache Redis por **5 minutos** (`plants:gallery:<username>`).

---

## 👥 Autores
Trabalho académico realizado por:
*   **Catarina Antunes** (nº 20170667)
*   **Martim Martins** (nº 20230327)
*   **Tomás Santos** (nº 20220896)

---

## 📄 Licença
Este projeto encontra-se sob a licença MIT. Para mais informações, consulte o ficheiro [LICENSE](LICENSE).
