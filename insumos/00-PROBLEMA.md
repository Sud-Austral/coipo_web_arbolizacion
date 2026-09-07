# Problema, reconstruido desde el codigo

Este documento no recoge lo que dijo un area usuaria. Se deduce de lo que el
repositorio efectivamente contiene, y cada afirmacion queda marcada como lo
que es.

## Que se gestiona, y por lo tanto que probablemente estaba roto

El esquema de datos define especies, su taxonomia, sus nombres comunes, su
presencia por region, su estado de conservacion y sus fotografias
[INSUMO/etapa1-contrato-datos/schema.sql:230],
[INSUMO/etapa1-contrato-datos/schema.sql:211],
[INSUMO/etapa1-contrato-datos/schema.sql:305],
[INSUMO/etapa1-contrato-datos/schema.sql:324],
[INSUMO/etapa1-contrato-datos/schema.sql:347],
[INSUMO/etapa1-contrato-datos/schema.sql:373]. El sistema gestiona un
catalogo de especies con esas dimensiones, luego probablemente habia un
problema para consultar especies por region, por nombre comun y por estado de
conservacion de forma unificada [INFERIDO]. La cadena es debil: el codigo
prueba que alguien construyo el catalogo, no prueba por que.

Existe ademas una vista de completitud del catalogo
[INSUMO/etapa1-contrato-datos/schema.sql:544] y una tabla de historial de
especie [INSUMO/etapa1-contrato-datos/schema.sql:432]. Que se haya
modelado explicitamente cuan completa esta cada ficha sugiere que la falta de
datos era un problema reconocido [INFERIDO]. Que se hacia con esa medicion de
completitud, y quien la miraba, es [PENDIENTE].

## Quien sufre el problema

No hay guards, decoradores de autorizacion, middleware de permisos ni tabla de
usuarios en la evidencia: el inventario de rutas de API viene vacio y las
unicas variables de entorno detectadas son de publicacion y de ruta de fotos
[frontend/vite.config.js:6], [frontend/src/datos.js:13]. Por lo tanto no hay
ningun rol declarado en el codigo, y los roles del negocio son [PENDIENTE].

Que el sitio se publique sin autenticacion sugiere una audiencia abierta y no
una operacion interna con perfiles [INFERIDO], a partir del flujo de despliegue
[.github/workflows/deploy.yml] y del archivo que desactiva el procesamiento
del publicador estatico [frontend/public/.nojekyll].

CUANTAS PERSONAS son, en cualquiera de los lados: [PENDIENTE].

## Como lo resolvian antes

Hay una planilla de calculo en el repositorio como insumo de origen
[INSUMO/RyC Especies (21.08.2026).xlsx], y el constructor de datos la procesa
con una libreria de planillas y marcos de datos
[INSUMO/etapa1-contrato-datos/build_data.py:27]. De ahi se infiere que el
catalogo se mantenia en una planilla y que el proyecto la convierte en datos
publicables [INFERIDO].

QUIEN mantenia esa planilla, con que periodicidad y cuanto tardaba cada
actualizacion: [PENDIENTE]. La fecha que aparece en el nombre del archivo es
un nombre de archivo, no una fecha de corte confirmada: [PENDIENTE].

Las fotografias tambien se procesan por lote: hay un derivador de imagenes
[INSUMO/build_fotos.py] y un generador de formatos comprimidos
[frontend/scripts/generar-avif.mjs]. Se infiere que antes las fotografias
llegaban sueltas y sin tamanos normalizados [INFERIDO]. De donde venian y
quien las tomo: [PENDIENTE].

## Volumen

Indicios, no cifras. El inventario del repositorio contiene 1047 archivos de
imagen derivados bajo la carpeta publica de fotos, en tres tamanos por foto
—por ejemplo [frontend/public/fotos/luma-apiculata/285-400.avif],
[frontend/public/fotos/luma-apiculata/285-1000.avif] y
[frontend/public/fotos/luma-apiculata/285-1800.avif]—, lo que da un orden de
magnitud de cientos de fotografias originales [INFERIDO]. El catalogo de
especies se publica como un unico archivo de datos
[frontend/public/datos/especies.json], sin paginacion ni particion, lo que
sugiere un volumen que cabe en memoria del navegador [INFERIDO].

La cantidad real de especies, de fotografias y de consultas esperadas es
[PENDIENTE]. Un archivo de datos unico no prueba un tamano.

## Que pasa si no se hace nada

[PENDIENTE]. El codigo no lo responde y no se deduce de que el sistema exista.

## Quien decide que esta terminado

[PENDIENTE]. No hay en la evidencia ningun criterio de aceptacion, acta ni
responsable de cierre.

## Marco normativo

El modelo guarda estado de conservacion por especie
[INSUMO/etapa1-contrato-datos/schema.sql:347] y el frontend maneja siglas y
escalas de gravedad asociadas [frontend/src/dominio.js]. Si esas categorias
corresponden a una clasificacion oficial, la referencia normativa y su
vigencia son [VERIFICAR].
