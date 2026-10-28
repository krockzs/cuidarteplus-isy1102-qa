#!/usr/bin/env python3
"""Resumen de respuestas reales de la API de SonarQube sin completar valores faltantes."""
import json
import pathlib
import sys

folder = pathlib.Path(sys.argv[1])

def load(name):
    try:
        return json.loads((folder / name).read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        return None

issues = load('issues.json')
hotspots = load('hotspots.json')
metrics = load('metricas.json')
qg = load('quality-gate.json')
lines = ['SONARQUBE | CUIDARTE+ | REPORTE DE ANÁLISIS ESTÁTICO',
         'Se analizaron exclusivamente BACKEND/src y FRONTEND/src.',
         'No confundir los indicadores de SonarQube con cobertura ERS ni fallas dinámicas de Jest.', '']
if issues:
    lines.append(f'Incidencias totales reportadas por el API: {issues.get("total", "no disponible")}')
    types = {}
    for entry in issues.get('issues', []):
        key = str(entry.get('type', entry.get('impacts', 'SIN_CLASIFICAR')))
        types[key] = types.get(key, 0) + 1
    lines.append(f'Clases de las primeras {len(issues.get("issues", []))} incidencias: {types}')
else:
    lines.append('Incidencias: no disponibles (ver log).')
if hotspots:
    lines.append(f'Hotspots de seguridad reportados: {hotspots.get("paging", {}).get("total", hotspots.get("total", "no disponible"))}')
else:
    lines.append('Hotspots de seguridad: no disponibles.')
if qg:
    lines.append('Quality Gate: ' + str(qg.get('projectStatus', {}).get('status', 'sin estado')))
else:
    lines.append('Quality Gate: no disponible.')
if metrics:
    for metric in metrics.get('component', {}).get('measures', []):
        lines.append(f'Métrica {metric.get("metric", "?")}: {metric.get("value", "sin valor")}')
else:
    lines.append('Métricas: no disponibles.')
text = '\n'.join(lines) + '\n'
(folder / 'resumen.txt').write_text(text, encoding='utf-8')
print(text)
