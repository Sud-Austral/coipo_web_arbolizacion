# coipo_web_arbolizacion — guía para agentes

Sitio estático del **Catálogo RyC de Especies para Arbolado Urbano** (CONAF). Resumen en [`README.md`](README.md); problema y solución en [`insumos/`](insumos/)
(reconstruidos desde el código, con `[PENDIENTE]` y `[VERIFICAR]` que los cierra el área usuaria, no un asistente). Lo marcado VERIFICADO se leyó en el repo el 2026-10-24; no ejecuté build ni pruebas.

## Qué es

- Aplicación React 19 + Vite 8, **sin backend ni base de datos en producción**. Se publica en GitHub Pages en `https://sud-austral.github.io/coipo_web_arbolizacion/` (`base` en `frontend/vite.config.js`).
- Lee JSON versionados de `frontend/public/datos/` (`especies.json` 1.016 fichas, `facetas.json`, `meta.json`, `fotos.json`) y fotos de `frontend/public/fotos/` (15 especies con foto, según `meta.json`).
- Solo se despliega el AVIF de las fotos; los WebP de respaldo están en `.gitignore`.

## Estructura

```
frontend/src/    App.jsx, Catalogo.jsx, Ficha.jsx, Lamina.jsx, Foto.jsx, iconos.jsx, datos.js (carga), dominio.js (lógica pura)
frontend/public/ datos/ (JSON), fotos/ (derivados), favicon.svg
frontend/scripts/generar-avif.mjs   genera AVIF desde los WebP (necesita sharp, que NO es dependencia)
INSUMO/          fuente de los datos: Excel "RyC Especies (21.08.2026).xlsx", build_fotos.py, etapa1-contrato-datos/ (build_data.py, schema.sql, load_pg.py), sitio-arbolado-urbano/
insumos/         documentos de problema y solución (minúscula; no confundir con INSUMO/)
.github/workflows/  deploy.yml (Pages) y readme.yml (mantiene el README)
```

## Comandos (desde `frontend/`)

```bash
npm install        # o npm ci
npm run dev
npm run lint       # oxlint
npm run build      # vite build
npm run preview
```

No hay suite de pruebas. Para regenerar datos: `pip install pandas openpyxl` y `build_data.py` de `INSUMO/etapa1-contrato-datos/` (ver su `LEEME.md`); `load_pg.py` carga el contrato en PostgreSQL y requiere una base (no usar una real sin permiso).
Las fotos: `INSUMO/build_fotos.py` (lee la fototeca original, que no está en el repo) y luego `npm i --no-save sharp && node scripts/generar-avif.mjs`.

## Convenciones y trampas conocidas (VERIFICADO en comentarios del código)

- **`base` de Vite**: todas las URLs de datos y fotos se construyen con `import.meta.env.BASE_URL`, que termina en barra; las rutas de `fotos.json` vienen **sin barra inicial**. Concatenar `${BASE}/fotos/…` genera `//fotos/…` y en Pages apunta a otro host. Si el repo se renombra, hay que cambiar `base` o el sitio queda en blanco.
- **`fotos.json` se indexa por nombre científico literal**, nunca por `fotos[].id` (53 de 90 discrepan entre archivos; el fallo es silencioso y muestra otra foto).
- **No normalizar las mayúsculas de los valores de conservación** (`En Peligro (EN)` frente a `En peligro crítico (CR)`): son las del dato y normalizarlas rompe el filtro (`dominio.js`).
- Los nombres y valores de `dominio.js` son llaves de datos, no etiquetas: se mantienen literales.
- `dominio.js` es JS puro (sin React ni DOM); mantenerlo así.
- `VITE_FOTOS_BASE` permite servir los WebP de respaldo desde un CDN sin tocar componentes.
- Código y textos en español.

## Qué no tocar

- `frontend/public/datos/*.json` son salida del pipeline de `INSUMO/`: no se editan a mano.
- No versionar la fototeca original (1,7 GB según `build_fotos.py`) ni credenciales; el repo no tiene `.env`.
- No cerrar los `[PENDIENTE]` / `[VERIFICAR]` de `insumos/` por cuenta propia (dueño del catálogo, validez de los datos de conservación).
- `README.md` lo mantiene un bot entre las marcas `AI:BEGIN`/`AI:END`; los cambios a mano dentro de ese bloque pueden ser reemplazados en el siguiente push a `main`.
