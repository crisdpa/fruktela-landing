#!/usr/bin/env python3
"""Genera los assets optimizados de la landing a partir de tools/source/.

Salidas:
  assets/img/     capturas en AVIF + WebP (448w y 896w) y PNG de respaldo
  assets/img/     logo blanco en WebP + PNG
  assets/icons/   favicon.ico, iconos PWA, apple-touch-icon y og-image base

Requisitos: Pillow, cwebp y avifenc en el PATH.
Uso: python3 tools/build-assets.py
"""

from __future__ import annotations

import io
import shutil
import struct
import subprocess
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "tools" / "source"
IMG = RAIZ / "assets" / "img"
ICONS = RAIZ / "assets" / "icons"

NARANJA = (232, 118, 30, 255)  # --naranja
CREMA = (255, 247, 239, 255)  # --crema

# El <img> se pinta como mucho a 300 px CSS, así que 896w cubre pantallas 3x.
ANCHOS = (448, 896)
CAPTURAS = (
    "pagina-pedidos",
    "paso-1-telefono",
    "paso-2-catalogo",
    "paso-3-resumen",
    "app-pedidos",
)


def ejecutar(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"falló {cmd[0]}: {proc.stderr.strip() or proc.stdout.strip()}")


def png_optimizado(im: Image.Image, destino: Path) -> None:
    """PNG de respaldo. Las capturas son UI plana: la paleta de 256 colores es
    visualmente indistinguible y pesa ~3x menos."""
    plano = im.convert("RGB") if im.mode == "RGBA" and destino.name.endswith(".png") else im
    paleta = plano.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
    paleta.save(destino, "PNG", optimize=True)


def capturas() -> None:
    for nombre in CAPTURAS:
        origen = Image.open(ORIGEN / f"{nombre}.png").convert("RGB")
        for ancho in ANCHOS:
            alto = round(origen.height * ancho / origen.width)
            escalada = origen.resize((ancho, alto), Image.Resampling.LANCZOS)

            temporal = IMG / f".{nombre}-{ancho}.tmp.png"
            escalada.save(temporal, "PNG")
            ejecutar(["cwebp", "-quiet", "-q", "78", "-m", "6",
                      str(temporal), "-o", str(IMG / f"{nombre}-{ancho}.webp")])
            ejecutar(["avifenc", "--speed", "4", "-q", "62", "--yuv", "420",
                      str(temporal), str(IMG / f"{nombre}-{ancho}.avif")])
            temporal.unlink()

        # Un solo PNG de respaldo: solo lo piden navegadores sin WebP (<3%).
        respaldo = origen.resize(
            (ANCHOS[0], round(origen.height * ANCHOS[0] / origen.width)),
            Image.Resampling.LANCZOS,
        )
        png_optimizado(respaldo, IMG / f"{nombre}-{ANCHOS[0]}.png")
        print(f"  {nombre}: {origen.width}x{origen.height} -> {', '.join(str(a) for a in ANCHOS)}w")


def logo() -> None:
    """El logo es blanco sobre transparente; se usa a 26, 32 y 56 px CSS,
    así que 168 px cubre hasta 3x del tamaño mayor."""
    origen = Image.open(ORIGEN / "logo-blanco.png").convert("RGBA")
    escalado = origen.resize((168, 168), Image.Resampling.LANCZOS)
    temporal = IMG / ".logo.tmp.png"
    escalado.save(temporal, "PNG")
    ejecutar(["cwebp", "-quiet", "-q", "90", "-m", "6", "-alpha_q", "100",
              str(temporal), "-o", str(IMG / "logo-fruktela.webp")])
    # Todo píxel visible es blanco puro, así que gris+alfa es idéntico
    # y guarda dos canales frente a RGBA.
    alfa = escalado.getchannel("A")
    blanco = Image.new("L", escalado.size, 255)
    Image.merge("LA", (blanco, alfa)).save(IMG / "logo-fruktela.png", "PNG", optimize=True)
    temporal.unlink()
    print("  logo-fruktela: 168x168 (webp + png)")


def silueta_y_arte(origen: Image.Image) -> tuple[tuple[int, int, int, int], Image.Image]:
    """El icono original es un cuadrado naranja con el dibujo *calado* (alfa 0) y
    bordes sucios. Separa la silueta exterior del calado interior para poder
    redibujar el icono limpio."""
    ancho, alto = origen.size
    px = origen.load()
    fuera = bytearray(ancho * alto)
    cola: deque[tuple[int, int]] = deque()

    def sembrar(x: int, y: int) -> None:
        if px[x, y][3] < 200 and not fuera[y * ancho + x]:
            fuera[y * ancho + x] = 1
            cola.append((x, y))

    for x in range(ancho):
        sembrar(x, 0)
        sembrar(x, alto - 1)
    for y in range(alto):
        sembrar(0, y)
        sembrar(ancho - 1, y)
    while cola:
        x, y = cola.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < ancho and 0 <= ny < alto:
                sembrar(nx, ny)

    # El dibujo es el hueco interior: su opacidad es el alfa invertido.
    arte = Image.new("L", (ancho, alto), 0)
    apx = arte.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(alto):
        for x in range(ancho):
            if fuera[y * ancho + x]:
                continue
            xs.append(x)
            ys.append(y)
            apx[x, y] = 255 - px[x, y][3]
    caja = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    return caja, arte


def _reenfocar(mascara: Image.Image, lado: int) -> Image.Image:
    """Amplía una máscara de ~300 px sin que el borde quede lavado.

    Interpola suave (el bicúbico no genera escalones) y luego endereza la rampa
    alfa con una curva de contraste, dejando un borde antialiaseado de ~1 px a
    la resolución destino."""
    ampliada = mascara.resize((lado, lado), Image.Resampling.BICUBIC)
    # Media geométrica entre "no tocar" y "recuperar el borde original": a
    # contraste pleno reaparecerían los escalones del PNG de origen.
    escala = max(1.0, lado / mascara.width) ** 0.5
    return ampliada.point(
        [max(0, min(255, round((a - 128) * escala + 128))) for a in range(256)]
    )


def icono_base(lado: int = 1024) -> Image.Image:
    """Redibuja el icono de marca: cuadrado naranja redondeado + dibujo blanco."""
    origen = Image.open(ORIGEN / "icono-app.png").convert("RGBA")
    caja, arte = silueta_y_arte(origen)

    # Recorte cuadrado centrado sobre la silueta, descartando el borde sucio.
    x0, y0, x1, y1 = caja
    margen = 3
    x0, y0, x1, y1 = x0 + margen, y0 + margen, x1 - margen, y1 - margen
    lado_origen = min(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    mitad = lado_origen // 2
    arte = _reenfocar(arte.crop((cx - mitad, cy - mitad, cx + mitad, cy + mitad)), lado)

    supermuestreo = 4
    mascara = Image.new("L", (lado * supermuestreo, lado * supermuestreo), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        (0, 0, lado * supermuestreo - 1, lado * supermuestreo - 1),
        radius=int(lado * supermuestreo * 0.225),
        fill=255,
    )
    mascara = mascara.resize((lado, lado), Image.Resampling.LANCZOS)

    icono = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    icono.paste(Image.new("RGBA", (lado, lado), NARANJA), (0, 0), mascara)
    icono.paste(Image.new("RGBA", (lado, lado), CREMA), (0, 0), arte)
    icono.putalpha(mascara)
    return icono


def escribir_ico(imagenes: list[Image.Image], destino: Path) -> None:
    """ICO con payload PNG (soportado desde IE11); Pillow recorta a 256 px."""
    cabecera = struct.pack("<HHH", 0, 1, len(imagenes))
    entradas = b""
    cuerpos = b""
    desplazamiento = 6 + 16 * len(imagenes)
    for im in imagenes:
        buffer = io.BytesIO()
        im.save(buffer, "PNG", optimize=True)
        datos = buffer.getvalue()
        lado = 0 if im.width >= 256 else im.width
        entradas += struct.pack("<BBBBHHII", lado, lado, 0, 0, 1, 32, len(datos), desplazamiento)
        cuerpos += datos
        desplazamiento += len(datos)
    destino.write_bytes(cabecera + entradas + cuerpos)


def iconos() -> None:
    base = icono_base(1024)

    def a(lado: int) -> Image.Image:
        return base.resize((lado, lado), Image.Resampling.LANCZOS)

    a(512).save(ICONS / "icon-512.png", "PNG", optimize=True)
    a(192).save(ICONS / "icon-192.png", "PNG", optimize=True)

    # iOS no respeta la transparencia ni el redondeo: fondo naranja sólido.
    apple = Image.new("RGB", (180, 180), NARANJA[:3])
    apple.paste(a(180), (0, 0), a(180))
    apple.save(ICONS / "apple-touch-icon.png", "PNG", optimize=True)

    # Icono maskable: el arte va al 60% para sobrevivir el recorte circular.
    maskable = Image.new("RGBA", (512, 512), NARANJA)
    interior = a(308)
    maskable.paste(interior, (102, 102), interior)
    maskable.save(ICONS / "icon-maskable-512.png", "PNG", optimize=True)

    escribir_ico([a(n) for n in (16, 32, 48)], ICONS / "favicon.ico")
    print("  iconos: favicon.ico (16/32/48), 192, 512, maskable, apple-touch")


def main() -> int:
    for herramienta in ("cwebp", "avifenc"):
        if shutil.which(herramienta) is None:
            print(f"falta {herramienta} en el PATH", file=sys.stderr)
            return 1
    IMG.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    print("capturas...")
    capturas()
    print("logo...")
    logo()
    print("iconos...")
    iconos()
    print("listo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
