# Suite QA — Cuidarte+ / ISY1102 EP3 y EP4

Ocho casos ejecutables con Jest contra la API HTTP y PostgreSQL nativo; T-08 es manual, descrito en `T-08-MANUAL.md`.

| Caso | Prueba | Comportamiento esperado |
|---|---|---|
| T-01 | Autorización de roles | Un paciente no crea administradores |
| T-02 | Confidencialidad | Búsqueda clínica sin token es denegada |
| T-03 | Conservación | Eliminación no destruye examen clínico |
| T-04 | Auditoría de cambio real | Evento persistente con autor y fecha |
| T-05 | Criptografía | Las nuevas contraseñas no quedan en texto claro |
| T-06 | Calidad funcional/RUT | RUT con DV incorrecto es rechazado |
| T-07 | Rendimiento | Listado en 2.000 ms o menos (umbral académico) |
| T-08 | Usabilidad manual | Funciona búsqueda prometida por médico |
| T-09 | Carga de archivos | Contenido discordante con MIME es rechazado |

**Interpretación:** Jest `PASS` significa que *el sistema cumple ese criterio*. Jest `FAIL` significa que *se observó un incumplimiento*, siempre que el entorno esté listo y no exista error de preparación. No alterar los tests para forzar un PASS.

**Ámbito:** exclusivamente laboratorio aislado y con datos ficticios. Test T-03 ejecuta borrado sobre una ficha temporal; T-01 y T-05 crean usuarios temporales y después los limpian. `QA/helpers/db.js` exige la base `cuidarteplus_qa`, marcador QA y `QA_ALLOW_MUTATIONS=YES`.

Comandos principales desde la carpeta raíz:

```bash
bash scripts/00-preparar-rizen.sh
bash scripts/01-laboratorio.sh
bash scripts/02-ejecutar-jest.sh
bash scripts/06-empaquetar-evidencias.sh
```

Los resultados se guardan fuera de Git en `QA/reportes/` y `QA/evidencias/`. Se recomienda capturar pantalla de `reporte-ep3.html` para la defensa. Las referencias ISO y legales se contrastarán con el ERS y los resultados reales en la fase documental, sin confundir una falla técnica con una infracción legal formalmente determinada.
