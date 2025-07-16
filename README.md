# QA ChatCanvas Backend API

Backend API for the QA ChatCanvas Interactive System - AI-powered QA documentation generation and refinement.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

3. Run development server:
```bash
npm run dev
```

4. Run tests:
```bash
npm test
```

## API Endpoints

- `POST /api/analyze-ticket` - Initial ticket analysis and QA document generation
- `POST /api/update-canvas` - Conversational refinement of QA documentation  
- `POST /api/generate-suggestions` - Generate contextual QA improvement suggestions

## Deployment

This project is configured for deployment on Ubuntu 22 with PM2:

```bash
npm run build
pm2 start ecosystem.config.js
```

---

# **Plan de Diseño Técnico e Implementación: "QA Chat & Canvas" con Vercel AI SDK v5**

## **Parte 1: Análisis Estratégico del Flujo de Trabajo "Chat & Canvas"**

Esta sección inicial establece la visión estratégica, deconstruye la propuesta de flujo de usuario y presenta un modelo refinado que está optimizado para las capacidades de la Vercel AI SDK v5. El objetivo es sentar una base conceptual sólida antes de abordar los detalles de la implementación técnica, asegurando que la arquitectura elegida no solo cumpla con los requisitos actuales, sino que también sea escalable y robusta para futuras innovaciones.

### **1.1. Deconstrucción del Flujo de Trabajo Propuesto por el Usuario**

El flujo de trabajo propuesto representa una evolución significativa para la extensión "QA Test Recorder", transformándola de una herramienta de captura pasiva a un asistente de QA interactivo y colaborativo. El análisis de este flujo revela varios componentes y acciones clave que deben ser soportados por la nueva arquitectura.

El viaje del usuario comienza al navegar a un ticket de Jira. En este punto, un content script detecta el contexto y carga dinámicamente el widget ChatCanvas en la interfaz. Este es el punto de entrada a la nueva funcionalidad. Opcionalmente, el usuario puede configurar un "perfil de QA", seleccionando áreas de enfoque como pruebas funcionales, UI/UX, seguridad o rendimiento. Esta configuración, persistida en chrome.storage.local, actúa como una directiva inicial para la IA, personalizando su análisis.

El núcleo de la interacción se centra en un bucle de tres pasos:

1. **Análisis Inicial:** El usuario inicia el proceso, ya sea haciendo clic en un botón "Analizar Ticket Actual" o usando un comando de chat como /analyze. Esta acción desencadena la primera llamada importante al backend. El sistema propuesto sugiere que el backend comenzará a transmitir operaciones de Slate.js para poblar el editor del Canvas en tiempo real, mostrando títulos, metadatos y los criterios de aceptación y casos de prueba generados por la IA.
2. **Generación de Sugerencias:** Una vez que el análisis inicial se completa, el sistema proactivamente obtiene y muestra "SuggestionBubbles" (burbujas de sugerencia). Estas son recomendaciones concisas y contextuales, como "Añadir caso límite para token expirado" o "Verificar mensaje de error en fallo de red", diseñadas para guiar al QA hacia una cobertura de pruebas más completa.
3. **Iteración y Refinamiento:** El usuario refina el documento generado a través de dos métodos principales. Puede interactuar conversacionalmente a través del chat ("Agrega validación de email inválido") o hacer clic directamente en una de las SuggestionBubbles. Ambas acciones inician una llamada al backend para parchear el contenido del Canvas. Adicionalmente, el usuario conserva la capacidad de editar manualmente el texto en el CanvasEditor.

La persistencia del estado se maneja a través de un docHash, un hash calculado del contenido del documento, que se almacena en chrome.storage.local. Esto permite que la extensión recupere el estado anterior del documento cuando se vuelve a abrir el mismo ticket de Jira, proporcionando continuidad en el trabajo del QA.

### **1.2. Implicaciones Arquitectónicas y Análisis de Oportunidades**

La transición al flujo de "Chat & Canvas" implica un cambio arquitectónico fundamental y profundo. El sistema actual, como se describe en el README.md, opera en un "Modo Offline" y es inherentemente una aplicación del lado del cliente. Toda la lógica de raspado, almacenamiento en caché y exportación reside dentro de la extensión de Chrome.

El nuevo flujo introduce un **backend como un componente central y no opcional**. Esta migración de una arquitectura puramente de cliente a un modelo cliente-servidor tiene implicaciones significativas:

- **Complejidad de la Gestión del Estado:** El sistema pasa de tener una única fuente de verdad (chrome.storage.local) a tener al menos dos. El estado del CanvasEditor reside en el cliente, mientras que el proceso de generación y refinamiento de la IA ocurre en el servidor. Esto introduce la necesidad crítica de una estrategia robusta de sincronización y reconciliación para garantizar que el cliente y el servidor operen consistentemente sobre la misma versión del documento. El concepto de docHash es un intento inicial de abordar esto, pero una solución más sofisticada será necesaria para manejar las interacciones en tiempo real.
- **Oportunidades de la IA Avanzada:** La principal ventaja de este cambio arquitectónico es la capacidad de ejecutar operaciones de IA mucho más potentes. Los modelos de lenguaje grandes y de última generación (como GPT-4o o Claude 3.5 Sonnet) son demasiado grandes para ejecutarse en el cliente. Al trasladar esta carga de trabajo al backend, la aplicación puede aprovechar estos modelos para generar análisis de mayor calidad, mantener un contexto de conversación más largo y, potencialmente, integrarse con bases de conocimiento externas (por ejemplo, documentación interna de la empresa) para un análisis aún más rico.

La elección de la Vercel AI SDK v5 para impulsar este backend es particularmente astuta. Sus características principales se alinean directamente con los requisitos del flujo propuesto. La capacidad de generar objetos estructurados (generateObject) es ideal para el análisis inicial, mientras que las capacidades de streaming de texto conversacional (streamText) son perfectas para el bucle de refinamiento iterativo.<sup>1</sup> La adopción del SDK del estándar Server-Sent Events (SSE) para el streaming simplifica enormemente la implementación del requisito de que el

Canvas se "poble en vivo".<sup>3</sup>

### **1.3. Modelo de Flujo de Trabajo Refinado: Incorporando Mejoras de AI SDK v5**

Tras un análisis detallado del flujo propuesto y las capacidades de la Vercel AI SDK v5, se propone un modelo de flujo de trabajo refinado. Este modelo no reemplaza la visión del usuario, sino que la mejora aplicando los patrones y primitivas más potentes del SDK para crear un sistema más robusto, eficiente y mantenible.

El flujo de trabajo refinado se estructura de la siguiente manera:

1. **Inicialización y Persistencia:** Cuando el QA abre un ticket de Jira, el frontend carga el ChatCanvas. Inmediatamente, invoca el hook useChat de React con un id único para ese ticket (p. ej., useChat({ id: 'PROJ-123',... })). Esto aprovecha el ChatStore interno del SDK, que gestiona automáticamente la persistencia y recuperación del historial de la conversación (UIMessage) en el almacenamiento local.<sup>4</sup> Este mecanismo nativo del SDK reemplaza la necesidad de un  
    docHash manual, proporcionando una solución de persistencia más robusta y lista para usar.
2. **Análisis Inicial Transaccional (/api/analyze-ticket):** Al hacer clic en "Analizar Ticket", el frontend realiza una única solicitud POST a este endpoint. En lugar de transmitir operaciones de editor complejas y frágiles, el backend utilizará la función generateObject del SDK.<sup>1</sup> Esta función está diseñada para devolver un único objeto JSON completo y validado que se ajusta a un esquema predefinido (  
    QACanvasDocument). El frontend recibe este objeto y es responsable de renderizar su contenido en el Canvas. Este enfoque tiene varias ventajas:
    - **Atomicidad:** La operación es transaccional; o se recibe el documento completo y válido, o se produce un error. Esto evita estados de documento corruptos o a medio generar.
    - **Desacoplamiento:** El backend genera datos estructurados, no instrucciones de UI. Esto desacopla completamente la lógica de la IA de la biblioteca de edición específica del frontend (Slate.js). Si en el futuro se decide cambiar Slate.js por otro editor, el backend no requerirá ninguna modificación.
3. **Refinamiento Conversacional (/api/update-canvas):** Todas las interacciones posteriores del usuario en el chat se gestionan a través del hook useChat, que envía solicitudes a este segundo endpoint. El backend utiliza aquí la función streamText.<sup>3</sup> Esta función es ideal para el diálogo, transmitiendo la respuesta de la IA token a token. Fundamentalmente, no solo transmite texto, sino  
    UIMessageStreamParts estructuradas <sup>4</sup>, lo que permite a la IA enviar partes de "razonamiento", mensajes de confirmación o incluso bloques de datos actualizados en tiempo real dentro del mismo flujo de streaming.
4. **"SuggestionBubbles" como Herramienta de IA Estructurada:** El concepto de /generate-suggestions se redefine para aprovechar una de las características más potentes de la AI SDK v5: las tool (herramientas).<sup>9</sup> En lugar de pedirle a la IA que "escriba tres sugerencias", lo que daría como resultado un texto de formato libre y poco fiable, definiremos una herramienta en el backend llamada  
    generateQASuggestion.
    - Esta herramienta tendrá un esquema de entrada (definido con Zod) que obliga a la IA a proporcionar datos estructurados, como suggestionType: 'edge_case' | 'ui_check', description: string, y targetSection: string.
    - El prompt del backend se convierte en: "Basado en el documento actual, llama a la herramienta generateQASuggestion tres veces con recomendaciones relevantes".
    - La IA ahora está _forzada_ a devolver un array de objetos JSON que se ajustan a nuestro esquema. Esto transforma las sugerencias de "burbujas de texto" poco fiables en datos estructurados, predecibles y fáciles de procesar para el frontend.

Este modelo refinado crea una separación de preocupaciones clara y lógica, alineando cada fase del flujo de trabajo con la primitiva más adecuada de la Vercel AI SDK v5, lo que resulta en un sistema más resiliente y potente.

### **1.4. Diagramas Actualizados de Arquitectura y Flujo de Datos**

Para visualizar el modelo refinado, los siguientes diagramas ilustran la nueva arquitectura y el flujo de datos.

#### **Diagrama de Arquitectura del Sistema**

Este diagrama muestra los componentes principales y sus interacciones. El Chrome Extension Frontend se comunica con un Next.js Backend API, que a su vez utiliza el Vercel AI Gateway para interactuar con los LLM Providers. La persistencia se gestiona a través de Chrome Local Storage.

Fragmento de código

graph TD  
subgraph "Navegador del Usuario"  
A\[Chrome Extension Frontend\]  
A -- 1. Raspado de datos --> B  
A -- 2. Almacenamiento local --> C  
C -- 3. Carga de estado previo --> A  
end  
<br/>subgraph "Infraestructura de Vercel"  
D  
E\[Vercel AI Gateway\]  
F\[LLM Providers (OpenAI, Anthropic, etc.)\]  
end  
<br/>A -- "4a. POST /api/analyze-ticket (Payload: Ticket JSON)" --> D  
A -- "4b. POST /api/update-canvas (Payload: UIMessage)" --> D  
<br/>D -- "5. Llamada a generateObject/streamText" --> E  
E -- "6. Enrutamiento y autenticación" --> F  
F -- "7. Respuesta del modelo" --> E  
E -- "8. Respuesta unificada" --> D  
<br/>D -- "9a. Respuesta JSON (documento completo)" --> A  
D -- "9b. Stream SSE (UIMessageStreamParts)" --> A  

#### **Diagrama de Secuencia del Bucle de Refinamiento Iterativo**

Este diagrama detalla la secuencia precisa de eventos durante una interacción de chat para refinar el documento.

Fragmento de código

sequenceDiagram  
participant C as Cliente (useChat Hook)  
participant S as Servidor (/api/update-canvas)  
participant LLM as Modelo de Lenguaje  
<br/>C->>S: POST /api/update-canvas con { messages: UIMessage }  
Note over S: 1. Recibe el historial de UIMessage.  
S->>S: 2. Llama a convertToModelMessages(messages)  
Note over S: Transforma a formato para el modelo.  
S->>LLM: 3. Llama a streamText({ messages: ModelMessage,... })  
LLM-->>S: 4. Devuelve un stream de texto/partes.  
S->>S: 5. Envuelve el stream con.toUIMessageStreamResponse()  
Note over S: Formatea la respuesta como SSE.  
S-->>C: 6. Envía stream de UIMessageStreamPart  
Note over C: 7. El hook useChat consume el stream y actualiza el estado local (messages).  
Note over C: 8. El UI se actualiza en tiempo real.  

## **Parte 2: Arquitectura del Backend e Integración del SDK Principal**

Esta sección detalla los componentes fundamentales de la arquitectura del backend, centrándose en las elecciones tecnológicas y la aplicación correcta de los principios y primitivas de la Vercel AI SDK v5. La solidez de esta capa es crucial para el rendimiento, la escalabilidad y la mantenibilidad de toda la funcionalidad de "Chat & Canvas".

### **2.1. Visión General de la Arquitectura del Sistema**

La arquitectura propuesta está diseñada para ser moderna, escalable y perfectamente alineada con el ecosistema de Vercel y las mejores prácticas para aplicaciones de IA.

- **Framework:** El backend se construirá como una aplicación **Next.js** utilizando los **Route Handlers del App Router**. Esta elección es deliberada por varias razones clave. Primero, los Route Handlers proporcionan un entorno "serverless-first" que se despliega en Vercel como funciones serverless (o en el borde), lo cual es ideal para una API que maneja ráfagas de solicitudes de manera eficiente y rentable. Segundo, la integración entre Next.js y la Vercel AI SDK es nativa y está bien documentada, lo que simplifica el desarrollo.<sup>11</sup>
- **Hosting:** El despliegue en **Vercel** es la recomendación inequívoca. Esta plataforma ofrece una integración sin fisuras con el Vercel AI Gateway, gestión automática de variables de entorno, y un pipeline de CI/CD optimizado para Next.js. El uso de Vercel elimina una cantidad significativa de sobrecarga de infraestructura, permitiendo al equipo de desarrollo centrarse en la lógica de la aplicación.
- **Componentes:** La arquitectura se compone de tres partes distintas pero interconectadas:
    1. **Chrome Extension (Frontend):** El componente existente, que será refactorizado para actuar como el cliente de la nueva API del backend. Seguirá siendo responsable del raspado de datos de Jira y de la renderización de la interfaz de usuario (ChatCanvas).
    2. **Next.js API (Backend):** El cerebro de la operación. Albergará los endpoints de la API (/api/analyze-ticket, /api/update-canvas, etc.) que encapsulan toda la lógica de interacción con la IA.
    3. **Vercel AI Gateway (Middleware):** Un componente de infraestructura crítico que actuará como un proxy inteligente y resiliente entre nuestro backend y los proveedores de LLM subyacentes.

### **2.2. Configuración del Vercel AI Gateway para Producción**

El Vercel AI Gateway no es simplemente una conveniencia, sino una pieza fundamental de la infraestructura de producción que mitiga riesgos y proporciona una flexibilidad estratégica invaluable. Su adopción desde el inicio es una decisión arquitectónica clave.

- **Justificación:**
  - **Fiabilidad y Resiliencia:** El Gateway puede configurarse para reintentar automáticamente las solicitudes fallidas y, en el futuro, para conmutar por error a proveedores alternativos si el principal sufre una interrupción. Esto aumenta drásticamente la disponibilidad de la aplicación.<sup>12</sup>
  - **Observabilidad y Control de Costos:** Proporciona un panel centralizado para monitorizar el uso de tokens y el gasto en todos los proveedores, una característica esencial para gestionar los costos operativos de la IA.<sup>12</sup>
  - **Flexibilidad y Abstracción:** Esta es su ventaja más estratégica. El Gateway permite cambiar el modelo de lenguaje subyacente (por ejemplo, de gpt-4o a claude-3.5-sonnet) con un cambio de una sola línea de código en el backend, sin necesidad de alterar la lógica de la aplicación ni gestionar diferentes SDKs de proveedores.<sup>12</sup> Esto permite al equipo aprovechar rápidamente nuevos modelos más baratos o de mayor rendimiento a medida que se lanzan.
- **Implementación:**
    1. Se instalará el paquete @ai-sdk/gateway en el proyecto de Next.js.<sup>12</sup>
    2. Se configurará el Gateway en el panel de Vercel, utilizando la función "Bring Your Own Key" (BYOK) para añadir de forma segura las claves de API de los proveedores deseados (por ejemplo, OPENAI_API_KEY, ANTHROPIC_API_KEY) como variables de entorno del proyecto Vercel.<sup>12</sup>
    3. En el código del backend, las llamadas a los modelos se realizarán utilizando simples identificadores de cadena, como openai('gpt-4o') o anthropic('claude-3-5-sonnet'). La AI SDK detectará automáticamente que se está utilizando un identificador de este tipo y enrutará la solicitud a través del Vercel AI Gateway por defecto.<sup>12</sup> Las credenciales se gestionarán de forma segura a través de las variables de entorno de Vercel.

### **2.3. Dominando las Primitivas Centrales de Vercel AI SDK v5**

Para implementar correctamente el backend, es imperativo comprender los conceptos fundamentales que introdujo la versión 5 de la AI SDK. Estos conceptos forman la base de todo el flujo de datos.

- **La Dicotomía UIMessage vs. ModelMessage:** Este es el cambio conceptual más importante y crítico en la AI SDK v5. La SDK reconoce que el formato de mensaje ideal para una interfaz de usuario no es el mismo que el formato ideal para un modelo de lenguaje, por lo que introduce dos tipos distintos.<sup>3</sup>
  - **UIMessage:** Es la representación canónica y rica de un mensaje en el lado del cliente. Contiene un id estable, un rol, metadatos tipados (metadata) y, lo más importante, un array parts que puede contener texto, imágenes, llamadas a herramientas y datos personalizados. El estado del chat en nuestro frontend (useChat) **siempre** será un array de UIMessage.
  - **ModelMessage:** Es una versión simplificada y optimizada del mensaje, diseñada para ser enviada al LLM. Se eliminan los metadatos y otros datos específicos de la UI, y el contenido se estructura de la manera que el modelo espera. Antes de cualquier llamada a la IA, el array UIMessage **debe** ser convertido a ModelMessage.
- **El Array parts:** La propiedad content: string de versiones anteriores ha sido eliminada. Todo el contenido de un mensaje ahora reside en parts: UIMessagePart.<sup>4</sup> Esta estructura es lo que permite interacciones multimodales y ricas. En nuestro proyecto, utilizaremos principalmente  
    type: 'text' para el contenido de texto y exploraremos el uso de type: 'data' para transmitir información estructurada, como las sugerencias generadas, de vuelta al cliente de una manera ordenada y tipada.<sup>3</sup>
- **Metadatos Tipados (metadata):** La propiedad metadata en UIMessage es un campo genérico y tipado diseñado para almacenar información estructurada específica de la aplicación que no debe ser enviada al LLM.<sup>3</sup> Este es un mecanismo poderoso para enriquecer el estado del cliente. Por ejemplo, podríamos usarlo para registrar qué "perfil de QA" se utilizó para generar un mensaje, el tiempo de respuesta del modelo o si un mensaje se originó a partir de un clic en una  
    SuggestionBubble en lugar de ser escrito por el usuario. Estos metadatos se conservan en el cliente pero se eliminan durante la conversión a ModelMessage, manteniendo limpio el contexto del modelo.

### **2.4. El Pipeline de Transformación de Datos**

El flujo de datos de extremo a extremo en una aplicación AI SDK v5 sigue un pipeline de transformación estricto y bien definido. Comprender y respetar este pipeline es esencial para una implementación correcta.

1. **Del Cliente al Servidor:** El hook useChat en el frontend gestiona el estado de la conversación como UIMessage. Cuando el usuario envía un mensaje, el hook empaqueta este array completo y lo envía en el cuerpo de una solicitud POST a nuestro endpoint del backend (p. ej., /api/update-canvas).
2. **Procesamiento en el Servidor:**
    - El Route Handler de Next.js recibe el array UIMessage.
    - **Paso Crítico 1:** Antes de pasar los mensajes al modelo, se debe invocar la función de utilidad convertToModelMessages(messages). Esta función realiza la transformación necesaria de UIMessage a ModelMessage, preparando los datos para el LLM.<sup>3</sup>
    - La función principal del SDK (p. ej., streamText) se llama con los ModelMessage resultantes.
    - El resultado de streamText es un objeto específico del SDK que contiene el stream de respuesta del modelo.
    - **Paso Crítico 2:** Para enviar esta respuesta de vuelta al cliente de una manera que useChat pueda entender, se debe llamar al método .toUIMessageStreamResponse() en el objeto de resultado. Esto formatea la respuesta como un stream Server-Sent Events (SSE) que contiene UIMessageStreamParts.<sup>3</sup>
3. **Del Servidor al Cliente:** El frontend recibe este stream SSE. El hook useChat está diseñado para consumir este formato específico, procesando cada UIMessageStreamPart a medida que llega para actualizar el estado local de messages y renderizar la respuesta de la IA en tiempo real en la pantalla.

No seguir este pipeline, por ejemplo, intentando enviar UIMessage directamente al modelo o enviando un stream de texto plano de vuelta al cliente, romperá la funcionalidad del SDK y la gestión del estado del lado del cliente.

## **Parte 3: Especificación de Endpoints de API y Guía de Implementación**

Esta sección proporciona un plano detallado y práctico para construir cada uno de los endpoints de la API del backend. Para cada endpoint, se define su función, la primitiva del Vercel AI SDK más adecuada, los esquemas de datos de entrada y salida, y los pasos de implementación clave dentro de un Route Handler de Next.js.

### **3.1. Endpoint 1: POST /api/analyze-ticket (Análisis Inicial)**

Este endpoint es el punto de partida del flujo de trabajo de IA. Su propósito es realizar un análisis exhaustivo y único del contenido de un ticket de Jira y generar una estructura de documento QA completa y bien formada.

- **Función:** Transaccional y no-streaming. Recibe los datos del ticket y un perfil de QA, y devuelve un único objeto JSON que representa el documento de QA inicial.
- **Función Principal del SDK:** generateObject. Esta es la elección ideal porque el objetivo es un resultado estructurado, predecible y validado contra un esquema estricto, no una conversación fluida.<sup>1</sup>  
    generateObject garantiza que la respuesta sea un objeto JSON completo y sintácticamente correcto que se ajuste a nuestro QACanvasDocumentSchema, o falla de manera predecible.
- **Esquema del Cuerpo de la Solicitud (TicketAnalysisPayload):** El cliente debe enviar un cuerpo JSON que se ajuste a este esquema Zod.  
    TypeScript  
    // En: src/lib/schemas/TicketAnalysisPayload.ts  
    import { z } from 'zod';  
    import { qaProfileSchema } from './QAProfile';  
    import { jiraTicketSchema } from './JiraTicket';  
    <br/>export const ticketAnalysisPayloadSchema = z.object({  
    // El perfil de QA seleccionado por el usuario para guiar el análisis.  
    qaProfile: qaProfileSchema,  
    // El objeto JSON completo que contiene los datos raspados del ticket de Jira.  
    ticketJson: jiraTicketSchema,  
    });  
    <br/>export type TicketAnalysisPayload = z.infer&lt;typeof ticketAnalysisPayloadSchema&gt;;  

- **Esquema del Cuerpo de la Respuesta:** La respuesta será un objeto JSON que se ajusta al qaCanvasDocumentSchema, que se define en detalle en la Parte 4.
- **Pasos de Implementación (Route Handler en app/api/analyze-ticket/route.ts):**
    1. **Importar Dependencias:** Importar generateObject, el cliente del modelo (p. ej., openai), el ticketAnalysisPayloadSchema para la validación y el qaCanvasDocumentSchema para la generación.
    2. **Validar la Entrada:** Leer el cuerpo de la solicitud (await req.json()) y validarlo usando ticketAnalysisPayloadSchema.safeParse(). Si la validación falla, devolver una respuesta de error 400.
    3. **Construir el Prompt:** Crear un prompt detallado y bien estructurado que combine la información del ticketJson y las directivas del qaProfile. El prompt debe instruir explícitamente a la IA para que genere un objeto que se ajuste a la estructura descrita por qaCanvasDocumentSchema. Incluir descripciones de los campos del esquema en el prompt puede mejorar significativamente la calidad de la salida.
    4. **Llamar a generateObject:**  
        TypeScript  
        import { generateObject } from 'ai';  
        import { openai } from '@ai-sdk/openai';  
        import { qaCanvasDocumentSchema } from '@/lib/schemas/QACanvasDocument';  
        <br/>//... dentro de la función POST...  
        const { object: generatedDocument } = await generateObject({  
        model: openai('gpt-4o'),  
        schema: qaCanvasDocumentSchema,  
        prompt: \`Analyze the following Jira ticket...\`,  
        system: 'You are a world-class QA analyst tasked with creating a comprehensive test plan.'  
        });  

    5. **Devolver la Respuesta:** Si la llamada tiene éxito, devolver el generatedDocument en una Response con un estado 200.
    6. **Manejar Errores:** Envolver la llamada a generateObject en un bloque try...catch para manejar errores específicos como AI_NoObjectGeneratedError <sup>1</sup> o fallos de red, devolviendo respuestas de error 500 apropiadas.

### **3.2. Endpoint 2: POST /api/update-canvas (Refinamiento Conversacional)**

Este endpoint es el motor del componente de chat interactivo. Gestiona el diálogo continuo entre el usuario y la IA para refinar el documento de QA.

- **Función:** Conversacional y streaming. Recibe el historial de chat completo y transmite la respuesta de la IA token a token.
- **Función Principal del SDK:** streamText. Esta función está diseñada específicamente para interacciones de chat de ida y vuelta y es la base del hook useChat.<sup>3</sup>
- **Esquema del Cuerpo de la Solicitud:** El cuerpo de la solicitud es el payload estándar enviado por useChat, que contiene el historial de mensajes.  
    TypeScript  
    // Definición implícita por el payload de useChat  
    // { messages: UIMessage }  

- **Respuesta:** Un ReadableStream con formato SSE, generado por el método result.toUIMessageStreamResponse().
- **Pasos de Implementación (Route Handler en app/api/update-canvas/route.ts):**
    1. **Importar Dependencias:** Importar streamText, convertToModelMessages, y el cliente del modelo.
    2. **Extraer Mensajes:** Leer el cuerpo de la solicitud para obtener el array messages: UIMessage.
    3. **Proporcionar Contexto Completo:** Este es un paso crítico y un desafío de diseño. Para que la IA pueda editar el documento de manera coherente (p. ej., "cambia el segundo criterio"), debe conocer el estado actual completo del documento. La estrategia más efectiva es serializar el objeto QACanvasDocument actual (que el cliente debe enviar como parte de la solicitud, quizás en el metadata del último mensaje) y pasarlo como parte del system prompt.  
        TypeScript  
        // Ejemplo de cómo construir el system prompt  
        const systemPrompt = \`You are a helpful QA assistant. You are currently editing the following QA document:  
        ${JSON.stringify(currentCanvasDocument)}  
        <br/>Please respond to the user's latest request to modify this document.\`;  

    4. **Convertir Mensajes:** Preparar los mensajes para el modelo usando const modelMessages = convertToModelMessages(messages).<sup>3</sup>
    5. **Llamar a streamText:**  
        TypeScript  
        import { streamText, convertToModelMessages } from 'ai';  
        import { openai } from '@ai-sdk/openai';  
        <br/>//... dentro de la función POST...  
        const result = await streamText({  
        model: openai('gpt-4o'),  
        system: systemPrompt, // El prompt con el contexto del documento  
        messages: modelMessages  
        });  

    6. **Devolver el Stream:** Devolver la respuesta formateada para que useChat la consuma: return result.toUIMessageStreamResponse();.

### **3.3. Endpoint 3: POST /api/generate-suggestions (Sugerencias Estructuradas)**

Este endpoint se especializa en generar sugerencias de alta calidad y estructuradas para que el usuario las considere, actuando como un "empujón" proactivo para mejorar la cobertura de las pruebas.

- **Función:** Generación de datos estructurados. Recibe el contexto del documento actual y devuelve un array de objetos de sugerencia.
- **Función Principal del SDK:** generateText o streamText combinado con el parámetro tools. El uso de herramientas es la clave para forzar a la IA a devolver una salida estructurada y predecible en lugar de texto de formato libre.<sup>9</sup>
- **Definición de la Herramienta (QASuggestionTool):** Se debe definir una herramienta en el backend que describa la estructura de una sugerencia.  
    TypeScript  
    import { z } from 'zod';  
    import { tool } from 'ai';  
    <br/>// Esquema Zod para los parámetros de la herramienta  
    const qaSuggestionParametersSchema = z.object({  
    suggestionType: z.enum(\['edge_case', 'ui_verification', 'functional_test', 'clarification_question'\])  
    .describe('The category of the QA suggestion.'),  
    description: z.string()  
    .describe('The detailed text of the suggestion for the user.'),  
    targetSection: z.string().optional()  
    .describe('The specific section of the document this suggestion applies to, e.g., "Acceptance Criteria".')  
    });  
    <br/>// Definición de la herramienta usando el helper \`tool\`  
    export const qaSuggestionTool = tool({  
    description: 'Propose a single, actionable QA suggestion to improve the test plan.',  
    parameters: qaSuggestionParametersSchema,  
    // No se necesita una función \`execute\` si solo queremos que la IA genere los argumentos.  
    });  

- **Pasos de Implementación (Route Handler en app/api/generate-suggestions/route.ts):**
    1. **Importar Dependencias:** Importar generateText, la qaSuggestionTool y el cliente del modelo.
    2. **Recibir Contexto:** El cuerpo de la solicitud debe contener el QACanvasDocument actual para proporcionar contexto.
    3. **Construir el Prompt:** Crear un prompt que instruya explícitamente a la IA a usar la herramienta.  
        TypeScript  
        const prompt = \`Based on the following QA document, generate 3 diverse and high-quality suggestions by calling the 'proposeSuggestion' tool for each one.  
        <br/>Document:  
        ${JSON.stringify(currentCanvasDocument)}\`;  

    4. **Llamar a generateText con Herramientas:**  
        TypeScript  
        const { toolCalls } = await generateText({  
        model: openai('gpt-4o'),  
        prompt: prompt,  
        tools: { proposeSuggestion: qaSuggestionTool },  
        // Forzar al modelo a usar la herramienta  
        toolChoice: 'required'  
        });  

    5. **Procesar y Devolver Resultados:** Extraer los argumentos de cada llamada a la herramienta del array toolCalls. Estos argumentos serán los objetos de sugerencia estructurados. Devolver este array de objetos como una respuesta JSON.

## **Parte 4: Modelos de Datos Definitivos y Gestión del Estado**

Esta sección es fundamental para el éxito del proyecto, ya que aborda directamente la necesidad expresada por el usuario de tener "JSON y modelos definidos". Proporciona una fuente única de verdad para todas las estructuras de datos, utilizando Zod para la definición y validación de esquemas. Esto garantiza la integridad de los datos, la seguridad de tipos de extremo a extremo y una comunicación sin ambigüedades entre el frontend y el backend.

### **4.1. Estrategia de Gestión del Estado del Cliente**

La introducción de un backend requiere una estrategia de gestión del estado del cliente más sofisticada que la actual.

- **Estado de la Conversación (UIMessage):** El estado principal de la conversación será gestionado por el hook useChat de @ai-sdk/react.<sup>7</sup> Al inicializarlo con un ID único por ticket (p. ej.,  
    useChat({ id: \\jira-${issueKey}\` })), se aprovecha su mecanismo de persistencia incorporado, que utiliza localStorage(osessionStorage) para guardar y recuperar automáticamente el historial de UIMessage\`. Esto elimina la necesidad de gestionar manualmente la persistencia del chat.
- **Estado del Documento (QACanvasDocument):** El objeto del documento de QA en sí, que es la estructura de datos que se renderiza en el CanvasEditor, debe gestionarse por separado. Se mantendrá en un estado de React, idealmente utilizando useState para la simplicidad o una biblioteca de gestión de estado como Zustand o Redux Toolkit para aplicaciones más complejas.
  - **Inicialización:** El estado const = useState&lt;QACanvasDocument | null&gt;(null); se inicializa como null. Tras la primera llamada exitosa a /api/analyze-ticket, la respuesta se utiliza para establecer este estado: setDocument(responseJson).
  - **Actualización:** La actualización de este documento durante la conversación es el mayor desafío. El frontend no puede simplemente reemplazar el documento con cada respuesta del chat. En su lugar, debe "parchear" el estado local. La estrategia recomendada es que el backend, después de una respuesta de la IA, envíe una parte de datos (UIMessageStreamPart de tipo data) con el documento actualizado completo. El frontend escucharía esta parte de datos específica y la usaría para llamar a setDocument() con la nueva versión. Esto asegura la sincronización.
- **Persistencia entre Sesiones:** Aunque useChat maneja el historial de chat, el objeto QACanvasDocument también debe persistirse. Al cerrar o recargar la página, el estado de React se pierde. Por lo tanto, cada vez que el estado del document se actualice, se debe guardar una copia serializada en chrome.storage.local, asociada a la clave del ticket de Jira. Al cargar la extensión, se intentará leer este objeto desde el almacenamiento para restaurar el estado del Canvas inmediatamente.

### **4.2. Tabla: Modelos de Datos Centrales (Esquemas Zod)**

Esta tabla es el corazón de esta sección y el artefacto más crítico para el equipo de desarrollo. Proporciona definiciones de esquema Zod ejecutables, que sirven como contratos de datos rigurosos. El uso de Zod <sup>1</sup> permite la validación automática en el backend y la inferencia de tipos de TypeScript en todo el proyecto, eliminando una clase entera de errores de datos. El uso extensivo de

.describe() en los esquemas no solo documenta el código, sino que también proporciona información valiosa al LLM cuando se le pide que genere un objeto que se ajuste al esquema, mejorando la calidad de la salida.<sup>14</sup>

| Nombre del Modelo | Definición del Esquema Zod y Descripción |
| --- | --- |
| **QAProfile** | typescript\\nimport { z } from 'zod';\\n\\n// Define las categorías de enfoque para el análisis de QA.\\nexport const qaProfileSchema = z.object({\\n // Un array de áreas en las que la IA debe centrarse.\\n focusOn: z.array(z.enum(\['functional', 'ui_ux', 'security', 'performance'\]))\\n .describe('Array of QA categories to focus the analysis on.'),\\n // El idioma de salida para los artefactos generados.\\n language: z.enum(\['en', 'es'\])\\n .describe('The output language for the generated artifacts.'),\\n}).describe('User-defined QA profile to guide the AI analysis.');\\n\\nexport type QAProfile = z.infer&lt;typeof qaProfileSchema&gt;;\\n |
| --- | --- |
| **JiraTicket** | typescript\\nimport { z } from 'zod';\\n\\n// Define la estructura de los datos raspados de un ticket de Jira.\\n// Esta es una representación simplificada; debe expandirse para que coincida con los datos reales.\\nexport const jiraTicketSchema = z.object({\\n key: z.string().describe('The unique identifier for the Jira ticket, e.g., PROJ-123.'),\\n summary: z.string().describe('The title or summary of the ticket.'),\\n description: z.string().optional().describe('The main description body of the ticket.'),\\n status: z.string().describe('The current status of the ticket, e.g., "In Progress".'),\\n assignee: z.string().optional().describe('The person assigned to the ticket.'),\\n comments: z.array(z.object({\\n author: z.string(),\\n body: z.string(),\\n created: z.string().datetime(),\\n })).optional().describe('A list of comments on the ticket.'),\\n attachments: z.array(z.object({\\n filename: z.string(),\\n mimeType: z.string(),\\n })).optional().describe('A list of attachments on the ticket.'),\\n}).describe('Schema for the data scraped from a Jira ticket page.');\\n\\nexport type JiraTicket = z.infer&lt;typeof jiraTicketSchema&gt;;\\n |
| --- | --- |
| **AcceptanceCriterion** | typescript\\nimport { z } from 'zod';\\n\\n// Define un único criterio de aceptación.\\nexport const acceptanceCriterionSchema = z.object({\\n id: z.string().uuid().describe('Unique identifier for the criterion.'),\\n text: z.string().describe('The descriptive text of the acceptance criterion.'),\\n type: z.enum(\['functional', 'ui_ux', 'performance', 'security'\])\\n .describe('The category of the acceptance criterion.'),\\n}).describe('A single acceptance criterion derived from the ticket requirements.');\\n\\nexport type AcceptanceCriterion = z.infer&lt;typeof acceptanceCriterionSchema&gt;;\\n |
| --- | --- |
| **TestCase** | typescript\\nimport { z } from 'zod';\\n\\n// Define un único caso de prueba, posiblemente en formato Gherkin.\\nexport const testCaseSchema = z.object({\\n id: z.string().uuid().describe('Unique identifier for the test case.'),\\n scenario: z.string().describe('The title or scenario description for the test case.'),\\n steps: z.array(z.string()).describe('An ordered list of steps to execute the test, e.g., in Gherkin format (Given, When, Then).'),\\n type: z.enum(\['happy_path', 'edge_case', 'negative_test'\])\\n .describe('The type of test case.'),\\n}).describe('A single test case with steps to verify a piece of functionality.');\\n\\nexport type TestCase = z.infer&lt;typeof testCaseSchema&gt;;\\n |
| --- | --- |
| **QAWarning** | typescript\\nimport { z } from 'zod';\\n\\n// Define una advertencia o riesgo potencial identificado por la IA.\\nexport const qaWarningSchema = z.object({\\n id: z.string().uuid().describe('Unique identifier for the warning.'),\\n text: z.string().describe('A description of the potential risk, ambiguity, or missing information in the ticket.'),\\n severity: z.enum(\['low', 'medium', 'high'\])\\n .describe('The estimated severity of the risk.'),\\n}).describe('A potential risk or ambiguity identified by the AI during analysis.');\\n\\nexport type QAWarning = z.infer&lt;typeof qaWarningSchema&gt;;\\n |
| --- | --- |
| **QACanvasDocument** | typescript\\nimport { z } from 'zod';\\nimport { acceptanceCriterionSchema } from './AcceptanceCriterion';\\nimport { testCaseSchema } from './TestCase';\\nimport { qaWarningSchema } from './QAWarning';\\n\\n// El modelo de datos principal que representa el documento completo en el Canvas.\\n// Este es el objeto que se genera, se edita y se exporta.\\nexport const qaCanvasDocumentSchema = z.object({\\n metadata: z.object({\\n ticketKey: z.string().describe('The Jira ticket key this document is for.'),\\n generatedAt: z.string().datetime().describe('The ISO timestamp of when the document was generated.'),\\n modelVersion: z.string().optional().describe('The AI model version used for generation.'),\\n }),\\n acceptanceCriteria: z.array(acceptanceCriterionSchema)\\n .describe('A list of acceptance criteria for the feature.'),\\n testCases: z.array(testCaseSchema)\\n .describe('A list of test cases, including happy paths and edge cases.'),\\n qaWarnings: z.array(qaWarningSchema)\\n .describe('A list of warnings or potential issues identified by the AI.'),\\n}).describe('The root object representing the entire QA document for the canvas.');\\n\\nexport type QACanvasDocument = z.infer&lt;typeof qaCanvasDocumentSchema&gt;;\\n |
| --- | --- |

## **Parte 5: Estrategia de Pruebas Exhaustiva para el Backend**

Una estrategia de pruebas robusta es un requisito no negociable para garantizar que el nuevo backend de IA sea fiable, predecible y no introduzca regresiones. Dado que el sistema manejará tanto la generación de datos estructurados como las interacciones de streaming en tiempo real, se requiere un enfoque de pruebas multifacético que cubra todos los aspectos del comportamiento de la API. Esta sección detalla la filosofía, la configuración y los patrones de prueba específicos para los endpoints de la API de Next.js.

### **5.1. Filosofía y Enfoque de Pruebas**

Adoptaremos un enfoque de pirámide de pruebas clásico, adaptado a las particularidades de una aplicación de IA <sup>16</sup>:

1. **Pruebas Unitarias (Base de la Pirámide):** Serán rápidas y numerosas. Se centrarán en probar unidades de código aisladas: funciones de ayuda, lógica de construcción de prompts, y la validación de esquemas Zod. El objetivo es verificar que cada pieza de lógica individual funcione correctamente.
2. **Pruebas de Integración (Medio de la Pirámide):** Este será el enfoque principal para probar los endpoints de la API. Estas pruebas verificarán que los componentes del backend (Route Handlers, lógica de la IA, transformaciones de datos) funcionen juntos como se espera. Se realizarán llamadas HTTP simuladas a los endpoints y se validarán las respuestas completas, incluyendo el estado, las cabeceras y el cuerpo.
3. **Pruebas de Extremo a Extremo (E2E) (Cima de la Pirámide):** Serán menos numerosas pero más completas. Utilizarán un framework como Playwright o Cypress para automatizar la extensión de Chrome en un navegador real, simulando el flujo completo del usuario: abrir un ticket de Jira, interactuar con el ChatCanvas, y verificar que la UI se actualice correctamente en respuesta a las llamadas reales a la API (que estarán mockeadas a nivel de red).

### **5.2. Configuración del Entorno de Pruebas**

Se utilizará **Jest** como el corredor de pruebas y **TypeScript** para escribir las pruebas, aprovechando la integración next/jest para una configuración simplificada.<sup>16</sup>

- **Instalación de Dependencias:**  
    Bash  
    npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-node @types/jest msw jest-json-schema  

- **Configuración de Jest (jest.config.ts):** La configuración de Jest es crucial. Para los endpoints de la API de Next.js, que se ejecutan en un entorno de Node.js, es fundamental especificar el entorno de prueba correcto.
  - **El Problema del Entorno:** Por defecto, Jest puede usar jsdom, que simula un entorno de navegador. Sin embargo, los Route Handlers de Next.js utilizan APIs de Node.js y objetos globales como Request y Response que no existen o son diferentes en jsdom. Intentar probar un endpoint de API en jsdom resultará en errores.<sup>18</sup>
  - **La Solución:** Se debe usar un comentario de docblock en la parte superior de cada archivo de prueba de la API para instruir a Jest a usar el entorno node:  
        TypeScript  
        /\*\*  
        \* @jest-environment node  
        \*/  
        import { POST } from './route';  
        //... resto de la prueba  

- **Mocking de API con MSW:** Las pruebas de integración no deben realizar llamadas reales a los modelos de LLM, ya que esto las haría lentas, costosas y no deterministas. Se utilizará **Mock Service Worker (MSW)** para interceptar las solicitudes de red salientes (las llamadas al proveedor de LLM) y devolver respuestas mockeadas y predecibles.<sup>19</sup> Se configurará  
    msw/node para que se ejecute antes de todas las pruebas, interceptando las llamadas fetch.

### **5.3. Patrones de Pruebas de Integración para Endpoints de API**

Aquí se detallan los patrones de código específicos para probar cada tipo de endpoint.

#### **5.3.1. Prueba del Endpoint de Análisis (/api/analyze-ticket - No Streaming)**

Este endpoint devuelve un único objeto JSON, lo que lo hace relativamente sencillo de probar.

1. **Configurar el Mock de MSW:** Definir un handler de MSW que intercepte la llamada a la API de OpenAI (o el proveedor que se esté usando) y devuelva una respuesta JSON mockeada que simule la salida del LLM.
2. **Crear una Solicitud Mockeada:** Se simulará una solicitud POST entrante. Se puede usar un paquete como node-mocks-http o construir un objeto Request simple manualmente.<sup>20</sup>
3. **Llamar al Handler y Validar la Respuesta:**

TypeScript

/\*\*  
\* @jest-environment node  
\*/  
import { POST } from '@/app/api/analyze-ticket/route';  
import { server } from '@/mocks/server'; // Servidor MSW  
import { rest } from 'msw';  
import { qaCanvasDocumentSchema } from '@/lib/schemas/QACanvasDocument';  
<br/>// Mock de la respuesta de la IA  
const mockAiResponse = { /\*... un objeto que se ajusta a QACanvasDocumentSchema... \*/ };  
<br/>beforeAll(() => server.listen());  
afterEach(() => server.resetHandlers());  
afterAll(() => server.close());  
<br/>describe('/api/analyze-ticket', () => {  
it('should return a valid QA Canvas Document on success', async () => {  
// Configurar el mock de MSW para esta prueba  
server.use(  
rest.post('<https://api.openai.com/v1/chat/completions>', (req, res, ctx) => {  
// Devolver una respuesta que simula la función de \`generateObject\`  
const responseBody = {  
choices: } }\]  
};  
return res(ctx.status(200), ctx.json(responseBody));  
})  
);  
<br/>// Simular la solicitud entrante  
const mockRequest = new Request('<http://localhost/api/analyze-ticket>', {  
method: 'POST',  
headers: { 'Content-Type': 'application/json' },  
body: JSON.stringify({  
qaProfile: { focusOn: \['functional'\], language: 'es' },  
ticketJson: { key: 'TEST-1', summary: 'Test ticket', status: 'Open' }  
})  
});  
<br/>// Ejecutar el handler del endpoint  
const response = await POST(mockRequest);  
const body = await response.json();  
<br/>// Validar el estado y el cuerpo de la respuesta  
expect(response.status).toBe(200);  
expect(body).toEqual(mockAiResponse);  
<br/>// Validar el esquema de la respuesta  
const validation = qaCanvasDocumentSchema.safeParse(body);  
expect(validation.success).toBe(true);  
});  
});  

#### **5.3.2. Prueba del Endpoint Conversacional (/api/update-canvas - Streaming)**

Probar un endpoint de streaming es más complejo porque la respuesta no es un único payload, sino un flujo de datos a lo largo del tiempo.

1. **Configurar el Mock de MSW para Streaming:** El handler de MSW debe devolver un stream de datos que imite el formato SSE de la AI SDK.
2. **Consumir el Stream en la Prueba:** La clave es leer el ReadableStream del cuerpo de la respuesta y decodificar los chunks de datos.

TypeScript

/\*\*  
\* @jest-environment node  
\*/  
import { POST } from '@/app/api/update-canvas/route';  
import { server } from '@/mocks/server';  
import { rest } from 'msw';  
import { type UIMessage } from 'ai';  
<br/>// Función para crear un stream SSE mockeado  
function createMockedStream(chunks: string): ReadableStream {  
return new ReadableStream({  
start(controller) {  
for (const chunk of chunks) {  
controller.enqueue(new TextEncoder().encode(chunk));  
}  
controller.close();  
}  
});  
}  
<br/>describe('/api/update-canvas', () => {  
it('should stream back assistant response in SSE format', async () => {  
// Chunks que simulan la salida de toUIMessageStreamResponse()  
const sseChunks = \[  
'0:"Hello"\\n',  
'0:","\\n',  
'0:" world"\\n',  
'0:"!"\\n'  
\];  
<br/>server.use(  
rest.post('<https://api.openai.com/v1/chat/completions>', (req, res, ctx) => {  
return res(ctx.status(200), ctx.stream(createMockedStream(sseChunks)));  
})  
);  
<br/>const mockMessages: UIMessage = \[{ id: '1', role: 'user', parts: \[{ type: 'text', text: 'Hi' }\] }\];  
const mockRequest = new Request('<http://localhost/api/update-canvas>', {  
method: 'POST',  
headers: { 'Content-Type': 'application/json' },  
body: JSON.stringify({ messages: mockMessages })  
});  
<br/>const response = await POST(mockRequest);  
expect(response.status).toBe(200);  
expect(response.headers.get('Content-Type')).toContain('text/event-stream');  
<br/>// Consumir y decodificar el stream  
const reader = response.body!.getReader();  
const decoder = new TextDecoder();  
let streamedContent = '';  
while (true) {  
const { done, value } = await reader.read();  
if (done) break;  
streamedContent += decoder.decode(value);  
}  
<br/>// Validar el contenido completo del stream  
expect(streamedContent).toBe(sseChunks.join(''));  
});  
});  

### **5.4. Tabla: Escenarios de Prueba Críticos**

Para garantizar una cobertura completa, el equipo de desarrollo debe implementar pruebas para los siguientes escenarios. Esta tabla sirve como una lista de verificación de la calidad de las pruebas.

| Endpoint | Escenario de Prueba | Descripción |
| --- | --- | --- |
| **/api/analyze-ticket** | **Happy Path** | La solicitud es válida, la IA devuelve un objeto bien formado. La prueba debe verificar el estado 200 y que el cuerpo de la respuesta coincida con el esquema Zod. |
| --- | --- | --- |
|     | **Cuerpo de Solicitud Inválido** | El JSON enviado por el cliente no se ajusta al ticketAnalysisPayloadSchema. La prueba debe verificar un estado 400 y un mensaje de error claro. |
| --- | --- | --- |
|     | **La IA Devuelve JSON Malformado** | El mock de MSW devuelve un JSON inválido. La prueba debe verificar que generateObject falle y el endpoint devuelva un estado 500. |
| --- | --- | --- |
|     | **La IA Devuelve Objeto Incompleto** | El mock de MSW devuelve un JSON válido pero que no cumple con el esquema Zod. La prueba debe verificar que la validación del esquema falle y se devuelva un estado 500. |
| --- | --- | --- |
| **/api/update-canvas** | **Happy Path Streaming** | La solicitud es válida, la IA devuelve un stream de texto. La prueba debe verificar el estado 200 y que el contenido del stream se reciba correctamente. |
| --- | --- | --- |
|     | **Contexto del Documento Vacío** | Se realiza una llamada sin proporcionar el contexto del documento. La prueba debe verificar que la IA responda adecuadamente (p. ej., pidiendo contexto). |
| --- | --- | --- |
|     | **Error de Red Durante el Stream** | El mock de MSW simula un cierre abrupto de la conexión a mitad del stream. La prueba debe verificar que el cliente maneje el stream incompleto sin fallar. |
| --- | --- | --- |
| **/api/generate-suggestions** | **Happy Path con Herramientas** | La solicitud es válida, la IA llama a la herramienta proposeSuggestion varias veces. La prueba debe verificar el estado 200 y que el cuerpo de la respuesta sea un array de objetos de sugerencia válidos. |
| --- | --- | --- |
|     | **La IA No Llama a la Herramienta** | El mock de MSW devuelve una respuesta de texto simple en lugar de una llamada a la herramienta. La prueba debe verificar que el endpoint maneje esto elegantemente (p. ej., devolviendo un array vacío o un error 500). |
| --- | --- | --- |
|     | **Argumentos de Herramienta Inválidos** | La IA llama a la herramienta pero con argumentos que no se ajustan al esquema Zod. La prueba debe verificar que la validación de los parámetros de la herramienta falle y se maneje el error. |
| --- | --- | --- |

## **Parte 6: Hoja de Ruta de Implementación y Conclusiones**

Esta sección final proporciona una hoja de ruta estratégica para la implementación del sistema "Chat & Canvas" y resume las conclusiones clave del análisis técnico. El objetivo es ofrecer un camino claro y pragmático para llevar este proyecto de la concepción a la producción.

### **6.1. Hoja de Ruta de Implementación por Fases**

Se recomienda un enfoque de implementación por fases para gestionar la complejidad, entregar valor de forma incremental y permitir la retroalimentación temprana.

- **Fase 1: Fundación y Análisis Inicial (Duración estimada: 2-3 semanas)**

    1. **Configuración del Backend:** Crear el nuevo proyecto Next.js, configurar Jest, TypeScript y MSW.
    2. **Integración del AI Gateway:** Configurar el Vercel AI Gateway y añadir las claves de API de los proveedores de LLM en el entorno de Vercel.
    3. **Definición de Esquemas:** Implementar todos los esquemas Zod definidos en la Parte 4 en una biblioteca compartida (/src/lib/schemas).
    4. **Implementar Endpoint /api/analyze-ticket:** Construir y probar exhaustivamente el endpoint de análisis inicial, incluyendo la lógica de construcción de prompts y el manejo de errores.
    5. **Integración Frontend (Lectura):** Modificar la extensión de Chrome para que llame a este nuevo endpoint y renderice la respuesta del QACanvasDocument en una vista de solo lectura.

  - **Hito de Fin de Fase:** El usuario puede hacer clic en "Analizar Ticket" y ver un documento de QA completo y estructurado generado por la IA. La funcionalidad de chat aún no está activa.
- **Fase 2: Implementación del Chat Conversacional (Duración estimada: 3-4 semanas)**

    1. **Implementar Endpoint /api/update-canvas:** Construir y probar el endpoint de streaming, prestando especial atención a la estrategia para pasar el contexto completo del documento en el system prompt.
    2. **Integración de useChat:** Integrar el hook useChat de React en el frontend, conectándolo al endpoint /api/update-canvas.
    3. **Gestión del Estado del Documento:** Implementar la lógica del lado del cliente para parchear el estado del QACanvasDocument local en respuesta a los mensajes de la IA.
    4. **Persistencia Completa:** Asegurar que tanto el historial de UIMessage como el QACanvasDocument se persistan en chrome.storage.local y se restauren entre sesiones.

  - **Hito de Fin de Fase:** El usuario puede interactuar plenamente con la IA a través del chat para refinar el documento de QA. El Canvas se actualiza en respuesta a la conversación.
- **Fase 3: Sugerencias Proactivas y Pulido (Duración estimada: 2 semanas)**

    1. **Implementar Endpoint /api/generate-suggestions:** Construir el endpoint que utiliza la tool de IA para generar sugerencias estructuradas.
    2. **Integración de SuggestionBubbles:** Implementar la UI de las SuggestionBubbles en el frontend, que se poblará con los datos del nuevo endpoint.
    3. **Implementar Acción de Clic:** Hacer que al hacer clic en una burbuja se envíe un mensaje predefinido al chat para aplicar la sugerencia.
    4. **Pruebas E2E:** Desarrollar un conjunto básico de pruebas de extremo a extremo para validar los flujos de usuario más críticos.

  - **Hito de Fin de Fase:** El producto está completo según la visión original. El sistema no solo responde, sino que también guía proactivamente al usuario.

### **6.2. Futuras Mejoras y Escalabilidad**

La arquitectura propuesta sienta las bases para futuras innovaciones potentes:

- **Retrieval-Augmented Generation (RAG):** El backend podría integrarse con una base de datos de vectores (p. ej., Pinecone, Supabase pgvector) que contenga embeddings de todos los tickets de Jira del proyecto o de la documentación técnica. El agente de IA podría entonces buscar información relevante para proporcionar un contexto aún más rico y preciso en sus análisis.
- **Agentes Multi-paso:** La AI SDK v5 introduce primitivas avanzadas como prepareStep y stopWhen <sup>3</sup>, que permiten la creación de agentes de IA más complejos que pueden ejecutar secuencias de herramientas y lógica en múltiples pasos para resolver problemas más difíciles.
- **Análisis de Imágenes:** Aprovechando el array parts de UIMessage, el frontend podría permitir a los usuarios subir capturas de pantalla de la UI. El backend pasaría estas imágenes al LLM (utilizando un modelo multimodal como GPT-4o) para un análisis visual, pidiendo a la IA que "genere casos de prueba basados en esta captura de pantalla de la interfaz de usuario".<sup>21</sup>

### **6.3. Conclusiones**

La transición del "QA Test Recorder" a un sistema "Chat & Canvas" es una evolución estratégica que transformará la herramienta de un simple grabador a un asistente de QA inteligente y proactivo. Este informe ha presentado un plan técnico detallado para lograr esta visión utilizando la Vercel AI SDK v5.

Las decisiones arquitectónicas clave que garantizarán el éxito del proyecto son:

1. **Adopción de una Arquitectura Cliente-Servidor:** El traslado de la lógica de IA a un backend de Next.js es fundamental para aprovechar los modelos de lenguaje más potentes.
2. **Uso Estratégico de las Primitivas del SDK:** La aplicación deliberada de generateObject para la creación transaccional de documentos y streamText para el refinamiento conversacional es el patrón de diseño central que garantiza la robustez y una buena experiencia de usuario.
3. **Modelado de Datos Riguroso:** La definición de todos los modelos de datos con esquemas Zod es la base de la integridad y la seguridad de tipos en todo el sistema, abordando una de las principales preocupaciones de la solicitud inicial.
4. **Abstracción a través del AI Gateway:** El uso del Vercel AI Gateway desde el primer día proporciona una flexibilidad y resiliencia cruciales, desvinculando la aplicación de un único proveedor de IA y preparando el sistema para el futuro.
5. **Compromiso con las Pruebas:** Una estrategia de pruebas exhaustiva, especialmente para los endpoints de streaming, es la única manera de asegurar que el backend sea fiable y esté listo para producción.

Al seguir la hoja de ruta y los patrones de diseño descritos en este documento, el equipo de desarrollo estará equipado para construir una herramienta de QA de próxima generación que no solo mejorará drásticamente la eficiencia, sino que también elevará la calidad y la profundidad del proceso de pruebas de software.