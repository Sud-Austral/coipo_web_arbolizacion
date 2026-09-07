<!-- AI:BEGIN id=readme sha=5d9df25bb92f -->
# coipo_web_arbolizacion

## Descripción

Proyecto web que presenta información sobre especies arbóreas, incluyendo fotografías y datos taxonómicos.

## Stack técnico

- Node.js
- React
- Vite
- Pandas
- PostgreSQL

## Estructura del proyecto

- `frontend/`: Directorio principal de la aplicación frontend
- `INSUMO/`: Contiene scripts para procesamiento de datos y carga a base de datos
- `.github/workflows/`: Archivos de configuración para despliegue y generación de README

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

Variables de entorno detectadas:
- `BASE_URL`: URL base de la aplicación
- `VITE_FOTOS_BASE`: Base URL para las imágenes

## Ejecución

Comandos disponibles en el frontend:
- `npm run dev`: Iniciar servidor de desarrollo
- `npm run build`: Construir la aplicación para producción
- `npm run lint`: Ejecutar linter
- `npm run preview`: Previsualizar la construcción

## Base de datos

Tablas detectadas en el esquema:
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
- en
- v_completitud

## Desarrollo

El proyecto incluye componentes React como:
- Ficha.jsx
- Lamina.jsx
- Foto.jsx
- App.jsx
- Catalogo.jsx
- iconos.jsx

## Pruebas

No se encontraron evidencias de configuración de pruebas.

## Despliegue

Configuración de despliegue disponible en `.github/workflows/deploy.yml`.
<!-- AI:END id=readme -->

<!-- ai-readme-fingerprint: sha256:79808f9e07d99b9997bb69088adac524c269c765a262ac5022f947366aa7818c -->
