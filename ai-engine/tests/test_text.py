from app.services.text import chunk_pages, normalized_text, split_text


def test_normalized_text_removes_control_spacing() -> None:
    assert normalized_text("One\x00  two\r\n\r\n\r\nThree") == "One two\n\nThree"


def test_split_text_applies_overlap_without_losing_content() -> None:
    text = "Alpha sentence. Beta sentence. Gamma sentence. Delta sentence."
    chunks = split_text(text, size=30, overlap=8)
    assert len(chunks) > 1
    assert chunks[0].startswith("Alpha")
    assert chunks[-1].endswith("sentence.")


def test_chunk_pages_keeps_page_numbers() -> None:
    chunks = chunk_pages(
        [{"page": 1, "text": "First page."}, {"page": 2, "text": "Second page."}],
        size=400,
        overlap=20,
    )
    assert [chunk["page"] for chunk in chunks] == [1, 2]
