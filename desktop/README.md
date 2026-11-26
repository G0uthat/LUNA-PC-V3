# Luma Desktop (PC)

Versión de escritorio ejecutable de **Luma** diseñada con la experiencia de **Notion** (menú lateral proporcional redimensionable, pestañas múltiples, búsqueda `Ctrl+K`, tabla/galería y vista dividida) y **Canva** (estudio de cuadernos visuales con barra lateral de herramientas, plantillas, formas, capas, notas adhesivas, tablas y exportación HD).

## Diseño adaptable a cualquier resolución
El menú y los paneles se reajustan automáticamente en 5 niveles según el tamaño de la ventana y monitor:
- **Ventana compacta (`< 820px`)**: menú deslizable superpuesto y controles compactos.
- **Pantalla dividida (`820px – 1119px`)**: barra lateral de iconos fina (`56px`) expandible al clic.
- **Portátil (`1120px – 1439px`)**: menú lateral proporcional redimensionable + soporte para Vista Dividida (Lector + Cuaderno).
- **Escritorio FHD / 1440p (`1440px – 1919px`)**: menú completo, lectura en 2 páginas e inspector lateral desplegable.
- **Monitor 4K / UltraWide (`>= 1920px`)**: proporciones amplias para lectura editorial y lienzo simultáneo.

## Cómo generar el ejecutable en tu PC

### Windows (`.exe` instalador + `.exe` portable)
Haz doble clic en `desktop/build-windows.bat` o ejecuta en PowerShell:
```bash
cd desktop
npm install
npm run dist:win
```
Los ejecutables quedarán en `desktop/release/`.

### macOS (`.dmg`) y Linux (`.AppImage` / `.deb`)
```bash
cd desktop
chmod +x build-mac-linux.sh
./build-mac-linux.sh
```

### Automático desde GitHub Actions (Windows)
El workflow `.github/workflows/build-pc.yml` compila en GitHub:
- **Setup instalador:** `Luma-Setup-<versión>.exe`
- **Portable:** `Luma-Portable-<versión>.exe`

Cómo usarlo:
1. Sube el repo a GitHub (rama `main`).
2. Pestaña **Actions → Build Luma para Windows → Run workflow** (o se lanza solo al hacer push a `desktop/**`).
3. Al terminar, descarga el artefacto **Luma-Windows** al final de la ejecución.
4. Para publicar un **Release** con los `.exe`: `git tag v1.0.0 && git push origin v1.0.0`.

### Ejecutar en modo desarrollo
```bash
cd desktop
npm install
npm run dev
```
