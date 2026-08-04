# Fruktela — landing

Página estática de una sola vista para Fruktela, pensada para publicarse en
GitHub Pages con dominio propio.

Sin framework, sin paso de build: lo que está en el repositorio es lo que se
sirve. Los assets ya vienen optimizados y se regeneran con los scripts de
`tools/` solo cuando cambian los originales.

## Estructura

```
index.html              Toda la página
CNAME                   Dominio propio de GitHub Pages
.nojekyll               Evita que Pages procese el sitio con Jekyll
robots.txt              Indexación + referencia al sitemap
sitemap.xml             Una sola URL
site.webmanifest        Nombre, colores e iconos de instalación

assets/
  css/estilos.css       Estilos (mobile first)
  js/main.js            Menú de celular, botón flotante y atribución (?ref=)
  fonts/                Baloo 2 y Plus Jakarta Sans (woff2, variables)
  img/                  Capturas en AVIF/WebP + PNG de respaldo, y el logo
  icons/                favicon, iconos de instalación y la tarjeta de compartir

tools/
  build-assets.py       Genera assets/img y assets/icons

  og-template.html      Plantilla de la tarjeta de compartir
  build-og.sh           Captura la plantilla a assets/icons/og-image.png
```

## Ver el sitio en local

Las rutas son absolutas (`/assets/...`) y las fuentes web no cargan desde
`file://`, así que hay que servirlo por HTTP:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Publicar en GitHub Pages

1. **Settings → Pages → Source: Deploy from a branch**, rama `main`, carpeta
   `/ (root)`.
2. **Settings → Pages → Custom domain:** `fruktela.com`. El archivo `CNAME` ya
   está en el repositorio, así que GitHub lo toma solo.
3. En el DNS del dominio, los cuatro `A` del ápice, los cuatro `AAAA` y el
   `CNAME` de `www`:

   | Tipo    | Nombre | Valor                |
   | ------- | ------ | -------------------- |
   | `A`     | `@`    | `185.199.108.153`    |
   | `A`     | `@`    | `185.199.109.153`    |
   | `A`     | `@`    | `185.199.110.153`    |
   | `A`     | `@`    | `185.199.111.153`    |
   | `AAAA`  | `@`    | `2606:50c0:8000::153`|
   | `AAAA`  | `@`    | `2606:50c0:8001::153`|
   | `AAAA`  | `@`    | `2606:50c0:8002::153`|
   | `AAAA`  | `@`    | `2606:50c0:8003::153`|
   | `CNAME` | `www`  | `crisdpa.github.io.` |

   Antes hay que borrar cualquier `A`, `AAAA`, `ALIAS` o `CNAME` que ya exista
   en `@` o en `www` (los de estacionamiento del registrador), o el dominio
   seguirá apuntando a donde estaba.

4. Cuando el DNS propague, activa **Enforce HTTPS** en la misma pantalla.

   ```bash
   dig +short fruktela.com          # debe devolver las cuatro IP 185.199.x
   dig +short www.fruktela.com      # debe devolver crisdpa.github.io
   ```

### Si cambias de dominio

El dominio aparece en cuatro lugares. Hay que actualizarlos todos:

- `CNAME`
- `index.html` → `canonical`, `og:url`, `og:image`, `twitter:image`, y la
  propiedad `url` del bloque JSON-LD
- `robots.txt` → línea `Sitemap:`
- `sitemap.xml` → `<loc>`

### Si lo publicas en una subcarpeta

Las rutas absolutas asumen que el sitio vive en la raíz del dominio. Si en
algún momento se sirve desde `usuario.github.io/repo/`, hay que volverlas
relativas (`assets/...` en vez de `/assets/...`).

## Regenerar assets

### Imágenes e iconos

Los PNG de origen **no están versionados**: pesan casi 1 MB, GitHub Pages los
serviría sin que nadie los pida y lo que la página usa son los derivados que ya
están en `assets/img/`. Solo hacen falta para volver a generarlos.

Para reponerlos en `tools/source/`, o los exportas de nuevo desde el diseño, o
los sacas del historial, donde siguen estando:

```bash
git checkout a473c88 -- tools/source/
```

Se esperan siete archivos: `pagina-pedidos.png`, `paso-1-telefono.png`,
`paso-2-catalogo.png`, `paso-3-resumen.png`, `app-pedidos.png`,
`logo-blanco.png` e `icono-app.png`. El script avisa si falta alguno.

Después, con Pillow, `cwebp` y `avifenc`:

```bash
brew install webp libavif
python3 -m pip install Pillow
python3 tools/build-assets.py
```

Genera, para cada captura, AVIF y WebP en 448w y 896w más un PNG de respaldo,
y reconstruye el juego de iconos a partir de `tools/source/icono-app.png`.

Cuando termines, **vuelve a quitar `tools/source/`** antes de commitear.

### Tarjeta de compartir (Open Graph)

Se edita como HTML en `tools/og-template.html` y se captura a 1200×630:

```bash
./tools/build-og.sh
```

Necesita Chrome o Chromium; si no lo encuentra, pásale la ruta como argumento.

## Atribución desde la app (`?ref=`)

Las páginas públicas de pedidos de la app llevan un footer de captación que
enlaza a esta landing. Ese enlace es el contrato entre los dos repositorios:

| Parámetro      | Lo pone la app                        | Lo usa la landing                       |
| -------------- | ------------------------------------- | --------------------------------------- |
| `ref`          | slug del negocio; se omite si va vacío | atribución + personalización del copy   |
| `utm_source`   | `order_page`                          | segmentación en GA4                     |
| `utm_medium`   | `footer`                              | segmentación en GA4                     |
| `utm_campaign` | `viral_footer`                        | segmentación en GA4                     |

Con un `ref` válido, `main.js`:

1. Lo guarda en `sessionStorage` (`fruktela.ref`), para que sobreviva a las
   recargas y a la navegación por anclas.
2. Cambia el `?text=` de los seis enlaces `wa.me` por
   `Hola, vi la página de {Negocio} y quiero mi prueba gratis`. Así, al llegar
   el chat se sabe qué cliente generó el prospecto sin montar un sistema de
   referidos.
3. Revela la barra de bienvenida (`#bienvenida`) arriba del hero.

**El nombre del negocio se humaniza a partir del slug** (`frutas-don-pepe` →
`Frutas Don Pepe`). No hay endpoint que traduzca slug a nombre; cuando exista,
el punto a cambiar es `humanizar()` en `main.js`. Mientras tanto, un slug sin
letras (`12345`) se sigue atribuyendo en GA4 pero deja el copy genérico: no da
un nombre presentable.

Todo lo demás degrada al comportamiento de siempre. Se descarta el `ref` si
falta, viene vacío, no parece un slug (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) o es
un accidente de programación (`undefined`, `null`, `NaN`…). Sin `ref` válido la
landing se ve y se comporta exactamente como antes.

### Eventos

GA4 (`G-HVF9C025X3`) recibe dos eventos propios, ambos con el `ref` vigente:

- `landing_arrival` — al cargar con `ref` o `utm_source` en la URL. Lleva
  también los tres `utm_*`. Solo cuenta la llegada real: las recargas y las
  anclas reusan el `ref` guardado sin volver a dispararlo.
- `landing_whatsapp_click` — al tocar cualquier enlace `wa.me`.

Los valores ausentes van como `(none)` para poder segmentar por su falta. Con el
embudo completo, `footer_cta_view → footer_cta_click → landing_arrival →
landing_whatsapp_click`, cada caída apunta a un problema distinto: el footer no
se ve, el copy no convence, o la landing no cierra.

La medición es accesoria: si `gtag` no existe (bloqueador, snippet que no cargó)
o lanza, las llamadas están envueltas y el enlace navega igual.

## Decisiones que conviene conocer

- **Mobile first.** La base del CSS es el celular y los `@media` suben a 641 px
  y 961 px. Ojo con `.wrap`: usa `padding-inline` y no el atajo `padding`,
  porque `.nav`, `.hero` y `.menu-movil` también son `.wrap` y definen su
  propio padding vertical.
- **GA4 es la única conexión a un tercero.** Se cargó por el embudo de
  captación, que no se puede medir de otra forma en un sitio estático. Va
  `async` y nada de la página depende de que responda.
- **Fuentes propias, no Google Fonts.** Evita otra conexión a un tercero y el
  parpadeo asociado. Ambas familias son variables, así que un archivo por rango
  unicode cubre todos los pesos: cuatro `@font-face` en total. Solo se incluyen
  `latin` y `latin-ext`.
- **Imágenes.** `<picture>` con AVIF y WebP en dos anchos; el PNG del `<img>`
  es solo para navegadores sin WebP. La del hero se precarga y no es diferida,
  porque es el LCP; las demás sí.
- **El menú de celular funciona sin JavaScript**: se queda desplegado y en
  flujo. Con JavaScript se convierte en un panel que se sobrepone al hero.
