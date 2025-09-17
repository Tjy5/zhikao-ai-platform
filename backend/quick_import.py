import os
import importlib
import traceback

# Ensure a default DB so import won't fail if Postgres is missing
os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")

try:
    importlib.import_module("app.main")
    print("IMPORT_OK")
except Exception:
    traceback.print_exc()

