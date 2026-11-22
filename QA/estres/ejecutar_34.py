#!/usr/bin/env python3
"""IL 3.4: ensayo progresivo y continuidad en una base QA efímera.

Sólo opera contra 127.0.0.1:4444 y cuidarteplus_qa con marcador público.
No contiene instrucciones de explotación ni solicita tráfico externo.
"""
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import statistics
import subprocess
import sys
import time
from urllib.request import urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "QA" / "reportes" / "ep5-34"
OUT.mkdir(parents=True, exist_ok=True)
STAGES = [(1, 1), (4, 2), (8, 3), (16, 4), (24, 5)]  # usuarios, ramp segundos
LOOPS = 2
BASE = "http://127.0.0.1:4444"
MARKER = "CUIDARTE_QA_PUBLIC_20261028"
DB = "cuidarteplus_qa"
RESTORED_DB = "cuidarteplus_qa_ep5_34_restore"
TEMPLATE = ROOT / "QA" / "jmeter" / "cuidarte-ep5-33.jmx"
JMETER = Path(os.environ["EP5_JMETER_HOME"]) / "bin" / "jmeter"
API_PID_FILE = Path(os.environ["EP5_API_PID_FILE"])
ENV = os.environ.copy()
ENV["PGPASSWORD"] = ENV["POSTGRES_PASSWORD"]
REPORT = {"escenario": "laboratorio QA efimero, loopback", "etapas": [],
          "criterio_p95_ms": 2000, "maximo_usuarios": 24,
          "bucles_por_usuario": LOOPS, "conclusion": "INCOMPLETA",
          "advertencias": [], "integridad": {}, "recuperacion": {}}

SQL = """
SELECT json_build_object(
 'marker',(SELECT etiqueta FROM qa_lab_marker WHERE id=1),
 'pacientes',(SELECT count(*) FROM pacientes),
 'examenes',(SELECT count(*) FROM examen_medico),
 'usuarios',(SELECT count(*) FROM usuarios),
 'huella_pacientes',(SELECT md5(coalesce(string_agg(
   id::text || ':' || rut || ':' || coalesce(alergias,''), '|' ORDER BY id
 ),'')) FROM pacientes),
 'huella_examenes',(SELECT md5(coalesce(string_agg(
   id::text || ':' || paciente_id::text || ':' || coalesce(diagnosis,''), '|' ORDER BY id
 ),'')) FROM examen_medico)
)::text;
"""
def pg_args(db=DB):
    return ["-h", "127.0.0.1", "-p", "5432", "-U", ENV["POSTGRES_USER"], "-d", db]

def run(cmd, *, timeout=50, stdout=None):
    p = subprocess.run(cmd, env=ENV, cwd=ROOT, text=stdout is None,
                       stdout=stdout if stdout is not None else subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=timeout, check=False)
    if p.returncode:
        err = p.stderr if isinstance(p.stderr, str) else p.stderr.decode(errors="replace")
        raise RuntimeError(f"Comando de laboratorio falló ({p.returncode}): {cmd[0]}: {err[-500:]}")
    return p.stdout

def query(sql, db=DB):
    v = run(["psql", "-X", "-w", *pg_args(db), "-At",
             "-v", "ON_ERROR_STOP=1", "-c", sql])
    return v.strip().splitlines()[-1]

def snapshot(db=DB):
    data = json.loads(query(SQL, db))
    if data["marker"] != MARKER:
        raise RuntimeError("Marcador de QA inválido: ejecución prohibida")
    return data

def ready(url=BASE + "/", timeout=3.0):
    try:
        with urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False

def rss_kib(pid):
    try:
        for row in Path(f"/proc/{pid}/status").read_text().splitlines():
            if row.startswith("VmRSS:"):
                return int(row.split()[1])
    except (FileNotFoundError, ProcessLookupError):
        pass
    return 0

def cpu_ticks(pid):
    try:
        stat = Path(f"/proc/{pid}/stat").read_text().rsplit(") ", 1)[1].split()
        return int(stat[11]) + int(stat[12])
    except (FileNotFoundError, ProcessLookupError, ValueError, IndexError):
        return 0

def pg_connections():
    try:
        return int(query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()"))
    except Exception:
        return -1

def jmx_for_stage(threads, ramp, target):
    tree = ET.parse(TEMPLATE)
    group = tree.find(".//ThreadGroup")
    if group is None:
        raise RuntimeError("No existe ThreadGroup en JMX certificado")
    group.set("testname", f"IL 3.4 | {threads} usuarios x {LOOPS} ciclos")
    for prop, value in (("ThreadGroup.num_threads", threads),
                        ("ThreadGroup.ramp_time", ramp),
                        ("ThreadGroup.on_sample_error", "continue")):
        node = group.find(f"./stringProp[@name='{prop}']")
        if node is not None:
            node.text = str(value)
        elif prop != "ThreadGroup.on_sample_error":
            raise RuntimeError(f"Propiedad de JMeter ausente: {prop}")
    loops = group.find(".//stringProp[@name='LoopController.loops']")
    if loops is None:
        raise RuntimeError("No existe LoopController.loops")
    loops.text = str(LOOPS)
    tree.write(target, encoding="utf-8", xml_declaration=True)

def summarize(jtl, threads, duration_s, samples):
    by_name = {}
    with jtl.open(newline="", encoding="utf-8") as f:
        for item in csv.DictReader(f):
            by_name.setdefault(item["label"], []).append(item)
    results = {}
    for label, rows in by_name.items():
        times = sorted(int(x["elapsed"]) for x in rows)
        num = len(times)
        errors = sum(x.get("success", "").lower() != "true" or
                     x.get("responseCode") != "200" for x in rows)
        results[label] = {
            "muestras": num,
            "errores": errors,
            "promedio_ms": round(statistics.mean(times), 2),
            "p95_ms": times[math.ceil(num * .95) - 1],
            "max_ms": times[-1],
        }
    match = next((v for k, v in results.items() if k.startswith("GET pacientes")), None)
    if not match or match["muestras"] != threads * LOOPS:
        raise RuntimeError(f"Cantidad de GET inesperada: {threads}, {match}")
    logins = next((v for k, v in results.items() if k.startswith("POST login")), None)
    if not logins or logins["muestras"] != threads * LOOPS:
        raise RuntimeError("Cantidad de autenticaciones inesperada")
    total = match["muestras"] + logins["muestras"]
    errors = match["errores"] + logins["errores"]
    return {
        "usuarios": threads, "ramp_s": next(r for t, r in STAGES if t == threads),
        "ciclos": LOOPS, "duracion_s": round(duration_s, 2),
        "peticiones": total, "errores": errors,
        "tasa_error_pct": round(errors * 100 / total, 2),
        "get_pacientes": match, "login": logins,
        "backend_rss_pico_mib": round(max((s["rss_kib"] for s in samples), default=0) / 1024, 2),
        "backend_cpu_pct_pico": round(max((s.get("cpu_pct", 0) for s in samples), default=0), 2),
        "postgres_conexiones_pico": max((s.get("pg_conexiones", -1) for s in samples), default=-1),
        "cumple_p95_2000ms": match["p95_ms"] <= 2000,
    }

def run_stages(api_pid):
    stage_dir = OUT / "etapas"
    stage_dir.mkdir(exist_ok=True)
    monitor_file = OUT / "monitoreo.csv"
    with monitor_file.open("w", newline="", encoding="utf-8") as fd:
        writer = csv.DictWriter(fd, fieldnames=[
            "etapa_usuarios", "t_s", "backend_rss_kib", "backend_cpu_pct",
            "postgres_conexiones"])
        writer.writeheader()
        for users, ramp in STAGES:
            if not ready():
                REPORT["advertencias"].append("API no disponible antes de etapa")
                break
            stem = stage_dir / f"usuarios_{users:02}"
            jmx = stem.with_suffix(".jmx")
            jtl = stem.with_suffix(".jtl")
            jlog = stem.with_suffix(".log")
            console = stem.with_name(stem.name + "_consola.log")
            jmx_for_stage(users, ramp, jmx)
            print(f"ETAPA: {users} usuarios | 2 ciclos | ramp={ramp} s", flush=True)
            start = time.monotonic()
            samples = []
            last_ticks = cpu_ticks(api_pid)
            last_t = start
            with console.open("w", encoding="utf-8") as log:
                proc = subprocess.Popen([str(JMETER), "-n", "-t", str(jmx),
                                         "-l", str(jtl), "-j", str(jlog)],
                                        stdout=log, stderr=subprocess.STDOUT,
                                        cwd=ROOT, env=ENV)
                while proc.poll() is None:
                    if time.monotonic() - start > 85:
                        proc.terminate()
                        try:
                            proc.wait(timeout=6)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                        raise RuntimeError("Etapa JMeter superó límite seguro de 85 s")
                    now = time.monotonic()
                    ticks = cpu_ticks(api_pid)
                    wall = now - last_t
                    cpu = 100 * (ticks - last_ticks) / (os.sysconf("SC_CLK_TCK") * wall) if wall > 0 else 0
                    last_ticks, last_t = ticks, now
                    sample = {"rss_kib": rss_kib(api_pid), "cpu_pct": max(cpu, 0),
                              "pg_conexiones": pg_connections()}
                    samples.append(sample)
                    writer.writerow({"etapa_usuarios": users, "t_s": round(now-start, 2),
                                     "backend_rss_kib": sample["rss_kib"],
                                     "backend_cpu_pct": round(sample["cpu_pct"], 2),
                                     "postgres_conexiones": sample["pg_conexiones"]})
                    fd.flush()
                    time.sleep(1)
                result_code = proc.wait()
            if result_code != 0:
                REPORT["advertencias"].append(f"Etapa {users}: fallo ejecutor JMeter {result_code}")
                break
            stage = summarize(jtl, users, time.monotonic()-start, samples)
            REPORT["etapas"].append(stage)
            print(f"  GET p95={stage['get_pacientes']['p95_ms']} ms | "
                  f"errores={stage['errores']} | CPU pico={stage['backend_cpu_pct_pico']}% | "
                  f"RSS pico={stage['backend_rss_pico_mib']} MiB | PG pico={stage['postgres_conexiones_pico']}",
                  flush=True)
            if stage["tasa_error_pct"] >= 20 or stage["get_pacientes"]["p95_ms"] > 14000:
                REPORT["advertencias"].append(
                    "Corte de seguridad: >=20% errores o GET p95 >14s. No avanzar carga."
                )
                break
            if not ready():
                REPORT["advertencias"].append("API no respondió tras etapa; carga detenida")
                break
    return len(REPORT["etapas"]) == len(STAGES)

def restart_api():
    old_pid = int(API_PID_FILE.read_text().strip())
    t0 = time.monotonic()
    os.kill(old_pid, signal.SIGTERM)
    for _ in range(50):
        if not ready(timeout=.2):
            break
        time.sleep(.1)
    else:
        raise RuntimeError("API no se detuvo tras SIGTERM; no iniciar segunda instancia")
    log = (OUT / "backend-reinicio.log").open("w", encoding="utf-8")
    newproc = subprocess.Popen(
        ["node", "--require", str(ROOT / "QA/helpers/escucha-local.cjs"),
         str(ROOT / "BACKEND/src/app.js")], cwd=ROOT, env=ENV,
        stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(120):
        if ready() and ready(BASE + "/tipo-examen"):
            elapsed = round((time.monotonic()-t0)*1000, 2)
            REPORT["recuperacion"] = {
                "tipo": "reinicio controlado de API, no desastre completo",
                "api_restart_recuperacion_ms": elapsed,
                "disponibilidad_restaurada": True,
                "postgres_conexiones_post": pg_connections(),
            }
            print(f"REINICIO CONTROLADO: API recuperada en {elapsed} ms", flush=True)
            return
        if newproc.poll() is not None:
            raise RuntimeError("El proceso API reiniciado terminó prematuramente")
        time.sleep(.25)
    raise RuntimeError("API no recuperó disponibilidad antes de 30 s")

def make_visual():
    from html import escape
    stages = REPORT["etapas"]
    rects = []
    for i, s in enumerate(stages):
        p95 = s["get_pacientes"]["p95_ms"]
        x = 60+i*135
        h = min(180, p95*180/15000)
        y = 220-h
        color = "#d8524d" if p95 > 2000 else "#179879"
        rects.append(f'<rect x="{x}" y="{y:.1f}" width="80" height="{h:.1f}" fill="{color}" rx="4"/>'
                     f'<text x="{x+40}" y="{y-8:.1f}" text-anchor="middle" fill="#243242" font-size="14">{p95} ms</text>'
                     f'<text x="{x+40}" y="242" text-anchor="middle" fill="#243242" font-size="13">{s["usuarios"]} usuarios</text>')
    h_thr = 220-2000*180/15000
    rects.append(f'<line x1="36" x2="715" y1="{h_thr:.1f}" y2="{h_thr:.1f}" stroke="#ca7024" stroke-dasharray="6,6"/>')
    rows = "".join(
        f"<tr><td>{s['usuarios']}</td><td>{s['peticiones']}</td>"
        f"<td>{s['get_pacientes']['promedio_ms']} ms</td><td>{s['get_pacientes']['p95_ms']} ms</td>"
        f"<td>{s['tasa_error_pct']}%</td><td>{s['backend_cpu_pct_pico']}%</td>"
        f"<td>{s['backend_rss_pico_mib']} MiB</td><td>{s['postgres_conexiones_pico']}</td></tr>"
        for s in stages)
    reco = REPORT.get("recuperacion", {})
    integ = REPORT.get("integridad", {})
    html = f"""<!doctype html><html lang="es"><meta charset="utf-8">
<title>Cuidarte+ · EP5 3.4 · Resiliencia</title>
<style>body{{font:15px system-ui,Arial;background:#f3f5f9;color:#233246;margin:0;padding:30px}}
main{{max-width:1100px;margin:auto}}article{{background:white;border-radius:12px;margin:18px 0;padding:24px;box-shadow:0 3px 13px #d9e2ec}}
h1,h2{{color:#234e6a}}table{{border-collapse:collapse;width:100%}}td,th{{padding:10px;border-bottom:1px solid #dae2ee;text-align:left}}
th{{background:#e9f1f6}}.warn{{color:#a43434;font-weight:bold}}.ok{{color:#147850;font-weight:bold}}
svg{{max-width:100%;height:auto}}</style><main>
<h1>Cuidarte+ · 3.4 · Estrés escalonado y resiliencia</h1>
<p>Prueba real en GitHub Actions, PostgreSQL 17 efímero y datos sintéticos. No existe exposición pública.</p>
<article><h2>Latencia p95 por concurrencia</h2><svg viewBox="0 0 760 265" xmlns="http://www.w3.org/2000/svg">
{''.join(rects)}<text x="38" y="{h_thr-7:.1f}" font-size="13" fill="#a14c10">Umbral 2000 ms</text></svg></article>
<article><h2>Monitoreo y mediciones</h2><table><tr><th>Usuarios</th><th>Solicitudes</th><th>Promedio GET</th><th>p95 GET</th><th>Error</th><th>CPU pico backend</th><th>RAM pico backend</th><th>Conexiones PG pico</th></tr>
{rows}</table></article>
<article><h2>Recuperación e integridad</h2>
<p>Reinicio API: <strong>{reco.get('api_restart_recuperacion_ms','No medido')} ms</strong>;
 API disponible de nuevo: {reco.get('disponibilidad_restaurada','No confirmado')}.</p>
<p>Datos clínicos sintéticos íntegros pre/post: <strong>{integ.get('sin_cambios_registros', 'No confirmado')}</strong>.
Simulacro de restauración PostgreSQL: <strong>{integ.get('restauracion_verificada','No confirmado')}</strong>;
 tiempo de restauración: {integ.get('restauracion_ms','No medido')} ms.</p>
<p><strong>Nota:</strong> El reinicio de API no mide RTO de desastre integral. La restauración con datos sintéticos
 no establece un RPO garantizado para un sistema real.</p></article>
<article><h2>Conclusión</h2><p><strong>{escape(REPORT['conclusion'])}</strong></p>
<p>Límite técnico examinado: hasta {REPORT['etapas'][-1]['usuarios'] if stages else 0} usuarios simultáneos,
no se afirma un punto de colapso fuera de las condiciones probadas.</p></article></main></html>"""
    (OUT/"panel_3_4.html").write_text(html, encoding="utf-8")

def main():
    if not JMETER.is_file() or not TEMPLATE.is_file():
        raise RuntimeError("Falta JMeter o el plan JMX base")
    if not API_PID_FILE.is_file():
        raise RuntimeError("Falta PID del backend efímero")
    before = snapshot()
    (OUT/"snapshot_antes.json").write_text(json.dumps(before, indent=2)+"\n")
    if not ready():
        raise RuntimeError("API QA no responde en loopback")
    print(f"LABORATORIO VERIFICADO: {MARKER}", flush=True)
    # El backup se realiza antes de la presión de carga; restauración en DB aparte.
    backup = OUT / "respaldo-qa-temporal.dump"
    run(["pg_dump", *pg_args(), "-Fc", "-f", str(backup)], timeout=60)
    (OUT/"respaldo-qa-temporal.sha256").write_text(
        hashlib.sha256(backup.read_bytes()).hexdigest()+"\n")
    complete = run_stages(int(API_PID_FILE.read_text().strip()))
    after_load = snapshot()
    REPORT["integridad"]["sin_cambios_tras_carga"] = before == after_load
    print("INTEGRIDAD TRAS CARGA:", before == after_load, flush=True)
    restart_api()
    after_restart = snapshot()
    REPORT["integridad"]["sin_cambios_registros"] = before == after_restart
    (OUT/"snapshot_despues.json").write_text(json.dumps(after_restart, indent=2)+"\n")
    # Restauración técnica contra una base separada, jamás sobre la base de origen.
    run(["createdb", "-h", "127.0.0.1", "-p", "5432", "-U", ENV["POSTGRES_USER"], RESTORED_DB])
    t0 = time.monotonic()
    run(["pg_restore", *pg_args(RESTORED_DB), "--no-owner", "--no-privileges",
         str(backup)], timeout=90)
    restored = snapshot(RESTORED_DB)
    restore_ms = round((time.monotonic()-t0)*1000, 2)
    REPORT["integridad"]["restauracion_verificada"] = before == restored
    REPORT["integridad"]["restauracion_ms"] = restore_ms
    print(f"RESTAURACION EN DB SEPARADA: {before==restored}, {restore_ms} ms", flush=True)
    backup.unlink(missing_ok=True)
    checks = [
        complete, REPORT["integridad"]["sin_cambios_tras_carga"],
        REPORT["integridad"]["sin_cambios_registros"],
        REPORT["integridad"]["restauracion_verificada"],
        REPORT["recuperacion"].get("disponibilidad_restaurada", False),
    ]
    all_200 = all(s["cumple_p95_2000ms"] for s in REPORT["etapas"])
    REPORT["conclusion"] = (
        "MEDICIONES COMPLETAS; rendimiento NO CUMPLE umbral de 2000 ms"
        if all(checks) and not all_200
        else "MEDICIONES COMPLETAS; criterios cumplidos" if all(checks)
        else "PRUEBAS PARCIALES / revisar integridad y recuperación"
    )
    return 1 if not all(checks) or not all_200 else 0

if __name__ == "__main__":
    rc = 2
    try:
        rc = main()
    except Exception as exc:
        REPORT["advertencias"].append(f"Error técnico del ensayo: {exc}")
        REPORT["conclusion"] = "INCOMPLETA: verificar el error técnico antes de interpretar resultados"
        print(f"[ERROR] {exc}", file=sys.stderr, flush=True)
    finally:
        (OUT/"resumen_34.json").write_text(json.dumps(REPORT, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
        try:
            make_visual()
        except Exception as exc:
            print(f"[AVISO] No se pudo construir panel visual: {exc}", file=sys.stderr)
        print(f"=== 3.4 | {REPORT['conclusion']} ===", flush=True)
        print("Panel:", OUT/"panel_3_4.html", flush=True)
        with Path(os.environ.get("GITHUB_STEP_SUMMARY","/dev/null")).open("a",encoding="utf-8") as fd:
            fd.write("### EP5 3.4: estrés escalonado y resiliencia\n")
            fd.write(f"**{REPORT['conclusion']}**\n\n")
            fd.write("| Usuarios | GET p95 ms | Error % | CPU pico % | RAM backend MiB |\n|---:|---:|---:|---:|---:|\n")
            for stage in REPORT["etapas"]:
                fd.write(f"| {stage['usuarios']} | {stage['get_pacientes']['p95_ms']} | {stage['tasa_error_pct']} | {stage['backend_cpu_pct_pico']} | {stage['backend_rss_pico_mib']} |\n")
            fd.write(f"\nReinicio API (ms): {REPORT.get('recuperacion',{}).get('api_restart_recuperacion_ms','no medido')}; "
                     f"integridad: {REPORT.get('integridad',{}).get('sin_cambios_registros','no medido')}. "
                     "Ensayo acotado, no certificación de RTO/RPO de producción.\n")
    sys.exit(rc)
