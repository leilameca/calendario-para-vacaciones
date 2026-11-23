# Ya casi · Cada día, más cerca

Aplicación real de calendario navideño, preparada para empezar el **18 de noviembre de 2026**. Las pantallas del ZIP se usaron como referencia visual; el prototipo no se reutilizó como si fuera una aplicación conectada.

## Abrir en esta computadora

Requiere **Node.js 24 o superior**. Las dependencias ya están instaladas en esta entrega.

1. Haz doble clic en **ABRIR_ADMIN.cmd** para abrir tu administración privada.
2. En **Compañeros**, añade al menos dos personas. Las fotos son opcionales.
3. Revisa **Fechas**. El inicio ya es el 18 de noviembre; la salida sigue siendo provisional.
4. Abre **ABRIR_CALENDARIO.cmd** para ver la experiencia de participación.

Los accesos directos encienden el servidor local si hace falta. También puedes ejecutar `npm start` y abrir `http://127.0.0.1:3100`.

**El enlace local funciona en esta computadora.** Para que otras personas entren desde sus celulares hace falta publicar el servidor en un alojamiento accesible por HTTPS. Copiar un enlace que empieza por `127.0.0.1` no lo convierte en un enlace de Internet.

## Fechas iniciales

| Campo | Valor editable |
| --- | --- |
| Primer día del calendario | 18 de noviembre de 2026 |
| Último día que trabajamos | 14 de diciembre de 2026 |
| Inicio de vacaciones | 15 de diciembre de 2026 |
| Regreso previsto | 7 de enero de 2027 |
| Zona horaria del servidor | America/Santo_Domingo |

Son **27 casillas: 19 laborables y 8 de fin de semana**, antes de configurar otros cierres o feriados. El 18 de noviembre faltan 27 días calendario para las vacaciones. Los turnos pendientes se cuentan por separado. No se precargaron personas ficticias ni fotografías.

## Qué funciona

- Calendario de varios meses, detalles de fecha, árbol colectivo y equipo público.
- Estado compartido en servidor: SQLite con transacciones `BEGIN IMMEDIATE`, persistencia en disco y reconciliación al consultar. Los navegadores consultan cambios cada 1,3 segundos mientras están visibles.
- Sorteo con aleatoriedad criptográfica, ciclos equilibrados, asignación única por fecha y conservación al recargar. No repite al compañero anterior, incluso de viernes a lunes.
- Marcado idempotente, confirmación del turno, reacciones y un adorno derivado de cada fecha completada.
- Fin de semana y feriados automáticos. El servidor revisa cada 15 segundos, aunque nadie tenga la página abierta. Al reiniciar recupera solo los automáticos vencidos; nunca rellena turnos humanos olvidados.
- Administración con fechas, resumen previo al guardado, confirmación de archivado, participantes, fotos, pausa, correcciones con motivo y registro de antes/después.
- Fotos JPG, PNG y WebP: validación real, máximo de 5 MB y 25 millones de píxeles, orientación, recorte cuadrado con enfoque, recodificación sin EXIF y tamaños de 256 y 80 píxeles. Los originales no se guardan. Las imágenes se sirven con firma de 15 minutos.
- Accesos público y privado de 32 bytes aleatorios. El servidor comprueba hashes, intercambia el fragmento administrativo por una cookie HttpOnly y limpia la dirección. La renovación privada revoca las sesiones anteriores.
- Protección de origen, límites de solicitudes y conflictos de versión al guardar fechas. No hay claves de servicio en el navegador ni recursos de terceros.
- Preferencias locales de sonido y movimiento, diálogos nativos con foco, modo sin conexión de lectura y bloqueo de escrituras desconectadas.

## Persistencia y accesos

La carpeta **.data/** contiene la base de datos y el recibo privado **accesos.json** generado para la propietaria. Ese recibo es equivalente a una llave: **no lo compartas**. Se excluye de Git y del contenedor. La base guarda hashes de los accesos; el recibo local permite volver a abrir los enlaces y es el único archivo que conserva sus valores originales.

El navegador usa localStorage únicamente para preferencias, identificador de reacciones y una copia pública de lectura. No es la base de datos del calendario. Los datos administrativos no se guardan en esa copia.

Para recuperar un acceso privado perdido, desde esta carpeta ejecuta:

```sh
npm run recover-admin
```

Después abre ABRIR_ADMIN.cmd. Esto invalida el enlace privado y las sesiones anteriores. Conserva el enlace público existente.

## Publicación en un servidor

Esta entrega está funcionando **en local**; no hay un dominio ni un alojamiento de Internet configurado. No se contrataron servicios. La implementación usa Node.js y SQLite en vez de exigir crear PostgreSQL o cuentas externas; el estado compartido sí está en el servidor. El diseño permite una oficina pequeña con **un único servidor y disco persistente**. No ejecutes réplicas con copias independientes del archivo SQLite ni lo alojes en un disco efímero.

Incluye Dockerfile y docker-compose.yml. Configura un dominio y un proxy HTTPS antes de compartir con la oficina:

```sh
# Configura PUBLIC_ORIGIN en el entorno con tu URL HTTPS exacta.
docker compose up -d --build
```

En docker-compose.yml el servicio escucha solo en 127.0.0.1 del servidor para que un proxy local termine TLS. Usa un volumen persistente, reinicio automático y copias de seguridad. `PUBLIC_ORIGIN` comprueba el origen exacto de las escrituras; una URL HTTPS activa también cookies Secure. No expongas la administración por HTTP en Internet.

Después del primer arranque, el operador entrega el enlace público y el privado a la propietaria mediante un canal privado usando el recibo del volumen. No publiques el recibo, los fragmentos privados ni las rutas de capacidad en logs o analítica. La raíz de producción no enumera calendarios.

Variables: `HOST`, `PORT`, `DATA_DIR`, `PUBLIC_ORIGIN`, `COOKIE_SECURE`. Se leen del entorno del proceso; `.env.example` es una referencia. Para usar un archivo .env en local: `node --env-file=.env server.mjs`.

Para respaldar, detén el servidor y copia la carpeta de datos completa, incluyendo el recibo privado. Para restaurar, reemplaza esa carpeta con el servidor detenido y vuelve a arrancar. El archivo SQLite contiene también las fotos y la auditoría. Mantén las copias privadas.

## Verificación ejecutada

`npm test`: **18 pruebas aprobadas**, con reloj inyectado solo en pruebas. Cubren fechas de Santo Domingo, 27 fechas/19 turnos, sorteo equilibrado, viernes/lunes, cero y una persona, persistencia, alta durante un ciclo, pausa, fines de semana, archivado, conflictos, correcciones y reacciones. La API real verifica permisos, CSRF, 20 sorteos y 20 marcaciones simultáneos, procesamiento de fotos y rotación de accesos.

La revisión con Chromium está en `scripts/qa-browser.mjs` (requiere Playwright disponible aparte). Se comprobó que no hay desbordamiento horizontal a 360, 390, 768, 1024, 1440 y 1920 píxeles. Se probaron alta de compañeros, edición y confirmación de fechas, sorteo y marcado, árbol, dos sesiones de navegador, reacciones, desconexión, reconexión y subida real de foto. Las capturas y el reporte están en `test-results/`.

Pendiente de la puesta en Internet: comprobar HTTPS, backups del alojamiento y dos dispositivos físicos usando el dominio definitivo. No se hizo una auditoría con lector de pantalla real ni una medición de rendimiento en un celular físico. La sincronización de 1,3 segundos es un intervalo de consulta, no una garantía de red.

Para otro año, crea otra instancia con su propio DATA_DIR; no reinicies destructivamente esta edición. Las ausencias por fecha quedan fuera de esta primera versión, como prevé el plan.

## Archivos

- `server.mjs`: HTTP, accesos, fotos, sesiones y API.
- `lib/calendar.mjs`: persistencia transaccional y reglas del calendario.
- `public/`: interfaz original responsive sin dependencias de frontend.
- `tests/`: pruebas aisladas; no modifican el calendario real.
- `referencias/YA_CASI/`: plan, prototipo y SVG originales del ZIP, sin cambios.

No se añadió sorpresa diaria, música automática, cuentas ni contraseñas.

## Variante publicada con Sites

El sitio registrado está identificado en `.openai/hosting.json`. `npm run build` crea el Worker de Cloudflare en `dist/server/`, incluye los recursos de interfaz y compila el procesador WASM de fotos. Las migraciones en `drizzle/` crean el estado en D1; las fotos recodificadas se guardan en R2 privado.

`lib/rules.mjs` contiene las mismas reglas de sorteo y fechas que usa la versión local. En D1, cada escritura usa comparación de revisión y reintenta los conflictos para que varios teléfonos conserven una sola asignación. La versión de Internet funciona sin tener encendida esta computadora. Los datos posteriores a la publicación son independientes de la copia local.

Las fotos se reducen en el navegador antes de enviarse, y se vuelven a validar y recodificar en el servidor. La API publicada limita la imagen decodificada a 8 megapíxeles para evitar agotar la memoria; conserva el máximo de 5 MB. Las fotos enviadas desde esta interfaz se preparan a un máximo de 1600 píxeles por lado.

Las variables INITIAL_STATE_JSON e INITIAL_PUBLIC_TOKEN se configuraron como secretos de Sites y solo inicializan una base vacía. No son accesibles desde el cliente ni sustituyen el estado persistido. El acceso administrativo original se valida mediante su hash, incluido en la configuración inicial; no se incluye en el código publicado.

`node scripts/qa-worker.mjs` verifica el Worker con D1 y R2 reales del simulador de Cloudflare, 15 sorteos y 15 marcaciones simultáneas, cookies Secure, rotación y recodificación de JPG, PNG y WebP. La API `/api/tick` solo reconcilia fechas automáticas que ya llegaron; no expone datos ni completa días humanos.

## Publicación preparada para GitHub y Vercel

Se creó el proyecto Supabase `ya-casi-calendario` en `PROYECTOS UNIVERSIDAD`, región `us-east-1`. Identidad pública en `hosted/deployment.json`. La migración remota `calendar_server_storage` ya creó `calendar_app`, `calendar_sessions`, `calendar_rate_limits` y la función interna de límites. Las tablas tienen RLS activado y se revocó el acceso de `anon` y `authenticated`; solo `service_role` puede operar. El bucket `calendar-photos` es privado y admite únicamente WebP recodificado. La revisión de seguridad no encontró avisos de nivel WARN o ERROR; el aviso informativo de RLS sin políticas es esperado en estas tablas de uso exclusivo del servidor.

`npm run build:vercel` compila el mismo controlador del calendario para Node.js y usa Sharp para las fotografías. `hosted/supabase.mjs` conecta el estado mediante la API de Supabase con control de revisión atómico. `vercel.json` configura las rutas y la reconciliación diaria a las 04:00 UTC (00:00 de Santo Domingo). Las consultas al calendario también recuperan fechas automáticas vencidas.

Variables necesarias en Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secreto de servidor) y `PUBLIC_ORIGIN` (URL HTTPS definitiva). El archivo `.env.example` no contiene valores reales. Los datos de inicialización se cargan directamente en la base antes de publicar; no se incluyen como archivo en GitHub.

Estado de esta preparación: base y esquema creados; build de Vercel y 21 pruebas aprobados. Aún se necesita autenticar GitHub para crear un repositorio privado y conectar Vercel para desplegar. También está pendiente la autorización explícita para trasladar los accesos locales y abrir el enlace de participación sin cuentas. No se considera publicado en Vercel hasta verificar una URL de producción.
