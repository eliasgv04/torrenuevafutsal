# Torrenueva Futsal — Entrenamientos

Proyecto web para registrar entrenamientos y ejercicios del Torrenueva Futsal.

## Quick start

1. Instala dependencias:

```bash
npm install
```

2. Ejecuta en desarrollo:

```bash
npm run dev
```

3. Crear un proyecto en Supabase y añadir las variables de entorno en GitHub Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

4. Crear un repo en GitHub llamado `torrenueva-futsal` y subir el código. GitHub Actions desplegará en GitHub Pages.

## Notas
- Branding: colores amarillo y verde oscuro. Sustituye `public/logo.png` por el logo del club.
- Esta es una plantilla inicial. Implementa el backend Supabase y el almacenamiento de fotos siguiendo `src/lib/supabaseClient.js`.

## Supabase (opcional)

Si quieres usar Supabase en vez del fallback en localStorage:

1. Crea un proyecto en https://app.supabase.com
2. En SQL editor ejecuta `supabase/schema.sql` (crea las tablas `teams`, `exercises`, `exercise_records`).
3. Crea un bucket público `photos` en Storage.
4. Añade las variables como Secrets en GitHub: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON`.

Si no configuras las variables, la app funcionará en modo local guardando datos en `localStorage` y fotos como data URLs.

## Deploy en GitHub Pages

1. Crea un repo `torrenueva-futsal` en GitHub y sube el código.
2. GitHub Actions (ya incluido) construirá y publicará la carpeta `dist` en Pages cuando hagas push a `main`.

