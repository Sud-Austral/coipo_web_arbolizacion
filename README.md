# coipo_web_arbolizacion

## Descripción

Catálogo web de especies para arbolado urbano (RyC de Especies, CONAF): fichas con datos taxonómicos, de conservación y fotografías, con filtros por hábito, origen, emplazamiento urbano, estado de conservación y otros campos. Es un sitio estático (sin backend) publicado en GitHub Pages: <https://sud-austral.github.io/coipo_web_arbolizacion/>. Los datos que lee el sitio son tres archivos JSON versionados en `frontend/public/datos/` (`especies.json`, `facetas.json`, `meta.json`) más `fotos.json`; el sitio no consulta ninguna base de datos. Detalle en `insumos/` y `CLAUDE.md`.

## Stack técnico

- Node.js
- React
- Vite
- Pandas
- PostgreSQL

## Estructura del proyecto

- `frontend/`: Directorio principal de la aplicación frontend
- `INSUMO/`: Contiene scripts para procesamiento de datos y carga a base de datos
- `.github/workflows/deploy.yml`: build y publicación en GitHub Pages

## Requisitos

- Node.js
- PostgreSQL

## Instalación

1. Instalar dependencias del frontend:
   ```bash
   cd frontend
   npm install
   ```

## Configuración

No hay secretos ni archivos `.env`. Variables de Vite:
- `BASE_URL`: la entrega Vite a partir del `base` fijo en `frontend/vite.config.js` (`/coipo_web_arbolizacion/`); no se configura por entorno.
- `VITE_FOTOS_BASE` (opcional): base de las imágenes WebP de respaldo; si falta, se usa `BASE_URL` (en producción solo se despliega el AVIF).

## Ejecución

Comandos disponibles en el frontend:
- `npm run dev`: Iniciar servidor de desarrollo
- `npm run build`: Construir la aplicación para producción
- `npm run lint`: Ejecutar linter
- `npm run preview`: Previsualizar la construcción

## Base de datos

Esquema PostgreSQL de referencia en `INSUMO/etapa1-contrato-datos/schema.sql` (el sitio publicado no lo usa: lee los JSON). Tablas:
- vocabulario
- region
- taxon
- especie
- nombre_comun
- especie_region
- conservacion
- fotografia
- fuente
- especie_fuente
- especie_historial

Vistas: `v_completitud` y `v_especie_json`.

## Desarrollo

El proyecto incluye componentes React como:
- Ficha.jsx
- Lamina.jsx
- Foto.jsx
- App.jsx
- Catalogo.jsx
- iconos.jsx

## Pruebas

No hay suite de pruebas. Verificado el 2026-11-24 en `frontend/`: `npm ci`, `npm run lint` (oxlint, código 0, con avisos `no-unused-expressions` en `src/App.jsx`) y `npm run build` (código 0, ~2 s).

## Despliegue

Cada push a `main` ejecuta `.github/workflows/deploy.yml` (Node 22: `npm ci`, `npm run build` en `frontend/`, publicación de `frontend/dist` en GitHub Pages). No hay pruebas automáticas en ese flujo. Este README se mantiene a mano: el workflow `readme.yml` que lo regeneraba se quitó en el commit `67d5b91`. No comprobado: que el sitio publicado en Pages esté al día.
