"""
Dynamic, University-Independent Syllabus PDF Extraction System.
Detects course boundaries, extracts exact course syllabi, and generates standalone course PDFs
across different university layouts, regulations, and course-code conventions.
"""

import os
import re
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import pymupdf  # PyMuPDF
import pypdf
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


# Universal Regex for course codes across universities:
# Examples: 25CS101, 24CS102, CS8391, 18CS52, CS101, CS-101, CSE-201, IT302, MA8151, COMP1010
COURSE_CODE_REGEX = re.compile(
    r'\b([0-9]{2}[A-Za-z]{2,5}[0-9]{2,5}[A-Za-z]?|[A-Za-z]{2,5}[-\s]?[0-9]{3,5}[A-Za-z]?)\b'
)

# Universal Structural Anchor Keywords found in syllabus course entries across universities
SYLLABUS_ANCHORS = [
    'HOURS PER WEEK', 'HOURS/WEEK', 'L T P C', 'L-T-P-C', 'L:T:P:C', 'CREDITS',
    'COURSE DESCRIPTION', 'COURSE OBJECTIVES', 'PREREQUISITE', 'COURSE OUTCOMES',
    'MODULE-1', 'MODULE 1', 'UNIT-1', 'UNIT 1', 'UNIT I', 'UNIT-I', 'CHAPTER 1',
    'TEXTBOOKS', 'TEXT BOOKS', 'REFERENCE BOOKS', 'LEARNING OUTCOMES', 'SYLLABUS'
]


class CourseInfo:
    def __init__(
        self,
        code: str,
        title: str,
        start_page: int,
        end_page: int,
        is_shared_start_page: bool = False,
        is_shared_end_page: bool = False,
        start_y: float = 0.0,
        end_y: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None,
        extracted_text: str = ""
    ):
        self.code = code.strip().upper()
        self.title = title.strip()
        self.start_page = start_page  # 1-indexed
        self.end_page = end_page      # 1-indexed
        self.is_shared_start_page = is_shared_start_page
        self.is_shared_end_page = is_shared_end_page
        self.start_y = start_y        # Y-coordinate on start page (points from top)
        self.end_y = end_y            # Y-coordinate on end page
        self.metadata = metadata or {}
        self.extracted_text = extracted_text

    def to_dict(self) -> Dict[str, Any]:
        return {
            'code': self.code,
            'title': self.title,
            'start_page': self.start_page,
            'end_page': self.end_page,
            'page_count': self.end_page - self.start_page + 1,
            'is_shared_page': self.is_shared_start_page or self.is_shared_end_page,
            'metadata': self.metadata
        }


class SyllabusExtractor:
    def __init__(self):
        # Cache indexed by document SHA-256 hash for total document isolation
        self._cache: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def compute_hash(file_bytes: bytes) -> str:
        """Compute SHA-256 hash of file content for unique, isolated indexing."""
        return hashlib.sha256(file_bytes).hexdigest()

    def index_document(self, file_path_or_bytes: Any, file_name: str = "document.pdf") -> Dict[str, Any]:
        """
        Analyze and index all courses and page boundaries dynamically.
        Works across different university syllabus layouts without hardcoded patterns.
        """
        if isinstance(file_path_or_bytes, bytes):
            file_bytes = file_path_or_bytes
            doc_hash = self.compute_hash(file_bytes)
            if doc_hash in self._cache:
                return self._cache[doc_hash]
            try:
                doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            except Exception as e:
                raise ValueError(f"Corrupted or unsupported PDF document: {str(e)}")
        else:
            if not os.path.exists(file_path_or_bytes):
                raise FileNotFoundError(f"File not found: {file_path_or_bytes}")
            with open(file_path_or_bytes, 'rb') as f:
                file_bytes = f.read()
            doc_hash = self.compute_hash(file_bytes)
            if doc_hash in self._cache:
                return self._cache[doc_hash]
            try:
                doc = pymupdf.open(file_path_or_bytes)
            except Exception as e:
                raise ValueError(f"Corrupted or unsupported PDF document: {str(e)}")

        total_pages = len(doc)
        if total_pages == 0:
            raise ValueError("The uploaded PDF has 0 pages or is empty.")

        # Check for encrypted PDF
        if doc.is_encrypted:
            raise ValueError("The PDF document is encrypted or password-protected.")

        # Check for scanned / image-only PDF
        total_text_len = 0
        pages_text: List[str] = []
        for p in doc:
            t = p.get_text()
            pages_text.append(t)
            total_text_len += len(t.strip())

        is_scanned = total_text_len < (total_pages * 30)

        # Dynamic Course Header Detection
        candidates: List[Dict[str, Any]] = []

        for page_idx in range(total_pages):
            page_num = page_idx + 1
            page = doc[page_idx]
            
            # Extract text blocks with bounding boxes: (x0, y0, x1, y1, "text", block_no, block_type)
            blocks = page.get_text("blocks")
            page_text = pages_text[page_idx].upper()

            # Check for structural syllabus anchors on this page
            has_syllabus_anchor = any(anchor in page_text for anchor in SYLLABUS_ANCHORS)
            if not has_syllabus_anchor:
                continue

            # Look through blocks on this page for course code + title headings
            for b_idx, block in enumerate(blocks):
                b_text = block[4].strip()
                b_lines = [ln.strip() for ln in b_text.split('\n') if ln.strip()]
                if not b_lines:
                    continue

                EXCLUDE_CODE_PREFIXES = {
                    'IEEE', 'ISO', 'RFC', 'PAGE', 'PP', 'FIG', 'VOL', 'NO', 'AND',
                    'THE', 'FOR', 'WITH', 'UNIT', 'SEC', 'ISBN', 'ISSN', 'HTTP', 'WWW'
                }

                for line in b_lines:
                    matches = list(COURSE_CODE_REGEX.finditer(line))
                    if not matches:
                        continue

                    for m in matches:
                        code_candidate = m.group(1).replace(' ', '').replace('-', '').upper()
                        # Avoid non-course code prefixes
                        if any(code_candidate.startswith(pfx) for pfx in EXCLUDE_CODE_PREFIXES):
                            continue

                        # Verify candidate looks like a course code (2-4 letters, 2-5 digits)
                        has_letters = bool(re.search(r'[A-Za-z]', code_candidate))
                        has_digits = bool(re.search(r'[0-9]', code_candidate))
                        if not (has_letters and has_digits):
                            continue

                        # Avoid common false positives like "ISO9001", "COVID19", page numbers, table of contents lines with page refs
                        if len(code_candidate) < 4 or len(code_candidate) > 10:
                            continue

                        # A true course heading occurs at the start of a line or after Course Code: prefix
                        m_start = re.match(
                            r'^\s*(?:(?:Course|Subject)\s*(?:Code|No|Title)?\s*[:\-]\s*)?' + re.escape(m.group(0)) + r'\b',
                            line,
                            re.IGNORECASE
                        )
                        if not m_start:
                            continue

                        # Extract Title: either remaining text on line, or subsequent line
                        title = line.replace(m.group(1), '').strip(' :-–—\t')
                        if len(title) < 3 and len(b_lines) > 1:
                            # Try next line in block
                            curr_line_idx = b_lines.index(line)
                            if curr_line_idx + 1 < len(b_lines):
                                next_line = b_lines[curr_line_idx + 1].strip(' :-–—\t')
                                if len(next_line) >= 3 and not COURSE_CODE_REGEX.search(next_line):
                                    title = next_line

                        # Clean Title
                        title = re.sub(r'\s+', ' ', title).strip()
                        # If title is in UPPERCASE or Title Case, clean it up
                        if not title:
                            title = f"Course {code_candidate}"

                        candidates.append({
                            'code': code_candidate,
                            'title': title,
                            'page_num': page_num,
                            'y0': block[1],
                            'y1': block[3],
                            'block_idx': b_idx,
                            'line': line
                        })

        # Filter out duplicates and table of contents entries:
        # Detailed syllabus pages occur where anchor keywords (e.g. Course Description, Module 1, Units)
        # appear in close proximity to the heading.
        valid_courses: List[Dict[str, Any]] = []
        seen_codes: Dict[str, Dict[str, Any]] = {}

        for cand in candidates:
            code = cand['code']
            p_text = pages_text[cand['page_num'] - 1].upper()
            
            # Score whether this page is a detailed syllabus page
            detail_indicators = ['COURSE DESCRIPTION', 'OBJECTIVES', 'PREREQUISITE', 'MODULE-1', 'UNIT-1', 'L T P C', 'L-T-P-C', 'HOURS PER WEEK']
            detail_score = sum(1 for ind in detail_indicators if ind in p_text)
            
            # If we haven't seen this code yet or this occurrence has a stronger syllabus detail score
            if code not in seen_codes:
                cand['score'] = detail_score
                seen_codes[code] = cand
                valid_courses.append(cand)
            elif detail_score > seen_codes[code].get('score', 0):
                # Replace with the actual detailed syllabus page
                valid_courses.remove(seen_codes[code])
                cand['score'] = detail_score
                seen_codes[code] = cand
                valid_courses.append(cand)

        # Sort courses by page number and vertical position on page
        valid_courses.sort(key=lambda c: (c['page_num'], c['y0']))

        # Determine start and end boundaries for each course dynamically
        course_objects: List[CourseInfo] = []
        num_courses = len(valid_courses)

        for i in range(num_courses):
            curr = valid_courses[i]
            code = curr['code']
            title = curr['title']
            start_page = curr['page_num']
            start_y = curr['y0']

            if i + 1 < num_courses:
                next_c = valid_courses[i + 1]
                if next_c['page_num'] == start_page:
                    # Multiple courses on the SAME page!
                    end_page = start_page
                    end_y = next_c['y0']
                    is_shared_start = (i > 0 and valid_courses[i-1]['page_num'] == start_page)
                    is_shared_end = True
                else:
                    # Course spans to page before next course starts, or ends on next course's start page
                    if next_c['y0'] > 150:
                        # Next course starts lower on page, so current course continues onto next_c's page top
                        end_page = next_c['page_num']
                        end_y = next_c['y0']
                        is_shared_start = (i > 0 and valid_courses[i-1]['page_num'] == start_page)
                        is_shared_end = True
                    else:
                        end_page = next_c['page_num'] - 1
                        end_y = doc[end_page - 1].rect.height if end_page <= total_pages else 0.0
                        is_shared_start = (i > 0 and valid_courses[i-1]['page_num'] == start_page)
                        is_shared_end = False
            else:
                # Last course in syllabus: spans to end of syllabus section or +2 pages
                remaining_pages = total_pages - start_page
                span = min(remaining_pages, 3)
                end_page = start_page + span
                end_y = doc[end_page - 1].rect.height if end_page <= total_pages else 0.0
                is_shared_start = (i > 0 and valid_courses[i-1]['page_num'] == start_page)
                is_shared_end = False

            # Trim trailing blank filler pages and structural cover/divider pages backwards
            while end_page > start_page:
                trailing_text = pages_text[end_page - 1].strip()
                upper_trailing = trailing_text.upper()

                # Rule 1: Structural cover / divider / TOC pages listing multiple courses
                # A single course syllabus page never lists 3 or more distinct course codes!
                code_cnt = len(re.findall(r'\b[0-9]{2}[A-Z]{2,4}[0-9]{2,4}\b', upper_trailing))
                is_cover = any(k in upper_trailing for k in [
                    'Y  E  A  R', 'COURSE CONTENTS', 'DEPARTMENT ELECTIVES',
                    'DEPT. ELECTIVES', 'OPEN ELECTIVES'
                ]) and (code_cnt >= 1 or len(trailing_text) < 600)

                if code_cnt >= 3 or is_cover:
                    end_page -= 1
                    is_shared_end = False
                    end_y = doc[end_page - 1].rect.height if end_page <= total_pages else 0.0
                    continue

                # Rule 2: If the page contains real syllabus content markers, STOP trimming!
                has_syllabus = any(k in upper_trailing for k in [
                    'UNIT', 'MODULE',
                    'HOURS PER WEEK', 'PREREQUISITE', 'COURSE DESCRIPTION',
                    'COURSE OBJECTIVES', 'COURSE OBJECTIVE',
                    'COURSE OUTCOMES', 'COURSE OUTCOME',
                    'TEXT BOOK', 'TEXTBOOK', 'TEXTBOOKS',
                    'REFERENCE BOOK', 'REFERENCE BOOKS',
                    'PRACTICES', 'EXPERIMENT',
                    'BLOOMS LEVEL', "BLOOM'S LEVEL", 'MAPPING WITH POS',
                    'SUSTAINABLE DEVELOPMENT GOALS', 'SDG'
                ])
                if has_syllabus:
                    # Page contains actual course syllabus content! Stop trimming.
                    break

                # Rule 3: Blank filler page or header/footer only without syllabus content
                if len(trailing_text) < 150:
                    end_page -= 1
                    is_shared_end = False
                    end_y = doc[end_page - 1].rect.height if end_page <= total_pages else 0.0
                    continue

                # Not a cover, not blank, no syllabus markers - stop
                break


            # Extract full text of this course's pages for metadata and fallback
            course_text_parts = []
            for p_num in range(start_page, end_page + 1):
                if p_num <= total_pages:
                    course_text_parts.append(pages_text[p_num - 1])
            course_full_text = "\n\n".join(course_text_parts)

            c_info = CourseInfo(
                code=code,
                title=title,
                start_page=start_page,
                end_page=end_page,
                is_shared_start_page=is_shared_start,
                is_shared_end_page=is_shared_end,
                start_y=start_y,
                end_y=end_y,
                extracted_text=course_full_text
            )
            course_objects.append(c_info)

        index_result = {
            'doc_hash': doc_hash,
            'filename': file_name,
            'total_pages': total_pages,
            'is_scanned': is_scanned,
            'courses': [c.to_dict() for c in course_objects],
            '_course_objects': course_objects,
            '_file_bytes': file_bytes
        }

        self._cache[doc_hash] = index_result
        return index_result

    def find_course(
        self,
        doc_index: Dict[str, Any],
        query: str
    ) -> Tuple[str, Optional[CourseInfo], List[Dict[str, Any]]]:
        """
        Find exact course by code or title with suggestions and disambiguation.
        Returns:
          (status, course_info, suggestions)
          status can be: 'EXACT_MATCH', 'MULTIPLE_MATCHES', 'SUGGESTION', 'NOT_FOUND'
        """
        if not query or not query.strip():
            return ('NOT_FOUND', None, [])

        clean_q = query.strip()
        norm_q = re.sub(r'[^a-zA-Z0-9]', '', clean_q).upper()
        courses: List[CourseInfo] = doc_index.get('_course_objects', [])

        # 1. Exact Course Code Match (e.g. 25CS101, 24CS101, CS8391)
        exact_code_matches = [
            c for c in courses 
            if re.sub(r'[^a-zA-Z0-9]', '', c.code).upper() == norm_q
        ]
        if len(exact_code_matches) == 1:
            return ('EXACT_MATCH', exact_code_matches[0], [])
        elif len(exact_code_matches) > 1:
            return ('MULTIPLE_MATCHES', None, [c.to_dict() for c in exact_code_matches])

        # 2. Exact Title Match
        q_title_norm = clean_q.lower().strip()
        exact_title_matches = [
            c for c in courses 
            if c.title.lower().strip() == q_title_norm
        ]
        if len(exact_title_matches) == 1:
            return ('EXACT_MATCH', exact_title_matches[0], [])
        elif len(exact_title_matches) > 1:
            return ('MULTIPLE_MATCHES', None, [c.to_dict() for c in exact_title_matches])

        # 3. Partial or Substring Match (e.g. user typed "Programming in C")
        partial_matches = [
            c for c in courses 
            if q_title_norm in c.title.lower() or c.title.lower() in q_title_norm
        ]
        if len(partial_matches) == 1:
            return ('EXACT_MATCH', partial_matches[0], [])
        elif len(partial_matches) > 1:
            return ('MULTIPLE_MATCHES', None, [c.to_dict() for c in partial_matches])

        # 4. Fuzzy Code Suggestions (e.g., user typed 25CS10 or 22CS101)
        suggestions: List[Dict[str, Any]] = []
        for c in courses:
            c_norm = re.sub(r'[^a-zA-Z0-9]', '', c.code).upper()
            if norm_q in c_norm or c_norm in norm_q:
                suggestions.append(c.to_dict())
            elif len(norm_q) >= 4 and len(c_norm) >= 4:
                # Check character overlap ratio
                overlap = sum(1 for a, b in zip(norm_q, c_norm) if a == b)
                if overlap >= min(len(norm_q), len(c_norm)) - 2:
                    suggestions.append(c.to_dict())

        if suggestions:
            # Sort suggestions by relevance
            return ('SUGGESTION', None, suggestions[:5])

        return ('NOT_FOUND', None, [c.to_dict() for c in courses[:6]])

    def extract_course_pdf(
        self,
        doc_index: Dict[str, Any],
        course: CourseInfo,
        output_path: Optional[str] = None
    ) -> bytes:
        """
        Generate a downloadable PDF containing ONLY the selected course syllabus.
        - If the pages are exclusive to the course: extracts original PDF pages directly,
          preserving 100% vector graphics, fonts, formatting, tables, and images.
        - If a page contains multiple courses: uses PyMuPDF bounding rect isolation
          or clean ReportLab reconstruction to exclude foreign courses.
        """
        file_bytes = doc_index.get('_file_bytes')
        if not file_bytes:
            raise ValueError("Source document bytes missing from index.")

        src_doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        total_src_pages = len(src_doc)

        start_p = max(1, min(course.start_page, total_src_pages))
        end_p = max(start_p, min(course.end_page, total_src_pages))

        # Check if any pages are shared with adjacent courses
        if not course.is_shared_start_page and not course.is_shared_end_page:
            # Perfect clean extraction: Extract exact original PDF pages directly!
            out_doc = pymupdf.open()
            # PyMuPDF uses 0-indexed page numbers
            out_doc.insert_pdf(src_doc, from_page=start_p - 1, to_page=end_p - 1)
            pdf_bytes = out_doc.tobytes(deflate=True)
            out_doc.close()
            src_doc.close()

            if output_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(pdf_bytes)
            return pdf_bytes

        # If pages are shared with other courses: isolate only this course's content
        # Option A: Crop PyMuPDF pages to bounding box
        try:
            out_doc = pymupdf.open()
            out_doc.insert_pdf(src_doc, from_page=start_p - 1, to_page=end_p - 1)

            # Crop start page if other course appeared above it
            if course.is_shared_start_page and course.start_y > 50:
                p0 = out_doc[0]
                rect = p0.rect
                new_rect = pymupdf.Rect(rect.x0, max(rect.y0, course.start_y - 10), rect.x1, rect.y1)
                p0.set_cropbox(new_rect)

            # Crop end page if another course begins on it
            if course.is_shared_end_page and course.end_y > 50 and len(out_doc) > 0:
                last_p = out_doc[-1]
                rect = last_p.rect
                new_rect = pymupdf.Rect(rect.x0, rect.y0, rect.x1, min(rect.y1, course.end_y + 10))
                last_p.set_cropbox(new_rect)

            pdf_bytes = out_doc.tobytes(deflate=True)
            out_doc.close()
            src_doc.close()

            if output_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
                with open(output_path, 'wb') as f:
                    f.write(pdf_bytes)
            return pdf_bytes

        except Exception as e:
            # Fallback to ReportLab Reconstruction
            src_doc.close()
            return self._reconstruct_course_pdf(course, output_path)

    def _reconstruct_course_pdf(self, course: CourseInfo, output_path: Optional[str] = None) -> bytes:
        """Fallback reconstruction using ReportLab for complex mixed-page layouts."""
        from io import BytesIO
        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'CourseTitle',
            parent=styles['Heading1'],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor('#1E3A8A'),
            spaceAfter=12
        )
        body_style = ParagraphStyle(
            'CourseBody',
            parent=styles['Normal'],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#1F2937'),
            spaceAfter=8
        )

        elements = []
        elements.append(Paragraph(f"<b>{course.code}: {course.title}</b>", title_style))
        elements.append(Spacer(1, 10))

        lines = [line.strip() for line in course.extracted_text.split('\n') if line.strip()]
        for line in lines:
            safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if re.match(r'^(MODULE|UNIT|COURSE OBJECTIVES|COURSE OUTCOMES|TEXTBOOKS|REFERENCE)', safe_line, re.I):
                elements.append(Spacer(1, 6))
                elements.append(Paragraph(f"<b>{safe_line}</b>", styles['Heading3']))
            else:
                elements.append(Paragraph(safe_line, body_style))

        doc.build(elements)
        pdf_bytes = buf.getvalue()

        if output_path:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with open(output_path, 'wb') as f:
                f.write(pdf_bytes)

        return pdf_bytes
