from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import main


def test_safe_upload_path_rejects_paths_outside_upload_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    outside = tmp_path / "outside.pdf"
    outside.write_bytes(b"%PDF-")
    monkeypatch.setattr(main, "settings", SimpleNamespace(upload_dir=upload_root))

    with pytest.raises(HTTPException) as error:
        main.safe_upload_path(str(outside))

    assert error.value.status_code == 403
