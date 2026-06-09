import os
import importlib
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")

try:
    importlib.import_module("app.main")
    print("IMPORT_OK")
except Exception:
    traceback.print_exc()

