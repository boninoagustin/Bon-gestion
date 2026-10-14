---
description: Cómo compilar la app para Linux (AppImage, deb, snap)
---
Este workflow automatiza la compilación de la aplicación de escritorio para Linux usando Electron Builder.

// turbo-all
1. Ejecuta el comando de compilación
```bash
npm run linux
```
2. Lista los archivos generados en el directorio de `dist_electron` para verificar que se haya construido correctamente.
```bash
ls -la dist_electron/*.{deb,snap,tar.gz}
```
