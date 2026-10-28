# T-08 — Usabilidad: búsqueda por médico (manual)

**Criterio propuesto:** La búsqueda de exámenes debe admitir los criterios anunciados en el Centro de Ayuda.

1. Entra a `http://localhost:3333` con `qa_paciente` y su clave de laboratorio (`demo_paciente_qa`).
2. Visita **Ayuda**. Busca la instrucción que menciona búsqueda «por fecha, tipo de examen o médico». Toma captura.
3. Regresa a **Inicio** y revisa el campo de búsqueda. La lógica del filtro en `FRONTEND/src/pages/Home.jsx` utiliza solo fecha y tipo de examen, no médico. Toma captura de la interfaz.
4. Anota el resultado de la comparación. Si no hay datos de médico atribuibles a un examen, documenta la ausencia del criterio de búsqueda; no afirmes que un examen concreto debía coincidir por médico sin tener ese dato.
5. Guarda capturas y el resultado de ejecución en `QA/evidencias/T-08/` (esta carpeta está excluida de Git).

**Referente:** ISO/IEC 25010:2023, capacidad de interacción; coherencia entre instrucciones y funcionalidad. El defecto debe confirmarse visualmente.

Para agregar el resultado manual al HTML: copia `QA/T-08-RESULTADO.ejemplo.json` a `QA/evidencias/T-08.json`, cambia `estado` por `CUMPLE` o `NO CUMPLE` según la observación real, guarda las capturas y ejecuta `cd QA && npm run report`.
