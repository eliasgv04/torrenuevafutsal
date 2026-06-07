# Torrenueva Futsal — Gestión de equipo

Aplicación web privada para la gestión integral de un equipo de fútbol sala. Permite organizar ejercicios, planificar entrenamientos, llevar estadísticas de jugadores y gestionar partidos.

**Demo:** [eliasgv04.github.io/torrenuevafutsal](https://eliasgv04.github.io/torrenuevafutsal/)
> Acceso restringido. Credenciales disponibles bajo solicitud.

---

## Funcionalidades

- **Ejercicios** — Catálogo con foto, categoría, objetivos y dimensiones. Historial de uso y estadísticas de efectividad por ejercicio.
- **Planificador de entrenamientos** — Creación de sesiones con selección de ejercicios, jugadores convocados, objetivos y calentamiento.
- **Historial de entrenamientos** — Búsqueda y filtrado por fecha, notas o ejercicios. Exportación a PDF y Excel.
- **Dashboard** — Métricas de uso de ejercicios y rendimiento del equipo.
- **Gestión de jugadores** — Plantilla con estadísticas de carrera (goles, asistencias, minutos, tarjetas…).
- **Seguimiento de partidos** — Control en tiempo real de eventos, estadísticas individuales y del rival.
- **Pizarra táctica** — Tablero interactivo para diseñar jugadas.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth + RLS |
| Estilos | CSS puro con variables y animaciones |
| Exportación | pdf-lib · jsPDF · SheetJS |
| Despliegue | GitHub Pages (CI/CD con GitHub Actions) |

## Seguridad

- Acceso protegido mediante Supabase Auth
- Row Level Security (RLS) en todas las tablas: los datos son inaccesibles sin sesión autenticada, incluso con la clave pública de la API
- Registro de nuevos usuarios deshabilitado
- Credenciales no almacenadas en el código fuente

## Arquitectura

```
src/
├── App.jsx              # Auth gate + layout raíz
├── pages/
│   └── HomePage.jsx     # Selección de equipo
├── components/
│   ├── TeamPage.jsx     # Vista principal del equipo
│   ├── FutsalPage.jsx   # Módulo de partidos
│   ├── TacticalBoard.jsx
│   └── ...
└── lib/
    ├── api.js           # Capa de datos (Supabase + fallback localStorage)
    ├── supabaseClient.js
    ├── pdfExport.js
    └── pdfFicha.js
```

La capa `api.js` implementa un patrón de fallback: si Supabase no está disponible o la petición falla tras reintentos automáticos, los datos se sirven desde `localStorage`.
