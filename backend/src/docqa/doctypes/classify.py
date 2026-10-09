"""Rule-based document type detection. Transparent by design: it reports the phrases it matched."""

import re
from collections.abc import Iterable
from dataclasses import dataclass, field

from src.docqa.extract import Block

DOC_TYPES = ("contract", "research_paper", "financial_report", "regulation", "manual", "other")

_RAW: dict[str, list[str]] = {
    "regulation": [
        r"reserve bank of india",
        r"securities and exchange board",
        r"master directions?",
        r"\bdirections?,? (?:19|20)\d\d",
        r"\bcircular\b",
        r"\bnotification\b",
        r"in exercise of the powers",
        r"regulated entit(?:y|ies)",
        r"shall come into (?:force|effect)",
        r"\bregulations?,? (?:19|20)\d\d",
        r"\bhereby (?:directs|notifies|issues)",
        r"\bact,? (?:19|20)\d\d",
        r"\bcompliance\b",
    ],
    "contract": [
        r"this agreement",
        r"\bby and between\b",
        r"\bentered into\b",
        r"\bhereinafter\b",
        r"\bwhereas\b",
        r"in witness whereof",
        r"governing law",
        r"\bindemnif\w*",
        r"\bthe parties\b",
        r"\b(?:lessor|lessee|licensor|licensee|landlord|tenant|buyer|seller|vendor|contractor)\b",
        r"\btermination\b",
        r"\bconfidential information\b",
        r"\bsignature\b",
    ],
    "research_paper": [
        r"\babstract\b",
        r"\bintroduction\b",
        r"\brelated work\b",
        r"\bmethod(?:s|ology)\b",
        r"\bexperiments?\b",
        r"\bresults\b",
        r"\bconclusions?\b",
        r"\breferences\b",
        r"\bet al\.",
        r"\barxiv\b",
        r"\bdoi\b",
        r"\bproceedings\b",
        r"\bdataset\b",
        r"\bhypothes[ie]s\b",
    ],
    "financial_report": [
        r"annual report",
        r"balance sheet",
        r"profit (?:and|&) loss",
        r"cash flows?",
        r"\brevenue\b",
        r"\bebitda\b",
        r"fiscal (?:year|20\d\d)",
        r"net (?:income|profit)",
        r"total assets",
        r"auditor'?s report",
        r"earnings per share",
        r"\b(?:crore|lakh|million|billion)\b",
        r"\bdividend\b",
        r"\bshareholders?\b",
    ],
    "manual": [
        r"user (?:manual|guide)",
        r"\binstallation\b",
        r"\btroubleshooting\b",
        r"\bstep \d",
        r"\bwarning\b",
        r"\bcaution\b",
        r"\bpress (?:the )?\w+ button",
        r"\bclick\b",
        r"\bspecifications\b",
        r"\bmodel (?:no|number)\b",
        r"\bfirmware\b",
        r"\bmaintenance\b",
        r"\bsafety instructions\b",
    ],
}
_PATTERNS = {kind: [re.compile(p, re.IGNORECASE) for p in pats] for kind, pats in _RAW.items()}
MIN_SCORE = 3
SAMPLE_PAGES = 3


@dataclass(frozen=True)
class Classification:
    doc_type: str
    confidence: float
    signals: list[str] = field(default_factory=list)


def _sample(blocks: Iterable[Block]) -> str:
    return "\n".join(b.text for b in blocks if b.page <= SAMPLE_PAGES)


def classify(blocks: list[Block], filename: str = "") -> Classification:
    """Score each type by how many of its distinctive phrases appear in the opening pages."""
    text = f"{filename.replace('_', ' ')}\n{_sample(blocks)}"
    scores: dict[str, int] = {}
    found: dict[str, list[str]] = {}
    for kind, patterns in _PATTERNS.items():
        hits = [m.group(0).lower() for p in patterns if (m := p.search(text))]
        scores[kind], found[kind] = len(hits), hits
    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values())
    if scores[best] < MIN_SCORE:
        return Classification("other", 0.0, [])
    return Classification(best, round(scores[best] / total, 2), found[best][:6])
