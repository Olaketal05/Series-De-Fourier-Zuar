# Series de Fourier · IPN – ESIME

Simulador web de series de Fourier para cuatro ondas periódicas (en este orden):
**senoidal, cuadrada, triangular y diente de sierra**.

Realizado por: Arrucha Fernandez Zuar Zaret
Instituto Politécnico Nacional · Escuela Superior de Ingeniería Mecánica y Eléctrica

## Qué hace

- Grafica cada onda (serie de Fourier truncada y onda ideal) abarcando **siempre dos periodos**.
- Campos por onda: **frecuencia f** (20–5000 Hz), **amplitud A** (0.1–10) y **número de términos n** (menú de 1 a 30).
- Botón **Reproducir / Detener**: genera el audio de la onda con los mismos coeficientes de la serie (Web Audio API, 2 segundos).
- Diseño responsivo:
  - **PC**: gráfica en la mitad de la pantalla y controles a su derecha.
  - **Móvil**: gráfica a todo el ancho y controles debajo.
- Paleta guinda, blanco, verde y gris.

## Series utilizadas

| Onda | Serie |
|------|-------|
| Senoidal | `A·sen(ωt)` |
| Cuadrada | `(4A/π) Σ sen((2k−1)ωt)/(2k−1)` |
| Triangular | `(8A/π²) Σ (−1)^(k+1) sen((2k−1)ωt)/(2k−1)²` |
| Diente de sierra | `(2A/π) Σ (−1)^(k+1) sen(kωt)/k` |

Con `ω = 2πf` y `k = 1 … n`. El número de términos `n` cuenta los términos distintos de cero
(en la cuadrada y la triangular solo hay armónicos impares).

## Logos

Coloca en la misma carpeta que `index.html` los archivos:

- `logo-ipn.png`
- `logo-esime.png`

Si no existen, el encabezado muestra un recuadro con las siglas IPN / ESIME.

## Publicar en GitHub Pages

1. Crea un repositorio y sube `index.html`, `style.css`, `script.js` y los logos.
2. En el repositorio entra a **Settings → Pages**.
3. En *Build and deployment* elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`.
4. Guarda; en unos minutos el sitio estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

No requiere instalación ni librerías externas.
