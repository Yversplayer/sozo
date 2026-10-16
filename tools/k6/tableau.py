# Tableau des paliers à partir des exports k6 (--summary-export).
import json, sys
etq, paliers = sys.argv[1], sys.argv[2:]
def cpu(p):
    try:
        v = [float(x) for x in open(f"resultats/cpu-{etq}-{p}.txt") if x.strip()]
        v = sorted(v)[len(v) // 4:]          # hors démarrage
        return f"{sum(v) / len(v):.0f} %" if v else "—"
    except FileNotFoundError:
        return "—"
print(f"| Utilisateurs | req/s | médiane | p90 | p95 | p99 | catalogue p95 | page lue p95 | connexion p95 | erreurs | dont 429 | contrôles | CPU serveur |")
print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
for p in paliers:
    try:
        m = json.load(open(f"resultats/{etq}-{p}.json"))["metrics"]
    except FileNotFoundError:
        continue
    d = m["http_req_duration"]; g = lambda k, s="p(95)": m.get(k, {}).get(s)
    f = lambda x: "—" if x is None else f"{x:.0f} ms"
    print(f"| {p} | {m['http_reqs']['rate']:.1f} | {f(d['med'])} | {f(d['p(90)'])} | {f(d['p(95)'])} | {f(d['p(99)'])} | "
          f"{f(g('http_req_duration{name:GET /api/catalogue}'))} | {f(g('http_req_duration{name:GET page gratuite}'))} | "
          f"{f(g('http_req_duration{name:POST /api/sessions}'))} | {m['http_req_failed']['value'] * 100:.2f} % | {m.get('refus_limitation_429', {}).get('count', 0)} | "
          f"{m['checks']['value'] * 100:.1f} % | {cpu(p)} |")
