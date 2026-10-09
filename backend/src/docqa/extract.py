"""PDF text extraction that keeps page numbers, turns ruled tables into rows, and OCRs scanned pages."""

from dataclasses import dataclass

import pymupdf


class PdfError(ValueError):
    """The upload cannot be turned into searchable text."""


@dataclass(frozen=True)
class Block:
    page: int
    text: str
    kind: str = "text"  # text | table


@dataclass(frozen=True)
class ExtractedPdf:
    title: str | None
    page_count: int
    blocks: list[Block]
    ocr_pages: int = 0


Rect = tuple[float, float, float, float]


def table_rows(cells: list[list[str | None]]) -> list[list[str]]:
    """Clean a pdf table: collapse whitespace, drop empty rows and columns (merged-cell padding)."""
    rows = [[" ".join((c or "").split()) for c in row] for row in cells]
    rows = [r for r in rows if any(r)]
    if not rows:
        return []
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    keep = [i for i in range(width) if any(r[i] for r in rows)]
    return [[r[i] for i in keep] for r in rows]


def is_real_table(rows: list[list[str]]) -> bool:
    """Ruled boxes around ordinary paragraphs come back as one-column 'tables'; real tables have columns."""
    if len(rows) < 2 or len(rows[0]) < 2:
        return False
    filled = sum(1 for r in rows if sum(1 for c in r if c) >= 2)
    return filled / len(rows) >= 0.5


def render_table(rows: list[list[str]]) -> str:
    return "\n".join("| " + " | ".join(r) + " |" for r in rows)


def _inside(block: Rect, area: Rect) -> bool:
    cx, cy = (block[0] + block[2]) / 2, (block[1] + block[3]) / 2
    return area[0] <= cx <= area[2] and area[1] <= cy <= area[3]


def _page_blocks(page: pymupdf.Page, index: int, tables: bool, textpage=None) -> list[Block]:
    placed: list[tuple[float, Block]] = []
    areas: list[Rect] = []
    if tables and textpage is None:
        for table in page.find_tables().tables:
            rows = table_rows(table.extract())
            if is_real_table(rows):
                areas.append(tuple(table.bbox))
                placed.append((table.bbox[1], Block(index, render_table(rows), "table")))
    for x0, y0, x1, y1, text, _no, kind in page.get_text("blocks", sort=True, textpage=textpage):
        cleaned = " ".join(text.split())
        if kind == 0 and cleaned and not any(_inside((x0, y0, x1, y1), a) for a in areas):
            placed.append((y0, Block(index, cleaned)))
    return [b for _, b in sorted(placed, key=lambda p: p[0])]


def extract_pdf(data: bytes, max_pages: int, ocr_max_pages: int = 0, tables: bool = True) -> ExtractedPdf:
    """`ocr_max_pages` caps how many image-only pages are OCRed (0 disables OCR)."""
    if not data.startswith(b"%PDF"):
        raise PdfError("The file is not a PDF.")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise PdfError("The PDF could not be opened; it may be corrupt.") from exc
    with doc:
        if doc.needs_pass:
            raise PdfError("The PDF is password protected.")
        if doc.page_count > max_pages:
            raise PdfError(f"The PDF has {doc.page_count} pages; the limit is {max_pages}.")
        blocks: list[Block] = []
        ocr_used, ocr_failed, scanned = 0, False, 0
        for index, page in enumerate(doc, start=1):
            page_blocks = _page_blocks(page, index, tables)
            if not page_blocks and page.get_images():
                scanned += 1
                if ocr_used < ocr_max_pages and not ocr_failed:
                    try:
                        textpage = page.get_textpage_ocr(dpi=200, full=True)
                        page_blocks = _page_blocks(page, index, tables, textpage)
                        ocr_used += 1
                    except RuntimeError:
                        ocr_failed = True  # Tesseract missing or misconfigured
            blocks.extend(page_blocks)
        title = (doc.metadata or {}).get("title") or None
        page_count = doc.page_count
    if not blocks:
        if scanned and ocr_failed:
            raise PdfError("No selectable text found, and OCR is not available on the server (Tesseract is missing).")
        if scanned and ocr_max_pages == 0:
            raise PdfError("No selectable text found. Scanned PDFs need OCR, which is turned off on this server.")
        raise PdfError("No selectable text found in this PDF.")
    return ExtractedPdf(title=title.strip() if title else None, page_count=page_count, blocks=blocks, ocr_pages=ocr_used)
