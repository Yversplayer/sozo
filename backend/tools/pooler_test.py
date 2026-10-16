"""Pooler PostgreSQL en MODE TRANSACTION, minimal — outil de TEST (tests/test_pooler.py).

Sert à prouver que Sōzō garde son isolation derrière Supavisor (Supabase,
port 6543), sans réseau ni compte Supabase. Jamais utilisé en production.

Reproduit la règle de PgBouncer/Supavisor en mode transaction : un client ne
garde une connexion serveur que le temps d'UNE transaction ; dès que le
serveur répond ReadyForQuery avec l'état « I » (hors transaction), la
connexion serveur retourne au pot et la suivante (FIFO) sert le prochain
client. Aucun nettoyage de l'état de session entre deux clients (comme
PgBouncer en mode transaction : server_reset_query n'y est pas joué).

    python pooler_test.py <dossier_socket_pg> <port> <taille> <search_path> [journal]
    POOL_MODE=session : la connexion serveur reste au client jusqu'à sa déconnexion.
"""
import asyncio
import struct
import sys

SOCK, PORT, TAILLE, SEARCH_PATH = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
pot = None
journal = open(sys.argv[5], "a") if len(sys.argv) > 5 else None
import os
MODE = os.environ.get("POOL_MODE", "transaction")


async def lire_msg(r):
    t = await r.readexactly(1)
    n = struct.unpack("!I", await r.readexactly(4))[0]
    return t, await r.readexactly(n - 4)


def msg(t, corps):
    return t + struct.pack("!I", len(corps) + 4) + corps


class Serveur:
    def __init__(self, r, w, pid):
        self.r, self.w, self.pid = r, w, pid


async def ouvrir_serveur():
    r, w = await asyncio.open_unix_connection(f"{SOCK}/.s.PGSQL.5432")
    params = b"user\0postgres\0database\0postgres\0options\0-c search_path=" + SEARCH_PATH.encode() + b"\0\0"
    corps = struct.pack("!I", 196608) + params
    w.write(struct.pack("!I", len(corps) + 4) + corps)
    pid = None
    while True:
        t, c = await lire_msg(r)
        if t == b"K":
            pid = struct.unpack("!I", c[:4])[0]
        if t == b"E":
            raise RuntimeError(c)
        if t == b"Z":
            return Serveur(r, w, pid)


async def client(r, w):
    # poignée de main côté client
    while True:
        n = struct.unpack("!I", await r.readexactly(4))[0]
        corps = await r.readexactly(n - 4)
        code = struct.unpack("!I", corps[:4])[0]
        if code in (80877103, 80877104):        # SSL / GSSENC : refusés
            w.write(b"N")
            await w.drain()
            continue
        break
    out = msg(b"R", struct.pack("!I", 0))
    for k, v in (("server_version", "16.0"), ("client_encoding", "UTF8"), ("server_encoding", "UTF8"),
                 ("DateStyle", "ISO, MDY"), ("integer_datetimes", "on"), ("standard_conforming_strings", "on"), ("TimeZone", "UTC")):
        out += msg(b"S", k.encode() + b"\0" + v.encode() + b"\0")
    out += msg(b"K", struct.pack("!II", 0, 0)) + msg(b"Z", b"I")
    w.write(out)
    await w.drain()
    s = None
    try:
        while True:
            try:
                t, c = await lire_msg(r)
            except asyncio.IncompleteReadError:
                break
            if t == b"X":
                break
            if s is None:
                s = await pot.get()
                if journal:
                    journal.write(f"client {id(w)} -> serveur {s.pid}\n")
                    journal.flush()
            s.w.write(msg(t, c))
            if t in (b"S", b"Q"):
                await s.w.drain()
                while True:
                    tt, cc = await lire_msg(s.r)
                    w.write(msg(tt, cc))
                    if tt == b"Z":
                        await w.drain()
                        if cc == b"I" and MODE == "transaction":          # fin de transaction : la connexion serveur repart au pot
                            pot.put_nowait(s)
                            s = None
                        break
    finally:
        if s is not None:                      # client parti en pleine transaction
            s.w.write(msg(b"Q", b"ROLLBACK\0"))
            await s.w.drain()
            while True:
                tt, cc = await lire_msg(s.r)
                if tt == b"Z":
                    break
            pot.put_nowait(s)
        w.close()


async def main():
    global pot
    pot = asyncio.Queue()
    for _ in range(TAILLE):
        pot.put_nowait(await ouvrir_serveur())
    srv = await asyncio.start_server(client, "127.0.0.1", PORT)
    print("pret", flush=True)
    async with srv:
        await srv.serve_forever()


asyncio.run(main())
