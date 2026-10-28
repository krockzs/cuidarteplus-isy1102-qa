#!/usr/bin/env python3
"""Resume LCOV observado sin alterar fuentes, métricas ni resultados."""
import csv,sys,pathlib
if len(sys.argv)!=3:
    raise SystemExit('Uso: mapa-cobertura.py lcov.info salida.csv')
p=pathlib.Path(sys.argv[1]);dest=pathlib.Path(sys.argv[2]);
if not p.is_file(): raise SystemExit(f'No existe {p}')
rows=[];current=None
for line in p.read_text(encoding='utf-8',errors='replace').splitlines():
    if line.startswith('SF:'):
        current={'archivo':line[3:].split('BACKEND/')[-1], 'lineas':0,'cubiertas':0,'ramas':0,'ramas_cubiertas':0,'funciones':0,'funciones_cubiertas':0}
    elif line.startswith('DA:') and current is not None:
        vals=line[3:].split(',');current['lineas']+=1;current['cubiertas']+=int(int(vals[1])>0)
    elif line.startswith('BRDA:') and current is not None:
        vals=line[5:].split(',');current['ramas']+=1;current['ramas_cubiertas']+=int(vals[3] not in ('-','0',''))
    elif line.startswith('FNDA:') and current is not None:
        vals=line[5:].split(',');current['funciones']+=1;current['funciones_cubiertas']+=int(int(float(vals[0]))>0)
    elif line=='end_of_record' and current is not None:
        current['sin_cubrir']=current['lineas']-current['cubiertas']
        current['cobertura_lineas_pct']=round(current['cubiertas']*100/max(1,current['lineas']),2)
        current['cobertura_ramas_pct']=round(current['ramas_cubiertas']*100/max(1,current['ramas']),2) if current['ramas'] else None
        rows.append(current);current=None
rows.sort(key=lambda r:(-r['sin_cubrir'],r['archivo']))
if not rows: raise SystemExit('LCOV sin archivos')
dest.parent.mkdir(parents=True,exist_ok=True)
with dest.open('w',encoding='utf-8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
lines=sum(r['lineas'] for r in rows);covered=sum(r['cubiertas'] for r in rows)
print(f'Archivos: {len(rows)} | Líneas: {covered}/{lines} = {covered/lines*100:.2f}%')
print('Principales brechas (líneas no cubiertas):')
for r in rows[:8]:print(f"  {r['sin_cubrir']:>4} | {r['cobertura_lineas_pct']:>5}% | {r['archivo']}")
print('Mapa CSV:',dest)
