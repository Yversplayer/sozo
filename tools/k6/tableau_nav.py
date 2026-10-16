# Comparatif navigateur : temps jusqu'au contenu utile et données téléchargées.
import glob, json, os
lignes = []
for f in sorted(glob.glob("resultats/nav-*-*.jsonl")):
    for l in open(f):
        l = l.strip()
        if l:
            lignes.append(json.loads(l))
etapes = []
for r in lignes:
    k = (r["passage"], r["etape"])
    if k not in etapes:
        etapes.append(k)
for profil in ("bon", "3g", "3g-lente", "2g"):
    sous = [r for r in lignes if r["profil"] == profil]
    if not sous:
        continue
    print(f"\n### Profil : {profil}\n")
    print("| Passage | Étape | Avant : temps | Avant : données | Après : temps | Après : données |")
    print("|---|---|---|---|---|---|")
    tot = {"avant": [0, 0], "apres": [0, 0]}
    for p, e in etapes:
        val = {}
        for etq in ("avant", "apres"):
            r = next((x for x in sous if x["etq"] == etq and x["passage"] == p and x["etape"] == e), None)
            val[etq] = r
            if r:
                tot[etq][0] += r["secondes"]; tot[etq][1] += r["ko"]
        f = lambda r, k, u: "—" if not r else (f"{r[k]:.1f} {u}" if k == "secondes" else f"{r[k]:.0f} {u}")
        print(f"| {p} | {e} | {f(val['avant'], 'secondes', 's')} | {f(val['avant'], 'ko', 'Ko')} | {f(val['apres'], 'secondes', 's')} | {f(val['apres'], 'ko', 'Ko')} |")
    print(f"| **Total** | parcours complet | {tot['avant'][0]:.1f} s | {tot['avant'][1]:.0f} Ko | {tot['apres'][0]:.1f} s | {tot['apres'][1]:.0f} Ko |")
