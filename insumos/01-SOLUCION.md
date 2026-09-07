# Solucion, leida del codigo

Aca el codigo es la fuente directa. Las citas son densas y las inferencias se
limitan a lo que no esta escrito.

## Que hace el sistema

Permite consultar un catalogo de especies y revisar la ficha de cada una.
Sobre el catalogo se puede filtrar por region, por facetas del dominio y por
texto, y ordenar los resultados: la grilla, la barra de resultados, los
selectores de region y los controles de faceta estan implementados en el
catalogo [frontend/src/Catalogo.jsx], y los ordenes y opciones de orden estan
declarados en el dominio [frontend/src/dominio.js]. Sobre cada especie se
puede abrir su ficha, ver sus caracteristicas medidas, su galeria de
fotografias y una lamina de escala [frontend/src/Ficha.jsx],
[frontend/src/Lamina.jsx], [frontend/src/Foto.jsx].

Ademas del sitio de consulta, el repositorio contiene la cadena que produce
los datos que el sitio muestra: construir el conjunto de datos a partir de la
planilla de origen [INSUMO/etapa1-contrato-datos/build_data.py:27], derivar
las fotografias a varios tamanos [INSUMO/build_fotos.py],
[frontend/scripts/generar-avif.mjs], y cargar el resultado en una base
relacional [INSUMO/etapa1-contrato-datos/load_pg.py:15]. El sitio que se
publica no consulta esa base: consume archivos de datos ya construidos
[frontend/src/datos.js:13], [frontend/public/datos/especies.json],
[frontend/public/datos/facetas.json], [frontend/public/datos/fotos.json],
[frontend/public/datos/meta.json] [INFERIDO].

## Capacidades, una por una

- Filtrar especies por region. Hay tabla de presencia por region
  [INSUMO/etapa1-contrato-datos/schema.sql:324] y controles de region en la
  interfaz [frontend/src/Catalogo.jsx].
- Filtrar por facetas del catalogo. Las facetas se calculan en la
  construccion del dato [INSUMO/etapa1-contrato-datos/build_data.py] y se
  publican como archivo aparte [frontend/public/datos/facetas.json].
- Buscar por nombre comun ademas del nombre cientifico. Hay tabla dedicada de
  nombres comunes [INSUMO/etapa1-contrato-datos/schema.sql:305] y su
  construccion en el pipeline [INSUMO/etapa1-contrato-datos/build_data.py].
- Mostrar estado de conservacion con una escala de gravedad
  [INSUMO/etapa1-contrato-datos/schema.sql:347], [frontend/src/dominio.js].
- Mostrar fotografias en varios tamanos segun el espacio disponible
  [INSUMO/etapa1-contrato-datos/schema.sql:373], [frontend/src/Foto.jsx],
  [frontend/public/datos/fotos.json].
- Medir cuan completa esta cada ficha. Existe una vista de completitud en el
  esquema [INSUMO/etapa1-contrato-datos/schema.sql:544] y una funcion de
  completitud en el constructor
  [INSUMO/etapa1-contrato-datos/build_data.py].
- Comparar lo cargado contra lo construido. El cargador tiene una funcion de
  comparacion ademas de la de carga [INSUMO/etapa1-contrato-datos/load_pg.py].
  Contra que se compara y quien revisa la diferencia es [PENDIENTE].

## Roles: quien ve que

No hay ningun rol en el codigo. El inventario de rutas de API del analizador
viene vacio para este repositorio, no hay variables de entorno de
autenticacion —las unicas detectadas son la base de publicacion
[frontend/vite.config.js:6] y la base de las fotos
[frontend/src/datos.js:13]— y no existe ningun archivo de sesion, guard o
decorador en la evidencia. La consecuencia razonable es que el sitio se
consulta sin identificarse [INFERIDO].

Quien puede modificar el catalogo, quien aprueba una ficha antes de
publicarla y quien puede ejecutar la carga a la base: [PENDIENTE].

## De donde salen los datos

- Planilla de origen [INSUMO/RyC Especies (21.08.2026).xlsx], consumida por
  el constructor [INSUMO/etapa1-contrato-datos/build_data.py:27] [INFERIDO].
  El DUENO de esa planilla es [PENDIENTE].
- Clasificacion de fotografias declarada en un archivo aparte
  [INSUMO/sitio-arbolado-urbano/fotos_clasificacion.json], leida por el
  constructor a traves de su lectura de fototeca
  [INSUMO/sitio-arbolado-urbano/build_data.py] [INFERIDO]. Quien clasifico
  cada foto es [PENDIENTE].
- Fotografias originales. El derivador extrae metadatos de las imagenes
  [INSUMO/build_fotos.py]. De donde provienen los originales y quien tiene los
  derechos sobre ellos es [PENDIENTE], y si esos metadatos incluyen
  coordenadas o autoria es [VERIFICAR].
- Base relacional de destino [INSUMO/etapa1-contrato-datos/load_pg.py:15]. En
  que servidor vive y quien la administra es [PENDIENTE].
- Fuentes bibliograficas del catalogo. El esquema modela fuentes y su relacion
  con cada especie [INSUMO/etapa1-contrato-datos/schema.sql:415],
  [INSUMO/etapa1-contrato-datos/schema.sql:423]. Cuales son esas fuentes y si
  su uso esta autorizado es [VERIFICAR].

## Que NO hace

Solo ausencias que el analizador busco de forma exhaustiva, y marcadas igual.

- No expone ninguna interfaz de programacion propia: el inventario de rutas de
  API del analizador esta vacio para este repositorio [INFERIDO].
- No hay ningun archivo de manifiesto de dependencias fuera del frontend: el
  unico manifiesto detectado es [frontend/package.json]. Los scripts de
  procesamiento no declaran sus dependencias en ningun archivo del inventario
  [INFERIDO].
- El sitio publicado no escribe: no hay en la evidencia ningun formulario de
  ingreso ni ruta de escritura; las unicas escrituras del repositorio ocurren
  en los scripts de carga que se ejecutan fuera del sitio
  [INSUMO/etapa1-contrato-datos/load_pg.py] [INFERIDO].
- No hay pruebas automatizadas en el inventario de archivos [INFERIDO].

## Iteraciones

Hay dos copias casi identicas del mismo pipeline en el repositorio, una bajo
[INSUMO/etapa1-contrato-datos/build_data.py] y otra bajo
[INSUMO/sitio-arbolado-urbano/build_data.py], con esquemas equivalentes
[INSUMO/etapa1-contrato-datos/schema.sql:230] y
[INSUMO/sitio-arbolado-urbano/schema.sql:230]. La segunda incluye ademas un
sitio previo sin React, armado desde una plantilla
[INSUMO/sitio-arbolado-urbano/sitio/armar.py],
[INSUMO/sitio-arbolado-urbano/sitio/plantilla.html],
[INSUMO/sitio-arbolado-urbano/sitio/app.js]. Se infiere que hubo una version
anterior del sitio, en pagina estatica armada por script, reemplazada despues
por la aplicacion actual [INFERIDO]. Cual de las dos carpetas es la vigente y
cual quedo como historia es [PENDIENTE].

Hay documentacion propia del pipeline en el repositorio
[INSUMO/etapa1-contrato-datos/LEEME.md],
[INSUMO/sitio-arbolado-urbano/LEEME.md]. El README de la raiz solo contiene el
nombre del proyecto [README.md].

## Sobre la calidad de esta evidencia

La evidencia de este repositorio es suficiente para describir capacidades y
origen de los datos, pero no aporta nada sobre personas, plazos ni decisiones.
Todo lo relativo al negocio quedo en [PENDIENTE], y eso tambien es
informacion: el analizador no ve nada de eso porque no esta escrito en el
codigo.
