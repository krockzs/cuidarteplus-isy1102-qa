#!/usr/bin/env python3
"""Analiza JTL (CSV) de JMeter 5.6.3, sin incluir cuerpos ni tokens."""
import csv
import json
import math
import os
import statistics
import sys
from collections import defaultdict
from pathlib import Path

src = Path(sys.argv[1])
dest = Path(sys.argv[2])
threshold = int(os.environ.get("EP5_P95_MAX_MS", "2000"))
groups = defaultdict(list)
with src.open(newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        groups[row["label"]].append(row)

if not groups:
    raise SystemExit("JTL sin muestras")

report = {"umbral_p95_pacientes_ms": threshold, "peticiones": {}, "cumple": True}
for label, rows in groups.items():
    elapsed = sorted(int(row["elapsed"]) for row in rows)
    n = len(elapsed)
    failures = sum(
        row.get("success", "").lower() != "true" or row.get("responseCode") != "200"
        for row in rows
    )
    p95 = elapsed[max(0, math.ceil(n * 0.95) - 1)]
    report["peticiones"][label] = {
        "muestras": n,
        "fallos_http_o_assert": failures,
        "promedio_ms": round(statistics.mean(elapsed), 2),
        "mediana_ms": round(statistics.median(elapsed), 2),
        "p95_ms": p95,
        "min_ms": elapsed[0],
        "max_ms": elapsed[-1],
    }
    if failures:
        report["cumple"] = False
    if label.startswith("GET pacientes") and p95 > threshold:
        report["cumple"] = False

if not any(label.startswith("GET pacientes") for label in groups):
    report["cumple"] = False

dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("CUIDARTE+ | EP5 3.3 | JMETER")
for label, info in report["peticiones"].items():
    print(f'{label}: n={info["muestras"]}, promedio={info["promedio_ms"]} ms, '
          f'p95={info["p95_ms"]} ms, errores={info["fallos_http_o_assert"]}')
print(f'Umbral GET pacientes: p95 <= {threshold} ms')
print("CUMPLE" if report["cumple"] else "NO CUMPLE")
with Path(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null")).open("a", encoding="utf-8") as f:
    f.write("\n### JMeter: medición real de API\n")
    f.write("| Operación | Muestras | Promedio | p95 | Errores |\n|---|---:|---:|---:|---:|\n")
    for label, info in report["peticiones"].items():
        f.write(f'| {label} | {info["muestras"]} | {info["promedio_ms"]} ms | '
                f'{info["p95_ms"]} ms | {info["fallos_http_o_assert"]} |\n')
    f.write(f'\nUmbral académico: p95 GET pacientes <= {threshold} ms. '
            f'**{"CUMPLE" if report["cumple"] else "NO CUMPLE"}**.\n')
sys.exit(0 if report["cumple"] else 1)
