"""
Parse uploaded documents (PDF / CSV / text) into plain text and, for CSV,
into structured rows. Used by the upload-enrichment flow.
"""
from __future__ import annotations
import csv
import io

_MAX_CHARS = 12000  # cap text fed downstream to keep AI calls bounded


def parse_document(filename: str, content: bytes) -> str:
    """Return a plain-text representation of the document."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text = _parse_pdf(content)
    elif name.endswith(".csv"):
        text = _csv_to_text(content)
    else:  # .txt, .md, or anything decodable
        text = content.decode("utf-8", errors="ignore")
    return text[:_MAX_CHARS].strip()


def csv_rows(filename: str, content: bytes) -> list[dict]:
    """Return CSV rows as dicts (empty list for non-CSV / unparsable files)."""
    if not (filename or "").lower().endswith(".csv"):
        return []
    try:
        text = content.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        return [row for row in reader][:300]
    except Exception:
        return []


def _parse_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages[:40]:  # cap pages
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception as exc:
        print(f"[upload] pdf parse error: {exc}")
        return ""


def _csv_to_text(content: bytes) -> str:
    try:
        text = content.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        lines = [", ".join(cell for cell in row if cell) for row in reader]
        return "\n".join(line for line in lines if line)[:_MAX_CHARS]
    except Exception:
        return ""
