# Cuidarte+ — ISY1102 · Laboratorio nativo con Jest

Esta es una aplicación **intencionalmente vulnerable**, destinada exclusivamente a evaluar fallas de calidad y seguridad en una máquina local, con datos de prueba sintéticos. **No debe exponerse en Internet.**

## Componentes
- Frontend: React + Vite; `http://127.0.0.1:3333/`.
- Backend: Node.js + Express; `http://127.0.0.1:4444/` y `/docs`.
- Base de datos: PostgreSQL **nativo**; `127.0.0.1:5432`, base exclusiva `cuidarteplus_qa`.
- Suite: Jest + `pg`, ocho pruebas automatizadas (T-01..T-07, T-09); T-08 es manual.
- Se conservan las vulnerabilidades de la aplicación. El backend solo se limita a `127.0.0.1` para no exponer el laboratorio.

## En NEEBLES OS / Ryzen (Debian)
Descomprime en `~/Downloads`, entra en la carpeta del proyecto y ejecuta **en orden**:

```bash
bash scripts/00-preparar-rizen.sh
bash scripts/01-laboratorio.sh
bash scripts/02-ejecutar-jest.sh
```

El primer script instala PostgreSQL y herramientas del host, pero **no reemplaza un Node.js ya instalado**. Se requiere Node 20.19+ o 22.12+ / 24+ para Vite 7. El segundo crea una base y un rol dedicados sin modificar otras bases, genera un `.env` privado, instala paquetes con npm y levanta los procesos locales. El tercero ejecuta Jest, genera JSON/TXT/HTML, y deja resultados en `QA/reportes/` y `QA/evidencias/`.

Para preparar el ZIP de evidencias para adjuntar al chat:

```bash
bash scripts/06-empaquetar-evidencias.sh
```

El ZIP se crea en `~/Downloads/`, sin archivos de configuración privados ni logs del backend.

Para detener solo el frontend y backend:

```bash
bash scripts/05-detener-laboratorio.sh
```

La base local de PostgreSQL no se apaga ni se elimina automáticamente. **Nunca** uses información personal real en este laboratorio.

## Usuarios de demostración (ficticios)
| Rol | Usuario | Contraseña de ejercicio |
|---|---|---|
| Admin | `qa_admin` | `demo_admin_qa` |
| Médico | `qa_medico` | `demo_medico_qa` |
| Paciente | `qa_paciente` | `demo_paciente_qa` |

Estos usuarios **solo** existen dentro de la base académica y no deben utilizarse en redes públicas.

## Repositorio público

```bash
bash scripts/03-publicar-github.sh
```

Se solicitará la autenticación con GitHub CLI, y una confirmación explícita antes de crear el repositorio público. `.env`, los resultados de pruebas, las carpetas de dependencias y archivos subidos quedan excluidos por `.gitignore`. Los datos SQL incluidos son **sintéticos**; el volcado original con registros del ejercicio fue reemplazado.

## Interpretación

- `PASS`: el caso cumple los criterios definidos; `FAIL`: posible hallazgo **si** ambiente y datos de prueba son correctos.
- Un fallo de configuración no debe informarse como una vulnerabilidad.
- El ERS completo no está incluido, así que aún no se afirma cobertura del 100 %.
- Las instrucciones específicas están en `QA/README.md`; la prueba visual T-08 está en `QA/T-08-MANUAL.md`.
- El límite T-07 de 2 segundos es un **criterio académico del ejercicio**, no una obligación ISO.
