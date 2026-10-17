"""
Code Duplication Detector for RepoMind Phase 5.

Implements a deterministic, normalized line-block duplication detector.
- Strips comments and blank lines.
- Normalizes whitespace.
- Uses rolling window block hashing (window size = 6 lines) to identify duplicate candidates.
- Merges adjacent windows to find maximal duplicate spans across files and within files.
- Provides file paths and line ranges for both sides of each duplicate block.
- Calculates total duplication ratio against analyzed lines of code.
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple

logger = logging.getLogger(__name__)

WINDOW_SIZE = 6
DUPLICATION_WARN_THRESHOLD = 5.0   # 5%
DUPLICATION_HIGH_THRESHOLD = 10.0  # 10%


@dataclass
class DuplicateBlock:
    file_a: str
    start_line_a: int
    end_line_a: int
    file_b: str
    start_line_b: int
    end_line_b: int
    duplicate_lines: int
    snippet_preview: str


@dataclass
class DuplicationReport:
    total_analyzed_lines: int
    total_duplicated_lines: int
    duplication_percentage: float
    duplicate_blocks: List[DuplicateBlock] = field(default_factory=list)


def _normalize_line(line: str) -> str:
    """Strip comments and normalize internal whitespace."""
    s = line.strip()
    # Remove single-line comments
    if s.startswith('#') or s.startswith('//'):
        return ''
    if s.startswith('/*') or s.startswith('*') or s.endswith('*/'):
        return ''
    # Collapse multiple whitespaces
    return ' '.join(s.split())


def detect_code_duplication(file_contents: Dict[str, str], min_lines: int = WINDOW_SIZE) -> DuplicationReport:
    """
    Detect duplicated code blocks across a dictionary of {file_path: source_code}.
    Returns a DuplicationReport with exact file paths, line ranges, and duplication percentage.
    """
    # 1. Clean & normalize lines per file
    # file_clean_lines[file] = [(original_1_idx_line_num, normalized_text)]
    file_clean_lines: Dict[str, List[Tuple[int, str]]] = {}
    file_orig_lines: Dict[str, List[str]] = {}
    total_analyzed_lines = 0

    for file_path, content in file_contents.items():
        raw_lines = content.splitlines()
        file_orig_lines[file_path] = raw_lines
        clean = []
        for idx, raw in enumerate(raw_lines, start=1):
            norm = _normalize_line(raw)
            if norm:
                clean.append((idx, norm))
        file_clean_lines[file_path] = clean
        total_analyzed_lines += len(clean)

    if total_analyzed_lines == 0:
        return DuplicationReport(
            total_analyzed_lines=0,
            total_duplicated_lines=0,
            duplication_percentage=0.0,
            duplicate_blocks=[],
        )

    # 2. Block hashing with rolling window
    # window_hash -> list of (file_path, start_orig_line, end_orig_line, clean_idx_start)
    block_index: Dict[str, List[Tuple[str, int, int, int]]] = {}

    for file_path, clean_list in file_clean_lines.items():
        if len(clean_list) < min_lines:
            continue

        for i in range(len(clean_list) - min_lines + 1):
            window = clean_list[i:i + min_lines]
            combined = '\n'.join(item[1] for item in window)
            h = hashlib.md5(combined.encode('utf-8')).hexdigest()

            orig_start = window[0][0]
            orig_end = window[-1][0]
            block_index.setdefault(h, []).append((file_path, orig_start, orig_end, i))

    # 3. Identify matches and merge contiguous blocks
    raw_matches: List[DuplicateBlock] = []
    duplicated_lines_by_file: Dict[str, Set[int]] = {fp: set() for fp in file_contents}

    seen_pairs: Set[Tuple[str, int, str, int]] = set()

    for h, occurrences in block_index.items():
        if len(occurrences) < 2:
            continue

        for i in range(len(occurrences)):
            for j in range(i + 1, len(occurrences)):
                occ_a = occurrences[i]
                occ_b = occurrences[j]

                file_a, start_a, end_a, idx_a = occ_a
                file_b, start_b, end_b, idx_b = occ_b

                # If within the same file, prevent overlapping windows
                if file_a == file_b and abs(idx_a - idx_b) < min_lines:
                    continue

                pair_key = (file_a, start_a, file_b, start_b)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                # Record duplicated original line numbers
                clean_a = file_clean_lines[file_a]
                for k in range(idx_a, min(idx_a + min_lines, len(clean_a))):
                    duplicated_lines_by_file[file_a].add(clean_a[k][0])

                clean_b = file_clean_lines[file_b]
                for k in range(idx_b, min(idx_b + min_lines, len(clean_b))):
                    duplicated_lines_by_file[file_b].add(clean_b[k][0])

                # Build a short snippet preview from file A
                orig_a = file_orig_lines[file_a]
                preview = '\n'.join(orig_a[max(0, start_a - 1):min(len(orig_a), start_a + 3)])

                raw_matches.append(DuplicateBlock(
                    file_a=file_a,
                    start_line_a=start_a,
                    end_line_a=end_a,
                    file_b=file_b,
                    start_line_b=start_b,
                    end_line_b=end_b,
                    duplicate_lines=min_lines,
                    snippet_preview=preview,
                ))

    # 4. Consolidate overlapping / adjacent blocks
    # Group by (file_a, file_b) and sort by start lines
    consolidated_blocks: List[DuplicateBlock] = []
    raw_matches.sort(key=lambda m: (m.file_a, m.file_b, m.start_line_a, m.start_line_b))

    for m in raw_matches:
        if not consolidated_blocks:
            consolidated_blocks.append(m)
            continue

        last = consolidated_blocks[-1]
        # Check if adjacent or overlapping on both file A and file B
        if (last.file_a == m.file_a and last.file_b == m.file_b and
                m.start_line_a <= last.end_line_a + 2 and
                m.start_line_b <= last.end_line_b + 2):
            # Merge
            last.end_line_a = max(last.end_line_a, m.end_line_a)
            last.end_line_b = max(last.end_line_b, m.end_line_b)
            last.duplicate_lines = (last.end_line_a - last.start_line_a + 1)
        else:
            consolidated_blocks.append(m)

    # Calculate actual non-overlapping duplicated lines
    total_duplicated_lines = sum(len(lines) for lines in duplicated_lines_by_file.values())
    duplication_percentage = round((total_duplicated_lines / max(1, total_analyzed_lines)) * 100, 2)

    # Sort largest duplicate blocks first
    consolidated_blocks.sort(key=lambda b: b.duplicate_lines, reverse=True)

    return DuplicationReport(
        total_analyzed_lines=total_analyzed_lines,
        total_duplicated_lines=total_duplicated_lines,
        duplication_percentage=duplication_percentage,
        duplicate_blocks=consolidated_blocks[:25],  # Cap reported top instances
    )
