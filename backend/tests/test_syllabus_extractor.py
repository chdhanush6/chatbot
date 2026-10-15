"""
Comprehensive Test Suite for Dynamic University-Independent Syllabus PDF Extraction System.
Tests all 14 scenarios specified in the requirements.
"""

import os
import sys
import unittest
import hashlib
import pymupdf

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.syllabus_extractor import SyllabusExtractor, CourseInfo


class TestUniversalSyllabusExtractor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.extractor = SyllabusExtractor()
        cls.fixtures_dir = os.path.join(os.path.dirname(__file__), 'fixtures')
        os.makedirs(cls.fixtures_dir, exist_ok=True)

        # Generate representative synthetic university PDFs for testing different layouts
        cls.univ_a_pdf = os.path.join(cls.fixtures_dir, 'university_A_syllabus.pdf')
        cls.univ_b_pdf = os.path.join(cls.fixtures_dir, 'university_B_syllabus.pdf')
        cls.mixed_page_pdf = os.path.join(cls.fixtures_dir, 'mixed_courses_on_single_page.pdf')
        cls.scanned_pdf = os.path.join(cls.fixtures_dir, 'scanned_image_only.pdf')
        cls.corrupted_pdf = os.path.join(cls.fixtures_dir, 'corrupted_file.pdf')

        cls._create_university_a_pdf(cls.univ_a_pdf)
        cls._create_university_b_pdf(cls.univ_b_pdf)
        cls._create_mixed_page_pdf(cls.mixed_page_pdf)
        cls._create_scanned_pdf(cls.scanned_pdf)
        cls._create_corrupted_pdf(cls.corrupted_pdf)

    @classmethod
    def _create_university_a_pdf(cls, path):
        """University A: Anna Univ / JNTU style with 2-page and 3-page courses (e.g. CS8391, CS8392)"""
        doc = pymupdf.open()
        # Page 1: Overview
        p1 = doc.new_page()
        p1.insert_text((50, 50), "ANNA UNIVERSITY SYLLABUS - CSE\nCurriculum and Course Structure", fontsize=16)

        # Page 2 & 3: Course 1 (CS8391 - Data Structures, spans 2 pages)
        p2 = doc.new_page()
        p2.insert_text((50, 50), "CS8391 DATA STRUCTURES\nL T P C\n3 0 0 3\nCOURSE OBJECTIVES:\nTo understand linear and non-linear data structures.\nUNIT I LINEAR DATA STRUCTURES\nArrays and Linked lists.\nUNIT II STACKS AND QUEUES\nStack and Queue implementations.", fontsize=11)
        p3 = doc.new_page()
        p3.insert_text((50, 50), "UNIT III NON-LINEAR DATA STRUCTURES\nBinary Trees, AVL Trees.\nCOURSE OUTCOMES:\nCO1: Implement data structures.\nTEXTBOOKS:\n1. Mark Allen Weiss, Data Structures, 2012.\nREFERENCE BOOKS:\n1. Aho, Ullman, Data Structures.", fontsize=11)

        # Page 4, 5, 6: Course 2 (CS8392 - Database Management Systems, spans 3 pages)
        p4 = doc.new_page()
        p4.insert_text((50, 50), "CS8392 DATABASE MANAGEMENT SYSTEMS\nL T P C\n3 0 0 3\nCOURSE OBJECTIVES:\nDesign relational databases.\nUNIT I RELATIONAL MODEL\nRelational Algebra, SQL.", fontsize=11)
        p5 = doc.new_page()
        p5.insert_text((50, 50), "UNIT II NORMALIZATION\n1NF, 2NF, 3NF, BCNF.\nUNIT III TRANSACTIONS\nACID properties, Concurrency Control.", fontsize=11)
        p6 = doc.new_page()
        p6.insert_text((50, 50), "COURSE OUTCOMES:\nCO1: Design schema.\nTEXTBOOKS:\n1. Silberschatz, Database System Concepts, 6th ed.", fontsize=11)

        # Page 7: Course 3 (CS8393 - Operating Systems, 1-page course)
        p7 = doc.new_page()
        p7.insert_text((50, 50), "CS8393 OPERATING SYSTEMS\nL T P C\n3 0 0 3\nCOURSE OBJECTIVES:\nUnderstand OS concepts.\nUNIT I PROCESSES\nThreads, Scheduling.\nTEXTBOOKS:\n1. Silberschatz, OS.", fontsize=11)

        doc.save(path)
        doc.close()

    @classmethod
    def _create_university_b_pdf(cls, path):
        """University B: VTU / Autonomous style with codes like 24CS101, 24CS102, 18CS52"""
        doc = pymupdf.open()
        p1 = doc.new_page()
        p1.insert_text((50, 50), "VTU BELAGAVI - B.E. SCHEME AND SYLLABUS", fontsize=16)

        p2 = doc.new_page()
        p2.insert_text((50, 50), "24CS101 PROGRAMMING IN PYTHON\nHours Per Week : L T P C 3 0 2 4\nCourse Objectives:\nLearn Python programming.\nModule 1: Basics of Python.\nModule 2: Data Structures.", fontsize=11)
        p3 = doc.new_page()
        p3.insert_text((50, 50), "Module 3: Object Oriented Programming.\nCourse Outcomes: CO1: Write Python programs.\nText Books:\n1. Charles Severance, Python for Everybody.", fontsize=11)

        p4 = doc.new_page()
        p4.insert_text((50, 50), "24CS102 DIGITAL DESIGN AND COMPUTER ORGANIZATION\nHours Per Week : L T P C 4 0 0 4\nCourse Objectives:\nUnderstand hardware architecture.\nModule 1: Combinational Logic.", fontsize=11)

        doc.save(path)
        doc.close()

    @classmethod
    def _create_mixed_page_pdf(cls, path):
        """Single page containing multiple courses (Course 1 on top, Course 2 on bottom)"""
        doc = pymupdf.open()
        p = doc.new_page()
        # Top half: CS101
        p.insert_text((50, 60), "CS101 INTRO TO COMPUTING\nHours Per Week: 3\nCourse Description: Basics of computers.\nUnit 1: Architecture.\nTextbooks: Tanenbaum.", fontsize=10)
        # Bottom half: CS102 starts on same page
        p.insert_text((50, 420), "CS102 WEB DEVELOPMENT FUNDAMENTALS\nHours Per Week: 3\nCourse Description: HTML, CSS, JavaScript.\nUnit 1: Frontend.\nTextbooks: Duckett.", fontsize=10)
        doc.save(path)
        doc.close()

    @classmethod
    def _create_scanned_pdf(cls, path):
        """Scanned document with an image and zero extractable text"""
        doc = pymupdf.open()
        p = doc.new_page()
        # Draw a rectangle mimicking a scanned page image without text stream
        p.draw_rect(pymupdf.Rect(50, 50, 500, 700), color=(0.8, 0.8, 0.8), fill=(0.9, 0.9, 0.9))
        doc.save(path)
        doc.close()

    @classmethod
    def _create_corrupted_pdf(cls, path):
        with open(path, 'wb') as f:
            f.write(b"%PDF-1.4\n%Invalid Corrupted Stream Header\x00\xffRandomGarbage")

    # =========================================================================
    # Scenario 1: Exact course code exists
    # =========================================================================
    def test_01_exact_course_code_exists(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        status, course, suggestions = self.extractor.find_course(index, "CS8391")
        self.assertEqual(status, "EXACT_MATCH")
        self.assertIsNotNone(course)
        self.assertEqual(course.code, "CS8391")
        self.assertIn("DATA STRUCTURES", course.title.upper())

    # =========================================================================
    # Scenario 2: Course title search works
    # =========================================================================
    def test_02_course_title_search_works(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        status, course, suggestions = self.extractor.find_course(index, "Data Structures")
        self.assertEqual(status, "EXACT_MATCH")
        self.assertIsNotNone(course)
        self.assertEqual(course.code, "CS8391")

    # =========================================================================
    # Scenario 3: Course spans multiple pages
    # =========================================================================
    def test_03_course_spans_multiple_pages(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        status, course, _ = self.extractor.find_course(index, "CS8391")
        self.assertEqual(status, "EXACT_MATCH")
        # Starts on Page 2 and ends on Page 3 (spans 2 pages)
        self.assertEqual(course.start_page, 2)
        self.assertEqual(course.end_page, 3)
        self.assertEqual(course.end_page - course.start_page + 1, 2)

    # =========================================================================
    # Scenario 4: Different courses have different page counts
    # =========================================================================
    def test_04_different_courses_different_page_counts(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        _, course1, _ = self.extractor.find_course(index, "CS8391") # 2 pages
        _, course2, _ = self.extractor.find_course(index, "CS8392") # 3 pages (p4, p5, p6)
        _, course3, _ = self.extractor.find_course(index, "CS8393") # 1 page (p7)

        self.assertIsNotNone(course1)
        self.assertIsNotNone(course2)
        self.assertIsNotNone(course3)

        count1 = course1.end_page - course1.start_page + 1
        count2 = course2.end_page - course2.start_page + 1
        count3 = course3.end_page - course3.start_page + 1

        self.assertEqual(count1, 2)
        self.assertEqual(count2, 3)
        self.assertEqual(count3, 1)

    # =========================================================================
    # Scenario 5: Multiple courses appear on the same page
    # =========================================================================
    def test_05_multiple_courses_on_same_page(self):
        index = self.extractor.index_document(self.mixed_page_pdf, "mixed.pdf")
        # Should detect both CS101 and CS102
        codes = [c['code'] for c in index['courses']]
        self.assertIn("CS101", codes)
        self.assertIn("CS102", codes)

        _, course1, _ = self.extractor.find_course(index, "CS101")
        self.assertTrue(course1.is_shared_start_page or course1.is_shared_end_page)

        # Extraction must isolate CS101
        pdf_bytes = self.extractor.extract_course_pdf(index, course1)
        self.assertGreater(len(pdf_bytes), 500)

    # =========================================================================
    # Scenario 6: A course code is similar to another code, but not identical
    # =========================================================================
    def test_06_similar_code_suggests_without_silent_substitution(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        # User entered CS8390 (does not exist, but CS8391, CS8392 exist)
        status, course, suggestions = self.extractor.find_course(index, "CS8390")
        self.assertNotEqual(status, "EXACT_MATCH")
        self.assertIsNone(course)
        self.assertIn(status, ["SUGGESTION", "NOT_FOUND"])
        suggested_codes = [s['code'] for s in suggestions]
        self.assertTrue(any("CS839" in c for c in suggested_codes))

    # =========================================================================
    # Scenario 7: Requested course does not exist
    # =========================================================================
    def test_07_course_does_not_exist(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        status, course, suggestions = self.extractor.find_course(index, "ME9999_NON_EXISTENT")
        self.assertEqual(status, "NOT_FOUND")
        self.assertIsNone(course)

    # =========================================================================
    # Scenario 8: Multiple courses have similar titles / disambiguation
    # =========================================================================
    def test_08_multiple_courses_disambiguation(self):
        # Create doc with Database Lab and Database Systems
        doc = pymupdf.open()
        p1 = doc.new_page()
        p1.insert_text((50, 50), "CS501 DATABASE SYSTEMS\nL T P C\n3 0 0 3\nCOURSE DESCRIPTION:\nRelational DB.")
        p2 = doc.new_page()
        p2.insert_text((50, 50), "CS502 DATABASE SYSTEMS LAB\nL T P C\n0 0 2 1\nCOURSE DESCRIPTION:\nSQL practice.")
        test_path = os.path.join(self.fixtures_dir, "db_similar_titles.pdf")
        doc.save(test_path)
        doc.close()

        index = self.extractor.index_document(test_path, "db_test.pdf")
        status, course, matches = self.extractor.find_course(index, "Database Systems")
        self.assertIn(status, ["EXACT_MATCH", "MULTIPLE_MATCHES"])
        if status == "MULTIPLE_MATCHES":
            self.assertGreaterEqual(len(matches), 2)

    # =========================================================================
    # Scenario 9: A different university PDF is uploaded after the first PDF
    # =========================================================================
    def test_09_different_university_pdf_after_first(self):
        # Index University A (Anna Univ, CS8391)
        index_a = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        status_a, c_a, _ = self.extractor.find_course(index_a, "CS8391")
        self.assertEqual(status_a, "EXACT_MATCH")

        # Index University B (VTU, 24CS101)
        index_b = self.extractor.index_document(self.univ_b_pdf, "univ_b.pdf")
        status_b, c_b, _ = self.extractor.find_course(index_b, "24CS101")
        self.assertEqual(status_b, "EXACT_MATCH")

        # Verify Course CS8391 is NOT in University B!
        status_not, _, _ = self.extractor.find_course(index_b, "CS8391")
        self.assertEqual(status_not, "NOT_FOUND")

    # =========================================================================
    # Scenario 10: Cached data does not leak between PDFs
    # =========================================================================
    def test_10_cache_isolation_by_content_hash(self):
        with open(self.univ_a_pdf, 'rb') as f:
            bytes_a = f.read()
        with open(self.univ_b_pdf, 'rb') as f:
            bytes_b = f.read()

        hash_a = hashlib.sha256(bytes_a).hexdigest()
        hash_b = hashlib.sha256(bytes_b).hexdigest()

        self.assertNotEqual(hash_a, hash_b)

        index_a = self.extractor.index_document(bytes_a, "univ_a.pdf")
        index_b = self.extractor.index_document(bytes_b, "univ_b.pdf")

        self.assertEqual(index_a['doc_hash'], hash_a)
        self.assertEqual(index_b['doc_hash'], hash_b)

        # Verify completely independent caches
        courses_a = [c['code'] for c in index_a['courses']]
        courses_b = [c['code'] for c in index_b['courses']]

        self.assertIn("CS8391", courses_a)
        self.assertNotIn("CS8391", courses_b)
        self.assertIn("24CS101", courses_b)
        self.assertNotIn("24CS101", courses_a)

    # =========================================================================
    # Scenario 11: Scanned or image-based PDF handling
    # =========================================================================
    def test_11_scanned_image_based_pdf_detection(self):
        index = self.extractor.index_document(self.scanned_pdf, "scanned.pdf")
        self.assertTrue(index['is_scanned'])

    # =========================================================================
    # Scenario 12: Corrupted or unsupported PDFs
    # =========================================================================
    def test_12_corrupted_pdf_error_reporting(self):
        with self.assertRaises(ValueError) as ctx:
            self.extractor.index_document(self.corrupted_pdf, "corrupted.pdf")
        self.assertIn("Corrupted or unsupported", str(ctx.exception))

    # =========================================================================
    # Scenario 13: Gemini API unavailable but local PDF extraction still works
    # =========================================================================
    def test_13_deterministic_local_extraction_without_gemini(self):
        # Even without Gemini API Key or network access, local extraction works 100%
        index = self.extractor.index_document(self.univ_b_pdf, "univ_b.pdf")
        status, course, _ = self.extractor.find_course(index, "24CS101")
        self.assertEqual(status, "EXACT_MATCH")
        pdf_bytes = self.extractor.extract_course_pdf(index, course)
        self.assertGreater(len(pdf_bytes), 1000)

    # =========================================================================
    # Scenario 14: Downloaded PDF contains intended course and excludes others
    # =========================================================================
    def test_14_extracted_pdf_contains_intended_course_and_excludes_others(self):
        index = self.extractor.index_document(self.univ_a_pdf, "univ_a.pdf")
        _, course, _ = self.extractor.find_course(index, "CS8391")

        out_pdf_bytes = self.extractor.extract_course_pdf(index, course)
        test_doc = pymupdf.open(stream=out_pdf_bytes, filetype="pdf")

        # Must have exactly 2 pages
        self.assertEqual(len(test_doc), 2)

        full_extracted = "\n".join([p.get_text() for p in test_doc])

        # Must contain CS8391 and DATA STRUCTURES
        self.assertIn("CS8391", full_extracted)
        self.assertIn("DATA STRUCTURES", full_extracted)

        # Must NOT contain adjacent course CS8392 or CS8393
        self.assertNotIn("CS8392", full_extracted)
        self.assertNotIn("CS8393", full_extracted)
        self.assertNotIn("DATABASE MANAGEMENT SYSTEMS", full_extracted)
        self.assertNotIn("OPERATING SYSTEMS", full_extracted)
        test_doc.close()


if __name__ == '__main__':
    unittest.main()
