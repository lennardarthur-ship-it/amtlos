"""
E-199: Unterlagen für oder von Prüfern (Freigabe-Dateien, Bestätigungsblätter, Nachprüflisten, PDFs, Anlagen) gehören nicht
ins Repository. Jedes Werkzeug, das solche Unterlagen erzeugt, schreibt nur in einen Ordner bzw. eine Datei außerhalb des
Repositorys, der beim Aufruf genannt wird; ein Ziel im Repository wird abgelehnt (wie `--mail-ziel` in nachpruefliste.py, E-198).

    from ziel import ziel_ausserhalb
    ZIEL = ziel_ausserhalb(sys.argv[1] if len(sys.argv) > 1 else None, "Aufruf: … <ziel>")
"""
import os
import sys

ROOT = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))


def ziel_ausserhalb(pfad, aufruf="Ziel außerhalb des Repositorys angeben"):
    """Absoluter Pfad des Ziels; bricht ab, wenn keines genannt ist oder es im Repository liegt."""
    if not pfad:
        raise SystemExit(f"{aufruf} – Ziel fehlt (ein Ordner bzw. eine Datei außerhalb des Repositorys, E-199)")
    p = os.path.realpath(os.path.abspath(os.path.expanduser(pfad)))
    if os.path.commonpath([p, ROOT]) == ROOT:
        raise SystemExit(f"Ziel {p} liegt im Repository – Unterlagen für oder von Prüfern gehören nicht ins Projekt (E-199)")
    return p


if __name__ == "__main__":
    print(ziel_ausserhalb(sys.argv[1] if len(sys.argv) > 1 else None))
