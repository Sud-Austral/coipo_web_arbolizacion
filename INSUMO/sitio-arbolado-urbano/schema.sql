-- ===========================================================================
-- Catálogo RyC de Especies para Arbolado Urbano — esquema PostgreSQL
-- CONAF · 2026
-- ===========================================================================
-- Este esquema es el equivalente normalizado del contrato que produce
-- `build_data.py`. La API debe devolver la MISMA forma que `especies.json`
-- (ver la vista `v_especie_json` al final): así el sitio migra de archivo
-- estático a base de datos sin tocar el frontend.
--
-- Decisiones que vienen del análisis del Excel de origen:
--   · Las 17 columnas de región pasan a `especie_region`. Una celda con el
--     código regional significa presencia; vacía significa ausencia, no
--     dato faltante.
--   · `altura`, `longevidad` y `dureza` quedan NULL en arbustos. En el Excel
--     traen un valor constante por construcción, no una evaluación.
--   · Los campos aún sin datos (descripción, floración, tolerancias…) se
--     declaran desde ahora para que llenarlos no requiera una migración.
--   · Toda clasificación lleva `fuente` y `verificado_en`: la trazabilidad
--     es el vacío más serio del Excel actual.
--
--   psql -d arbolado -f schema.sql
-- ===========================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- `unaccent()` es STABLE porque depende de un diccionario que podría cambiar,
-- y PostgreSQL no admite funciones STABLE en una expresión de índice. Fijar el
-- diccionario explícitamente la vuelve IMMUTABLE y permite indexar la búsqueda
-- sin acentos, que es como la gente escribe «quillay» o «coigue».
CREATE OR REPLACE FUNCTION public.sin_acentos(text)
RETURNS text AS $$
    SELECT public.unaccent('public.unaccent'::regdictionary, lower($1))
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

DROP SCHEMA IF EXISTS arbolado CASCADE;
CREATE SCHEMA arbolado;
SET search_path TO arbolado, public;


-- ---------------------------------------------------------------------------
-- 1. Vocabularios controlados
-- ---------------------------------------------------------------------------
-- Cada escala se declara como ENUM con códigos cortos, y las etiquetas que ve
-- el usuario viven en `vocabulario`. Dos razones concretas:
--   · Las etiquetas del Excel superan los 63 bytes que admite una etiqueta de
--     ENUM en PostgreSQL, de modo que no pueden ser el valor almacenado.
--   · Corregir la redacción de una categoría pasa a ser un UPDATE en vez de un
--     ALTER TYPE. Los textos son contenido, no esquema.
-- El orden de declaración de cada ENUM es el orden natural de su escala, así
-- ORDER BY funciona sin columna auxiliar.

CREATE TYPE habito             AS ENUM ('arborea', 'arbustiva');
CREATE TYPE origen             AS ENUM ('nativa', 'introducida');
CREATE TYPE follaje            AS ENUM ('perenne', 'caduco');
CREATE TYPE raiz_botanica      AS ENUM ('fasciculada', 'oblicua', 'mixta', 'pivotante');
CREATE TYPE raiz_urbana        AS ENUM ('no_agresiva', 'moderada', 'agresiva');
CREATE TYPE emplazamiento      AS ENUM ('aceras_estrechas', 'ejes_viales',
                                        'zonas_verdes', 'corredores');
CREATE TYPE estrato            AS ENUM ('bajo', 'medio', 'alto');
CREATE TYPE longevidad         AS ENUM ('corta_arbusto', 'corta_arbol', 'media', 'larga');
CREATE TYPE eficiencia_hidrica AS ENUM ('baja', 'media', 'alta', 'muy_alta');
CREATE TYPE susceptibilidad    AS ENUM ('baja', 'moderada', 'alta');
CREATE TYPE suelo              AS ENUM ('urbano_compactado', 'franco_estandar',
                                        'profundo_fertil', 'arenoso_pedregoso', 'humedo');
CREATE TYPE dureza_madera      AS ENUM ('c1', 'c2', 'c3', 'c3_estimada', 'c4');
-- De mayor a menor amenaza (Reglamento de Clasificación de Especies, MMA)
CREATE TYPE categoria_mma      AS ENUM ('ex', 'ew', 'cr', 'en', 'vu', 'rara', 'nt', 'lc');
CREATE TYPE apendice_cites     AS ENUM ('i', 'ii', 'iii');
CREATE TYPE tipo_foto          AS ENUM ('porte', 'contexto', 'hoja', 'flor', 'fruto',
                                        'corteza', 'plantula', 'otro');

CREATE TABLE vocabulario (
    campo   text     NOT NULL,   -- 'agua', 'emplazamiento', 'suelo'...
    codigo  text     NOT NULL,   -- el valor del ENUM correspondiente
    corta   text     NOT NULL,   -- etiqueta de interfaz
    larga   text     NOT NULL,   -- definición completa, tal como está en el Excel
    orden   smallint NOT NULL,
    PRIMARY KEY (campo, codigo)
);

COMMENT ON TABLE vocabulario IS
    'Etiquetas legibles de cada escala. `larga` es la definición operativa y '
    '`corta` el texto que se muestra en la interfaz; el Excel de origen solo '
    'guardaba la larga, inservible como texto de UI.';

INSERT INTO vocabulario (campo, codigo, corta, larga, orden) VALUES
 ('habito','arborea','Arbórea','Arbórea',1),
 ('habito','arbustiva','Arbustiva','Arbustiva',2),
 ('origen','nativa','Nativa','Nativa',1),
 ('origen','introducida','Introducida','Introducida',2),
 ('follaje','perenne','Perenne','Perenne',1),
 ('follaje','caduco','Caduco','Caduco',2),

 ('raiz_botanica','fasciculada','Fasciculada','Fasciculada (Fibrosa)',1),
 ('raiz_botanica','oblicua','Oblicua','Oblicua (Extendida)',2),
 ('raiz_botanica','mixta','Mixta','Mixta (Dimorfa)',3),
 ('raiz_botanica','pivotante','Pivotante','Pivotante (Axonomorfa)',4),

 ('raiz_urbana','no_agresiva','No agresiva','No Agresiva / Confinable',1),
 ('raiz_urbana','moderada','Moderada','Moderadamente Agresiva / Profunda',2),
 ('raiz_urbana','agresiva','Agresiva','Agresiva / Superficial',3),

 ('emplazamiento','aceras_estrechas','Aceras estrechas','Aceras Estrechas y Platabandas Confinadas',1),
 ('emplazamiento','ejes_viales','Ejes viales y parques','Ejes Viales Mayores y Parques de Mediano Tamaño',2),
 ('emplazamiento','zonas_verdes','Zonas verdes abiertas','Zonas Verdes Abiertas y Parques Urbanos (Raíz Agresiva)',3),
 ('emplazamiento','corredores','Corredores biológicos','Corredores Biológicos y Conservación Urbana',4),

 ('estrato','bajo','Bajo · <4 m','Estrato Bajo (Arbustos: < 4 metros)',1),
 ('estrato','medio','Medio · 4–15 m','Estrato Medio (Mediano Porte: 4 a 15 metros)',2),
 ('estrato','alto','Alto · >15 m','Estrato Alto (Gran Porte: > 15 metros)',3),

 ('longevidad','corta_arbusto','Corta · <25 años','Corta (Arbustos: < 25 años)',1),
 ('longevidad','corta_arbol','Corta · <30 años','Corta (Árboles de ciclo corto: < 30 años)',2),
 ('longevidad','media','Media · 30–80 años','Media (Ciclo urbano estándar: 30 a 80 años)',3),
 ('longevidad','larga','Larga · >80 años','Larga (Árboles longevos: > 80 años)',4),

 ('agua','muy_alta','Muy alta','Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)',1),
 ('agua','alta','Alta','Eficiencia Hídrica Alta (Bajo Consumo o Mediterránea-Esclerófila)',2),
 ('agua','media','Media','Eficiencia Hídrica Media (Consumo Moderado o Riego Regular)',3),
 ('agua','baja','Baja','Eficiencia Hídrica Baja (Alto Consumo o Hidrófila)',4),

 ('plagas','baja','Resiliente','Baja Susceptibilidad / Resiliente',1),
 ('plagas','moderada','Moderada','Susceptibilidad Moderada',2),
 ('plagas','alta','Alta','Alta Susceptibilidad',3),

 ('suelo','urbano_compactado','Urbano compactado','Suelos Urbanos Antropogénicos / Compactados y Secos',1),
 ('suelo','franco_estandar','Franco estándar','Suelos Francos Estándar / Parques y Áreas Verdes Abiertas',2),
 ('suelo','profundo_fertil','Profundo fértil','Suelos Profundos y Fértiles (Requieren Humedad Retenida / Francos)',3),
 ('suelo','arenoso_pedregoso','Arenoso o pedregoso','Suelos Profundos, Arenosos o Pedregosos (Drenaje Rápido / Secos)',4),
 ('suelo','humedo','Húmedo','Suelos Húmedos / Vegas, Humedales o Zonas de Inundación Temporal',5),

 ('dureza','c1','C1 · muy blanda','C1: Muy Blanda (N < 1,5)',1),
 ('dureza','c2','C2 · blanda','C2: Blanda (1,5 <= N < 3,0)',2),
 ('dureza','c3','C3 · semidura','C3: Semidura (3,0 <= N < 6,0)',3),
 ('dureza','c3_estimada','C3 · semidura (est.)','C3: Semidura (Estimada)',4),
 ('dureza','c4','C4 · dura','C4: Dura a Extra Dura (N >= 6,0)',5),

 ('mma','ex','EX','Extinta (EX)',1),
 ('mma','ew','EW','Extinta en la naturaleza (EW)',2),
 ('mma','cr','CR','En peligro crítico (CR)',3),
 ('mma','en','EN','En Peligro (EN)',4),
 ('mma','vu','VU','Vulnerable (VU)',5),
 ('mma','rara','Rara','Rara',6),
 ('mma','nt','NT','Casi amenazada (NT)',7),
 ('mma','lc','LC','Preocupación menor (LC)',8),

 ('cites','i','Apéndice I','Apéndice I CITES',1),
 ('cites','ii','Apéndice II','Apéndice II CITES',2),
 ('cites','iii','Apéndice III','Apéndice III CITES',3);

-- Traduce un código a su etiqueta completa, en la forma {valor, corta} que
-- consume el sitio. Devuelve NULL si el código es NULL, para que la ficha de
-- un arbusto no invente un porte que no tiene.
CREATE OR REPLACE FUNCTION etiqueta(p_campo text, p_codigo text)
RETURNS jsonb AS $$
    SELECT CASE WHEN p_codigo IS NULL THEN NULL ELSE
        (SELECT jsonb_build_object('codigo', v.codigo, 'valor', v.larga, 'corta', v.corta)
         FROM vocabulario v WHERE v.campo = p_campo AND v.codigo = p_codigo)
    END;
$$ LANGUAGE sql STABLE;


-- ---------------------------------------------------------------------------
-- 2. Territorio
-- ---------------------------------------------------------------------------
-- `orden_norte_sur` no es decorativo: el sitio lo usa para dibujar el mapa y
-- para el gradiente latitudinal. Es un dato, no una preferencia de despliegue.

CREATE TABLE region (
    codigo           char(3)  PRIMARY KEY,
    nombre           text     NOT NULL UNIQUE,
    numero_romano    text     NOT NULL,
    orden_norte_sur  smallint NOT NULL UNIQUE CHECK (orden_norte_sur BETWEEN 1 AND 17),
    insular          boolean  NOT NULL DEFAULT false
);

COMMENT ON TABLE region IS
    'Las 16 regiones de Chile más Rapa Nui, tratada aparte por ser un territorio '
    'insular con flora y clima propios aunque pertenezca a Valparaíso.';

INSERT INTO region (codigo, nombre, numero_romano, orden_norte_sur, insular) VALUES
 ('AYR', 'Arica y Parinacota',                            'XV',   1, false),
 ('TAR', 'Tarapacá',                                      'I',    2, false),
 ('ANT', 'Antofagasta',                                   'II',   3, false),
 ('ATA', 'Atacama',                                       'III',  4, false),
 ('COQ', 'Coquimbo',                                      'IV',   5, false),
 ('VAL', 'Valparaíso',                                    'V',    6, false),
 ('RMS', 'Metropolitana de Santiago',                     'RM',   7, false),
 ('OHI', 'Libertador General Bernardo O''Higgins',        'VI',   8, false),
 ('MAU', 'Maule',                                         'VII',  9, false),
 ('ÑUB', 'Ñuble',                                         'XVI', 10, false),
 ('BIO', 'Biobío',                                        'VIII',11, false),
 ('ARA', 'La Araucanía',                                  'IX',  12, false),
 ('LRI', 'Los Ríos',                                      'XIV', 13, false),
 ('LLA', 'Los Lagos',                                     'X',   14, false),
 ('AYS', 'Aysén del General Carlos Ibáñez del Campo',     'XI',  15, false),
 ('MAG', 'Magallanes y de la Antártica Chilena',          'XII', 16, false),
 ('IPA', 'Rapa Nui',                                      'IPA', 17, true);


-- ---------------------------------------------------------------------------
-- 3. Taxonomía
-- ---------------------------------------------------------------------------
-- Tabla propia en vez de columnas repetidas en `especie`: la jerarquía se
-- consulta sola (¿cuántas Myrtaceae hay?) y evita que el mismo género quede
-- escrito de dos formas distintas.

CREATE TABLE taxon (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reino       text NOT NULL DEFAULT 'Plantae',
    division    text NOT NULL,
    clase       text NOT NULL,
    orden       text NOT NULL,
    familia     text NOT NULL,
    genero      text NOT NULL,
    UNIQUE (division, clase, orden, familia, genero)
);

CREATE INDEX ix_taxon_familia ON taxon (familia);
CREATE INDEX ix_taxon_genero  ON taxon (genero);


-- ---------------------------------------------------------------------------
-- 4. Especie
-- ---------------------------------------------------------------------------

CREATE TABLE especie (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug              text    NOT NULL UNIQUE,
    nombre_cientifico text    NOT NULL UNIQUE,
    autoria           text,                       -- «(Molina) K. Koch»
    taxon_id          integer NOT NULL REFERENCES taxon (id),

    habito            habito         NOT NULL,
    origen            origen         NOT NULL,
    follaje           follaje        NOT NULL,
    raiz_botanica     raiz_botanica  NOT NULL,
    raiz_urbana       raiz_urbana    NOT NULL,

    emplazamiento     emplazamiento  NOT NULL,
    eficiencia_hidrica eficiencia_hidrica NOT NULL,
    susceptibilidad   susceptibilidad NOT NULL,
    suelo             suelo          NOT NULL,

    -- NULL en arbustos: no son evaluaciones, no aplican.
    estrato           estrato,
    longevidad        longevidad,
    dureza            dureza_madera,

    -- Campos declarados y aún vacíos. Existen desde el día uno para que
    -- completarlos sea un UPDATE y no una migración de esquema.
    descripcion             text,
    floracion_meses         smallint[],   -- {9,10,11} = sep–nov
    floracion_color         text,
    fructificacion_meses    smallint[],
    tolerancia_helada       boolean,
    tolerancia_viento       boolean,
    tolerancia_salinidad    boolean,
    tolerancia_contaminacion boolean,
    tolerancia_poda         boolean,
    ancho_minimo_vereda_m   numeric(3,1) CHECK (ancho_minimo_vereda_m > 0),
    distancia_plantacion_m  numeric(3,1) CHECK (distancia_plantacion_m > 0),
    alergenicidad           smallint CHECK (alergenicidad BETWEEN 0 AND 3),
    toxicidad               text,
    disponibilidad_vivero   boolean,

    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),

    -- Los tres campos de porte aplican si y solo si la especie es arbórea.
    CONSTRAINT porte_solo_arboreas CHECK (
        (habito = 'arborea')
        OR (estrato IS NULL AND longevidad IS NULL AND dureza IS NULL)
    ),
    CONSTRAINT floracion_valida CHECK (
        floracion_meses IS NULL
        OR (floracion_meses <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])
    )
);

COMMENT ON COLUMN especie.alergenicidad IS
    '0 nula · 1 baja · 2 media · 3 alta. Relevante para arbolado viario en '
    'ciudades con alta prevalencia de polinosis.';

CREATE INDEX ix_especie_taxon   ON especie (taxon_id);
CREATE INDEX ix_especie_habito  ON especie (habito, origen);
CREATE INDEX ix_especie_empl    ON especie (emplazamiento);
CREATE INDEX ix_especie_agua    ON especie (eficiencia_hidrica);

-- Búsqueda por nombre científico o común, tolerante a acentos y a errores
-- de tipeo. El índice trigram sirve tanto a ILIKE como a similitud.
CREATE INDEX ix_especie_busqueda ON especie
    USING gin (public.sin_acentos(nombre_cientifico) gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- 5. Nombres comunes
-- ---------------------------------------------------------------------------
-- En el Excel viven concatenados en una celda («Palqui. Parqui. Hediondilla.»),
-- lo que impide buscarlos. Aquí cada nombre es una fila.

CREATE TABLE nombre_comun (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especie_id integer NOT NULL REFERENCES especie (id) ON DELETE CASCADE,
    nombre     text    NOT NULL,
    orden      smallint NOT NULL DEFAULT 1,   -- 1 = nombre principal
    -- Marca los 191 casos «<Género> común.» del Excel, que son relleno y no
    -- nombres vernáculos reales. Permite ocultarlos y usarlos como lista de trabajo.
    es_provisional boolean NOT NULL DEFAULT false,
    UNIQUE (especie_id, nombre)
);

CREATE INDEX ix_nombre_comun_busqueda ON nombre_comun
    USING gin (public.sin_acentos(nombre) gin_trgm_ops);


-- ---------------------------------------------------------------------------
-- 6. Distribución regional
-- ---------------------------------------------------------------------------

CREATE TABLE especie_region (
    especie_id integer NOT NULL REFERENCES especie (id) ON DELETE CASCADE,
    region     char(3) NOT NULL REFERENCES region (codigo),
    -- Distingue el área de distribución natural del uso urbano acreditado.
    -- El Excel no separa ambas cosas; el cruce con el GPS de las fotografías
    -- mostró que hacen falta (chañar y liquidámbar fotografiados en Santiago
    -- sin tener la región marcada).
    natural_    boolean NOT NULL DEFAULT true,
    cultivada   boolean NOT NULL DEFAULT false,
    fuente      text,
    PRIMARY KEY (especie_id, region)
);

CREATE INDEX ix_especie_region_region ON especie_region (region);


-- ---------------------------------------------------------------------------
-- 7. Conservación
-- ---------------------------------------------------------------------------
-- Tabla aparte porque solo el 9,6 % de las especies tiene categoría y porque
-- una misma especie puede acumular varias protecciones (MMA + CITES +
-- Monumento Natural), como ocurre con la araucaria y el alerce.

CREATE TABLE conservacion (
    especie_id      integer PRIMARY KEY REFERENCES especie (id) ON DELETE CASCADE,
    categoria_mma   categoria_mma,
    decreto_mma     text,
    cites           apendice_cites,
    monumento_natural text,          -- «Decreto 43 1990»
    observaciones   text,
    CHECK (categoria_mma IS NOT NULL OR cites IS NOT NULL
           OR monumento_natural IS NOT NULL)
);

CREATE INDEX ix_conservacion_mma ON conservacion (categoria_mma);

COMMENT ON COLUMN conservacion.categoria_mma IS
    'El ENUM está ordenado de mayor a menor amenaza, así que «amenazada» se '
    'expresa como categoria_mma <= ''vu'' sin necesidad de enumerar categorías.';


-- ---------------------------------------------------------------------------
-- 8. Fototeca
-- ---------------------------------------------------------------------------
-- El binario NO va en la base. La tabla guarda la ruta en el almacenamiento
-- de objetos y los derivados web; el original permanece en el archivo
-- fotográfico. `tipo` es lo que hoy falta por completo en los 349 archivos y
-- lo que permite que la ficha elija bien su imagen principal.

CREATE TABLE fotografia (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especie_id    integer NOT NULL REFERENCES especie (id) ON DELETE CASCADE,
    archivo       text    NOT NULL,
    ruta_original text    NOT NULL,
    tipo          tipo_foto,
    es_principal  boolean NOT NULL DEFAULT false,
    orden         smallint NOT NULL DEFAULT 1,

    ancho_px      integer CHECK (ancho_px > 0),
    alto_px       integer CHECK (alto_px > 0),
    bytes         bigint  CHECK (bytes > 0),

    -- EXIF. `capturada_en` y las coordenadas ya sirvieron para detectar
    -- presencias regionales ausentes del catálogo.
    capturada_en  date,
    camara        text,
    latitud       numeric(9,6)  CHECK (latitud  BETWEEN -90  AND 90),
    longitud      numeric(9,6)  CHECK (longitud BETWEEN -180 AND 180),
    altitud_m     integer,
    region        char(3) REFERENCES region (codigo),

    autor         text,
    licencia      text,
    UNIQUE (especie_id, archivo)
);

-- Una sola fotografía principal por especie.
CREATE UNIQUE INDEX ux_foto_principal ON fotografia (especie_id)
    WHERE es_principal;

CREATE INDEX ix_foto_especie ON fotografia (especie_id, orden);
CREATE INDEX ix_foto_tipo    ON fotografia (tipo);


-- ---------------------------------------------------------------------------
-- 9. Trazabilidad
-- ---------------------------------------------------------------------------
-- El vacío más serio del Excel: ninguna clasificación indica de dónde sale.
-- Con 257 durezas de madera estimadas, saber qué está respaldado y qué no
-- deja de ser opcional.

CREATE TABLE fuente (
    id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cita      text NOT NULL,
    url       text,
    tipo      text,        -- 'publicación' | 'norma' | 'terreno' | 'estimación'
    anio      smallint
);

CREATE TABLE especie_fuente (
    especie_id    integer NOT NULL REFERENCES especie (id) ON DELETE CASCADE,
    fuente_id     integer NOT NULL REFERENCES fuente (id),
    campo         text    NOT NULL,   -- 'dureza', 'estrato', 'distribución'…
    verificado_en date,
    verificado_por text,
    PRIMARY KEY (especie_id, fuente_id, campo)
);

CREATE TABLE especie_historial (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especie_id integer NOT NULL REFERENCES especie (id) ON DELETE CASCADE,
    campo      text NOT NULL,
    valor_anterior text,
    valor_nuevo    text,
    usuario    text NOT NULL,
    cambiado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_historial_especie ON especie_historial (especie_id, cambiado_en DESC);

CREATE OR REPLACE FUNCTION toca_actualizado() RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_especie_actualizado
    BEFORE UPDATE ON especie
    FOR EACH ROW EXECUTE FUNCTION toca_actualizado();


-- ---------------------------------------------------------------------------
-- 10. Vistas de consulta
-- ---------------------------------------------------------------------------

-- Completitud por especie. Reproduce el cálculo de `build_data.py`: los tres
-- campos de porte se excluyen del denominador en arbustos para no penalizar
-- a un arbusto por no tener dureza de madera.
CREATE VIEW v_completitud AS
SELECT e.id AS especie_id,
       e.slug,
       llenos,
       total,
       round(100.0 * llenos / total) AS pct
FROM   especie e
CROSS  JOIN LATERAL (
    SELECT (e.habito = 'arborea')::int * 3 + 24 AS total,
           ( 12                                            -- campos siempre presentes
           -- Un nombre común de relleno («<Género> común») no cuenta como dato.
           + (EXISTS (SELECT 1 FROM nombre_comun n
                      WHERE n.especie_id = e.id AND NOT n.es_provisional))::int
           + (e.habito = 'arborea')::int * 3
           + (e.descripcion            IS NOT NULL)::int
           + (e.floracion_meses        IS NOT NULL)::int
           + (e.fructificacion_meses   IS NOT NULL)::int
           + (e.tolerancia_helada      IS NOT NULL)::int
           + (e.ancho_minimo_vereda_m  IS NOT NULL)::int
           + (e.distancia_plantacion_m IS NOT NULL)::int
           + (e.alergenicidad          IS NOT NULL)::int
           + (e.toxicidad              IS NOT NULL)::int
           + (e.disponibilidad_vivero  IS NOT NULL)::int
           + (EXISTS (SELECT 1 FROM fotografia     f WHERE f.especie_id = e.id))::int
           + (EXISTS (SELECT 1 FROM especie_fuente s WHERE s.especie_id = e.id))::int
           ) AS llenos
) c;

-- Contrato de salida. Debe coincidir exactamente con `especies.json`, que es
-- lo que hoy consume el sitio: mientras esta vista respete la forma, migrar de
-- archivo estático a API no toca una línea del frontend.
CREATE VIEW v_especie_json AS
SELECT e.slug AS id,
       jsonb_strip_nulls(jsonb_build_object(
         'id',          e.slug,
         'cientifico',  e.nombre_cientifico,
         'comunes',     COALESCE((SELECT jsonb_agg(n.nombre ORDER BY n.orden)
                                  FROM nombre_comun n
                                  WHERE n.especie_id = e.id AND NOT n.es_provisional), '[]'),
         'nombre_provisional', NOT EXISTS (SELECT 1 FROM nombre_comun n
                                           WHERE n.especie_id = e.id AND NOT n.es_provisional),
         'taxonomia',   jsonb_build_object('reino', t.reino, 'division', t.division,
                                           'clase', t.clase, 'orden', t.orden,
                                           'familia', t.familia, 'genero', t.genero),
         'habito',        (SELECT larga FROM vocabulario
                           WHERE campo = 'habito'  AND codigo = e.habito::text),
         'origen',        (SELECT larga FROM vocabulario
                           WHERE campo = 'origen'  AND codigo = e.origen::text),
         'follaje',       (SELECT larga FROM vocabulario
                           WHERE campo = 'follaje' AND codigo = e.follaje::text),
         'raiz_botanica', etiqueta('raiz_botanica', e.raiz_botanica::text),
         'raiz_urbana',   etiqueta('raiz_urbana',   e.raiz_urbana::text),
         'emplazamiento', etiqueta('emplazamiento', e.emplazamiento::text),
         'altura',        etiqueta('estrato',       e.estrato::text),
         'longevidad',    etiqueta('longevidad',    e.longevidad::text),
         'dureza',        etiqueta('dureza',        e.dureza::text),
         'agua',          etiqueta('agua',          e.eficiencia_hidrica::text),
         'plagas',        etiqueta('plagas',        e.susceptibilidad::text),
         'suelo',         etiqueta('suelo',         e.suelo::text),
         'conservacion',  jsonb_build_object(
                            'mma',   (SELECT larga FROM vocabulario
                                      WHERE campo = 'mma'   AND codigo = c.categoria_mma::text),
                            'cites', (SELECT larga FROM vocabulario
                                      WHERE campo = 'cites' AND codigo = c.cites::text),
                            'otras', c.monumento_natural,
                            'amenazada', COALESCE(c.categoria_mma <= 'vu', false),
                            'protegida', c.especie_id IS NOT NULL),
         'regiones',    COALESCE((SELECT jsonb_agg(r.codigo ORDER BY r.orden_norte_sur)
                                  FROM especie_region er
                                  JOIN region r ON r.codigo = er.region
                                  WHERE er.especie_id = e.id), '[]'),
         'fotos',       COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                    'archivo', f.archivo, 'tipo', f.tipo,
                                    'hero', f.es_principal) ORDER BY f.orden)
                                  FROM fotografia f WHERE f.especie_id = e.id), '[]'),
         'completitud', jsonb_build_object('pct', v.pct, 'llenos', v.llenos,
                                           'total', v.total)
       )) AS ficha
FROM   especie e
JOIN   taxon t             ON t.id = e.taxon_id
LEFT   JOIN conservacion c ON c.especie_id = e.id
JOIN   v_completitud v     ON v.especie_id = e.id;

-- Paleta de especies para una región y un tipo de emplazamiento: es la
-- consulta que resuelve el 90 % de los usos reales del catálogo.
CREATE OR REPLACE FUNCTION paleta(
    p_region char(3),
    p_emplazamiento emplazamiento DEFAULT NULL,
    p_solo_nativas boolean DEFAULT false
) RETURNS SETOF especie AS $$
    SELECT e.*
    FROM   especie e
    JOIN   especie_region er ON er.especie_id = e.id AND er.region = p_region
    WHERE  (p_emplazamiento IS NULL OR e.emplazamiento = p_emplazamiento)
      AND  (NOT p_solo_nativas OR e.origen = 'nativa')
    ORDER  BY e.nombre_cientifico;
$$ LANGUAGE sql STABLE;

COMMIT;

-- ===========================================================================
-- Verificación tras la carga — los valores esperados vienen del Excel del
-- 24-08-2026 y sirven para confirmar que la migración no perdió filas.
-- ===========================================================================
--   SELECT count(*) FROM especie;                              -- 1016
--   SELECT count(*) FROM especie WHERE origen = 'nativa';      --  565
--   SELECT count(*) FROM especie WHERE habito = 'arborea';     --  413
--   SELECT count(*) FROM conservacion;                         --   98
--   SELECT count(*) FROM especie_region;                       -- 5452
--   SELECT round(avg(pct), 1) FROM v_completitud;              -- ~56
