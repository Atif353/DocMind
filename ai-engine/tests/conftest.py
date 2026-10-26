import os

os.environ["INTERNAL_API_KEY"] = "test-key-" + "x" * 32
os.environ.setdefault("GEMINI_API_KEY", "")
