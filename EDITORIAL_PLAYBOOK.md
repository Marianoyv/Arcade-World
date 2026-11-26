# Arcade World Newsroom

Este documento define una fórmula repetible para publicar noticias del mundo del gaming sin convertir el sitio en un agregador de titulares. La meta es que cada nota sea verificable, útil para jugadores y mejor que un simple resumen de otras páginas.

## La fórmula JUEGO

### J — Juicio editorial

Antes de escribir, responder:

- ¿Esto cambia algo para jugadores de PC, consola, móvil, arcade, retro o emulación?
- ¿Encaja con las áreas que Arcade World puede explicar con criterio?
- ¿Podemos aportar contexto, una prueba, una comparación o una conclusión propia?

Si las tres respuestas son “no”, no se publica aunque el tema sea tendencia.

### U — Última información confirmada

- Abrir la fuente original: estudio, publisher, plataforma, organismo, informe o desarrollador.
- Conseguir una segunda fuente independiente cuando la nota sea de tipo `news` o `analysis`.
- Anotar nombres, fechas, plataformas, regiones y cualquier limitación.
- Separar claramente hechos confirmados, declaraciones, rumores e interpretación.
- No copiar párrafos ni publicar una reescritura de una sola fuente.

### E — Explicación

La apertura debe responder en dos o tres frases: qué pasó, quién lo confirmó y cuándo. Después se agrega el contexto que un lector necesitaría para entender la noticia sin hacer otra búsqueda.

Estructura recomendada:

1. `What happened`: hechos confirmados.
2. `Why it matters`: contexto y alcance.
3. `The Arcade World take`: análisis original.
4. `What happens next`: próximos hitos y preguntas abiertas.

No existe una cantidad mágica de palabras. La nota termina cuando responde bien la pregunta del lector.

### G — Ganancia para el jugador

Cada artículo debe incluir:

- un `quickTake` sin exageraciones;
- un `whyCare` con la consecuencia concreta;
- un `playerMove` que diga qué conviene hacer, mirar o evitar;
- enlaces a fuentes y a otra página útil de Arcade World.

El título debe describir la noticia. No usar falsa urgencia, promesas no confirmadas ni fechas inventadas.

### O — Optimización

Revisar el artículo a las 48 horas, 7 días y 28 días.

| Señal | Lectura | Próxima acción |
| --- | --- | --- |
| Muchas impresiones y poco CTR | El tema interesa, pero título o descripción no convencen | Aclarar el beneficio y quitar palabras genéricas |
| Buen CTR y poca interacción | La apertura no cumple la promesa | Reescribir el lead y adelantar el dato principal |
| Lectura útil y pocos clics internos | Falta un siguiente paso claro | Mejorar relacionados y CTA |
| Fuentes reciben clics | El lector valora la documentación | Agregar más contexto original alrededor de esas fuentes |
| Una categoría gana repetidamente | Hay demanda temática | Publicar un grupo de tres notas complementarias |
| Una nota queda desactualizada | Cambiaron hechos relevantes | Corregir el texto y `modifiedAt`; no cambiar la fecha sin una actualización real |

## Mezcla editorial inicial

- 50% noticias confirmadas y relevantes para jugadores.
- 30% explicadores que respondan las dudas generadas por esas noticias.
- 20% análisis, comparaciones, retro, preservación y comunidad.

Cadencia inicial: dos noticias y un explicador por semana. Es preferible publicar tres notas sólidas que diez resúmenes intercambiables.

## Flujo de publicación

### 1. Crear el borrador

```powershell
npm run news:new -- "Clear factual headline" "Industry"
```

El comando crea un archivo dentro de `content/articles/`. Si se necesita un slug personalizado, se puede ejecutar el script directamente con `node scripts/new-article.js --title "Headline" --category "Industry" --slug "custom-slug"`.

### 2. Completar la ficha

- Mantener `status` como `draft` mientras se investiga.
- Completar todos los campos `TODO`.
- Añadir al menos dos fuentes HTTPS para noticias y análisis; una debería ser primaria.
- Guardar una imagen relevante en `img/blog/`, idealmente 1200 × 675 o mayor.
- Escribir un texto alternativo que describa la imagen, no el título del artículo.
- Confirmar crédito y permiso de uso de la imagen.
- Cambiar `status` a `published` solo cuando esté revisado.

### 3. Validar y generar

```powershell
npm run content:build
```

Este proceso bloquea publicaciones con campos faltantes, fechas inválidas, slugs duplicados, imágenes inexistentes o fuentes insuficientes. Después genera:

- la página del artículo;
- el índice utilizado por el blog;
- datos estructurados `NewsArticle` o `BlogPosting`;
- fechas de publicación y actualización;
- artículos relacionados;
- `sitemap.xml`;
- `news-sitemap.xml` con noticias de las últimas 48 horas;
- `feed.xml` para lectores RSS.

### 4. Revisar antes de producción

```powershell
npm run serve
```

Abrir `http://localhost:8000/blog.html` y comprobar escritorio y móvil:

- título, imagen y crédito;
- fecha, autor y tiempo de lectura;
- enlaces y fuentes;
- ortografía y claridad;
- que “hecho”, “rumor” y “opinión” no estén mezclados.

### 5. Publicar

Crear primero un canal de vista previa de Firebase. Cuando la revisión esté aprobada, desplegar Hosting y comprobar:

- la URL pública;
- el informe de tiempo real de GA4;
- la inspección de URL y los sitemaps en Search Console.

## Tablero editorial semanal

Mantener estas columnas, incluso si al principio se usa una hoja simple:

| Estado | Tema | Tipo | Fuente primaria | Segunda fuente | Ángulo Arcade World | Publicación | Revisión 7d |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Idea / Research / Draft / Review / Published / Update | Tema concreto | News / Guide / Analysis / Review | URL | URL | Valor original | Fecha y hora | Resultado y cambio |

## Reglas que no se negocian

- No publicar rumores como hechos.
- No ocultar autor, fecha, correcciones, patrocinio o conflictos de interés.
- No usar imágenes sin origen o permiso claro.
- No cambiar fechas únicamente para aparentar frescura.
- No producir artículos en masa solo para cubrir palabras clave.
- No eliminar una URL publicada para actualizarla: conservar el slug y modificar `modifiedAt`.
- Corregir errores de forma visible cuando cambien el sentido de la noticia.

## Métricas de la fórmula

Analytics ya registra aperturas desde el blog. El sistema nuevo también registra:

- `blog_search`;
- `blog_category_select`;
- `blog_load_more`;
- `article_source_open`;
- `article_related_open`;
- `article_cta_click`.

Combinar estas señales con impresiones, CTR y consultas de Search Console. No elegir temas solo por visitas: también importan recurrencia, confianza, utilidad y relación con el catálogo de Arcade World.
