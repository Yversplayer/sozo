"""Point d'entrée de production : gunicorn wsgi:app (jamais le serveur de développement)."""
from app import creer_app

app = creer_app()
