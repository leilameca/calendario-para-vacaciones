# Ya casi · Cada día, más cerca

Calendario navideño compartido para la oficina, desde el **18 de noviembre de 2026**. Interfaz original adaptada a móvil y escritorio, con estado real en servidor.

## Publicación

- Aplicación: https://ya-casi-calendario.vercel.app
- Código: https://github.com/leilameca/calendario-para-vacaciones
- Base: proyecto Supabase `ya-casi-calendario` en `PROYECTOS UNIVERSIDAD`, región `us-east-1`.
- Vercel sirve la interfaz y una API de enlace. Supabase ejecuta las reglas y conserva el estado y las fotos privadas.

La raíz requiere un enlace de acceso. **El enlace de participación y el de administración no se incluyen en este repositorio.** La propietaria abre `.data/ABRIR_ADMIN_WEB.html` desde su computadora, añade al menos dos compañeros y usa «Copiar enlace para compañeros». Ese archivo privado permanece fuera de GitHub.

El enlace de participación permite entrar sin cuenta. La administración usa otro enlace secreto, que se intercambia por una cookie HttpOnly y Secure y se elimina de la dirección. Quien tenga el enlace administrativo puede modificar el calendario; guárdalo en privado.

La publicación actual se subió directamente con Vercel. Este repositorio conserva el código fuente; aún no tiene despliegues continuos vinculados a cada push.

## Fechas iniciales editables

| Campo | Fecha |
| --- | --- |
| Inicio del calendario | 18 de noviembre de 2026 |
| Último día que trabajamos | 14 de diciembre de 2026 |
| Inicio de vacaciones | 15 de diciembre de 2026 |
| Regreso previsto | 7 de enero de 2027 |
| Zona horaria | America/Santo_Domingo |

Son 27 fechas: 19 laborables y 8 de fin de semana, antes de configurar feriados adicionales. La cuenta de días calendario a vacaciones es independiente de los turnos pendientes. Las fechas de salida siguen siendo provisionales hasta confirmarlas con la empresa.

## Comportamiento

- Sorteo seguro, equilibrado, persistente y sin turnos humanos consecutivos para la misma persona.
- Confirmación antes de tachar y marcado idempotente. Varias solicitudes simultáneas conservan una única asignación y un único marcado.
- Sábados, domingos y feriados configurados se completan automáticamente cuando llega su fecha en Santo Domingo. Los laborables olvidados siguen pendientes.
- Árbol derivado de fechas completadas, reacciones, sonido opcional apagado inicialmente y respeto al movimiento reducido.
- Administración de nombres, fotos, fechas, pausas, correcciones y enlaces. Los cambios de fecha se revisan antes de guardar y conservan el historial.
- Fotografías opcionales JPG, PNG o WebP: preparación en el navegador, validación y recodificación en el servidor, recorte cuadrado y tamaños de 256 y 80 píxeles. No se guardan originales ni EXIF. La API admite hasta 5 MB y 8 megapíxeles; la interfaz reduce a 1600 píxeles por lado para enviarlas a Vercel.
- Los clientes consultan cambios cada 1,3 segundos mientras están visibles y recuperan el estado al reconectar. Sin conexión solo se muestra una copia pública de lectura.

## Datos y seguridad

`calendar_app`, `calendar_sessions` y `calendar_rate_limits` tienen RLS activado y acceso revocado para `anon` y `authenticated`. Solo el servidor puede operar. Las escrituras comparan la revisión en PostgreSQL para resolver concurrencia sin sobrescribir cambios. El esquema aplicado está en `hosted/schema.sql`.

Las imágenes recodificadas se guardan en el bucket privado `calendar-photos` y se entregan con firmas temporales. La clave de servicio permanece en las variables internas de Supabase. **No se necesita una clave de base de datos en Vercel.** No se incluye ninguna clave en el código o el navegador.

Vercel conserva protegidas las URL de despliegue y las vistas previas; el dominio estable de producción permite al equipo entrar mediante su enlace. No hay un directorio público de calendarios ni indexación.

La reconciliación se ejecuta al consultar y diariamente mediante Vercel Cron a las 04:00 UTC, medianoche de Santo Domingo. No completa días humanos ni adelanta fechas.

## Desarrollo y despliegue

Requiere Node.js 24 o superior:

```sh
npm ci
npm test
npm run build:vercel
```

Variables del servidor de Vercel:

- `CALENDAR_BACKEND_URL`: URL de la función `calendar-api` de Supabase.
- `PUBLIC_ORIGIN`: URL HTTPS estable del calendario.

La función Supabase usa sus variables integradas `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Su API verifica las capacidades del calendario y la sesión privada, por lo que no utiliza el login JWT de Supabase para los compañeros.

`npm run build:supabase` genera `outputs/calendar-edge.mjs`, listo para desplegar como función `calendar-api`. Las fotos usan Photon 0.4.0 y un módulo WASM fijado por versión y SHA-256; se carga solo al procesar la primera foto de una instancia. No envía fotos al CDN del módulo.

La versión local alternativa se abre con `npm start`, `ABRIR_ADMIN.cmd` o `ABRIR_CALENDARIO.cmd` y guarda sus datos en `.data/`. Esa copia local no se sincroniza con la base de Internet. `npm run recover-admin` recupera únicamente la administración local.

## Verificación

Las pruebas cubren fechas de Santo Domingo, futuros bloqueados, ciclos equilibrados, viernes/lunes, altas, pausa, fines de semana, persistencia, archivado, conflictos de revisión, correcciones, reacciones, API con 20 sorteos y 20 marcaciones simultáneos, fotos y rotación. También validan el adaptador de Supabase y las cabeceras del proxy de Vercel.

La interfaz se revisó a 360, 390, 768, 1024, 1440 y 1920 píxeles, con dos sesiones de navegador, reconexión y fotos. La publicación real se verificó sin cuenta con fecha de servidor del 23 de noviembre, 27 fechas y los dos primeros días automáticos completados. No se añadieron personas ficticias a la base de producción.

No se hizo una auditoría con lector de pantalla ni una medición de rendimiento en un celular físico. La sincronización depende de la red y de los servicios. Revisa las políticas de respaldo y los límites de tus cuentas antes de almacenar información que necesite recuperación garantizada.
