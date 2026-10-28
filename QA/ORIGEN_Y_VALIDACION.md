# Procedencia y preservación del código original

- Origen: `CodigoFuenteB(5).zip`, del material ISY1102.
- `BACKEND/src/app.js` es idéntico byte por byte al archivo original.
- Ningún archivo dentro de `BACKEND/src/` o `FRONTEND/src/` se altera para las pruebas.
- `BACKEND/sql/dump-cuidarteplus.sql` se preserva idéntico al original únicamente en el disco local, excluido de GitHub debido a registros clínicos de muestra y contraseñas débiles.
- `QA/fixtures/laboratorio.sql` contiene el esquema y datos sintéticos de laboratorio. Es material QA, no el dump original.
- `QA/helpers/escucha-local.cjs` restringe el HTTP a `127.0.0.1` exclusivamente en ejecución; no se modifica Express.
- Los scripts usan PostgreSQL y Node.js nativos, sin Docker; los secretos de `.env` se generan localmente.
- Los resultados funcionales deben medirse en el Ryzen; no hay pruebas ejecutadas por este parche.
