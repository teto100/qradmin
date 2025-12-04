# UPI Admin Panel - Análisis de Postulantes

Panel web administrativo para analizar respuestas de postulantes y detectar uso de IA en sus respuestas.

## 🚀 Tecnologías

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Firebase (Firestore + Auth)
- **IA:** OpenAI API (Cloud Functions)
- **Análisis:** Detección de patrones de IA

## 📦 Instalación

1. **Clonar e instalar dependencias:**
```bash
cd upi-admin-panel
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env.local
```

Editar `.env.local` con tus credenciales de Firebase:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_dominio
VITE_FIREBASE_PROJECT_ID=tu_proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_ADMIN_EMAILS=admin@example.com,otro@admin.com
```

3. **Ejecutar en desarrollo:**
```bash
npm run dev
```

## 🔧 Configuración de Firebase

### 1. Crear proyecto Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Habilita Authentication (Email/Password)
4. Habilita Firestore Database

### 2. Configurar Authentication
- Habilitar método "Email/Password"
- Agregar usuarios administradores manualmente

### 3. Reglas de Firestore
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in ['admin@example.com'];
    }
    
    match /applicants/{document} {
      allow read, write: if isAdmin();
    }
    
    match /responses/{document} {
      allow read, write: if isAdmin();
    }
    
    match /questions/{document} {
      allow read, write: if isAdmin();
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 📊 Estructura de Datos

### Postulantes (applicants)
```javascript
{
  email: string,
  name: string,
  phone: string,
  appliedAt: Timestamp,
  status: "pending" | "reviewing" | "approved" | "rejected",
  overallAIScore: number, // 0-100
  reviewedBy: string | null,
  reviewedAt: Timestamp | null,
  notes: string
}
```

### Respuestas (responses)
```javascript
{
  applicantId: string,
  questionId: string,
  questionText: string,
  answer: string,
  answeredAt: Timestamp,
  timeSpent: number, // segundos
  aiAnalysis: {
    score: number, // 0-100
    confidence: "low" | "medium" | "high",
    indicators: array,
    reasoning: string,
    analyzedAt: Timestamp
  }
}
```

## 🤖 Sistema de Detección de IA

### Indicadores Analizados
- **Patrones de escritura:** Estructura, conectores formales
- **Análisis temporal:** Velocidad de escritura vs longitud
- **Contenido:** Vocabulario técnico, ausencia de errores
- **Formato:** Listas, estructura muy organizada

### Scores de IA
- **0-30%:** Muy probablemente humano ✅
- **31-60%:** Incierto, requiere revisión manual ⚠️
- **61-100%:** Muy probablemente IA ❌

## 🔐 Seguridad

### Variables de Entorno
- ✅ Usar `.env.local` para desarrollo
- ✅ Configurar variables en Vercel para producción
- ❌ NUNCA subir `.env.local` a Git
- ❌ NUNCA hardcodear API keys

### OpenAI API
- ⚠️ **IMPORTANTE:** La API key de OpenAI NO debe estar en el frontend
- ✅ Usar Cloud Functions para llamadas a OpenAI
- ✅ Implementar rate limiting y validación

## 📱 Funcionalidades

### ✅ Implementado
- [x] Login de administradores
- [x] Dashboard con estadísticas básicas
- [x] Lista de postulantes con filtros
- [x] Componentes de UI (badges, sidebar)
- [x] Análisis básico de texto
- [x] Estructura de Firebase

### 🚧 En Desarrollo
- [ ] Detalle de postulante individual
- [ ] Análisis de respuestas con OpenAI
- [ ] Gestión de preguntas
- [ ] Reportes y exportación
- [ ] Gráficos y estadísticas avanzadas
- [ ] Cloud Functions para OpenAI

## 🚀 Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Variables en Vercel
Configurar todas las variables de `.env.local` en el dashboard de Vercel.

## 📝 Próximos Pasos

1. **Configurar Firebase** con tus credenciales
2. **Crear usuarios admin** en Firebase Auth
3. **Implementar Cloud Functions** para OpenAI
4. **Agregar datos de prueba** en Firestore
5. **Desarrollar páginas faltantes**

## 🆘 Soporte

Para dudas o problemas:
1. Revisar la documentación de Firebase
2. Verificar configuración de variables de entorno
3. Comprobar reglas de Firestore
4. Validar permisos de usuario administrador

---

**Powered by Antonio's Crew**