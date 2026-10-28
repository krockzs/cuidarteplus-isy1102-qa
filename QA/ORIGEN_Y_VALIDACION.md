# Procedencia y validación del laboratorio

- ZIP de origen: `CodigoFuenteB(5).zip`
- SHA-256 del ZIP original: `b331e9298315c0528014898a5c74ea1782def0eb1dbb3cfc10c1f87a4c99b60e`
- La implementación original del backend se conserva, salvo el enlace de escucha de `app.js` limitado a `127.0.0.1` para que la API vulnerable no quede expuesta en la red.
- No se modificaron las implementaciones deliberadamente vulnerables de las rutas.
- Se sustituyó el volcado de datos inicial por registros ficticios de QA.
- Se eliminaron todos los `.env` originales. Las credenciales reales nunca forman parte de esta entrega.
- Se reemplazó el método de ejecución por PostgreSQL, Node y Vite nativos. Se retiraron archivos y scripts exclusivos de Docker. La base se inicializa de forma controlada solo si no existe; la API escucha exclusivamente en loopback.
- Validación efectuada en entorno de preparación: sintaxis Node de backend (18/18) y suite QA, Bash (scripts).
- **No se han ejecutado pruebas contra un servidor Cuidarte+ real** en este entorno, porque no hay servicios nativos ni servicio PostgreSQL disponible; el Ryzen debe ejecutar la suite para producir resultados reales.
