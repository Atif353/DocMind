import re
from collections.abc import Iterable


def normalized_text(value: str) -> str:
    value = value.replace("\x00", " ").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def split_text(value: str, size: int, overlap: int) -> list[str]:
    text = normalized_text(value)
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        target = min(start + size, len(text))
        end = target
        if target < len(text):
            floor = start + max(size // 2, 1)
            candidates = [
                text.rfind("\n\n", floor, target),
                text.rfind(". ", floor, target),
                text.rfind("\n", floor, target),
                text.rfind(" ", floor, target),
            ]
            boundary = max(candidates)
            if boundary > start:
                end = boundary + (2 if text[boundary : boundary + 2] in {"\n\n", ". "} else 1)

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def chunk_pages(pages: Iterable[dict], size: int, overlap: int) -> list[dict]:
    chunks: list[dict] = []
    for page in pages:
        for text in split_text(str(page["text"]), size, overlap):
            chunks.append({"text": text, "page": int(page["page"])})
    return chunks
