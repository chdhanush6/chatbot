"""
CLI Interface for Dynamic Syllabus PDF Extraction System.
Can be invoked from Node.js, bash, PowerShell, or CI/CD pipelines.
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.syllabus_extractor import SyllabusExtractor

extractor = SyllabusExtractor()


def main():
    parser = argparse.ArgumentParser(description="Universal Syllabus PDF Extractor CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # index command
    idx_parser = subparsers.add_parser("index", help="Index courses in syllabus PDF")
    idx_parser.add_argument("pdf_path", help="Path to syllabus PDF file")

    # search command
    search_parser = subparsers.add_parser("search", help="Search course by code or title")
    search_parser.add_argument("pdf_path", help="Path to syllabus PDF file")
    search_parser.add_argument("query", help="Course code or title to search")

    # extract command
    ext_parser = subparsers.add_parser("extract", help="Extract standalone course PDF")
    ext_parser.add_argument("pdf_path", help="Path to syllabus PDF file")
    ext_parser.add_argument("course_query", help="Course code or title to extract")
    ext_parser.add_argument("output_path", help="Destination path for generated PDF")

    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(json.dumps({"error": f"File not found: {args.pdf_path}"}))
        sys.exit(1)

    try:
        index_data = extractor.index_document(args.pdf_path, os.path.basename(args.pdf_path))

        if args.command == "index":
            output = {
                "filename": index_data["filename"],
                "doc_hash": index_data["doc_hash"],
                "total_pages": index_data["total_pages"],
                "is_scanned": index_data["is_scanned"],
                "courses_count": len(index_data["courses"]),
                "courses": index_data["courses"]
            }
            print(json.dumps(output))

        elif args.command == "search":
            status, course, suggestions = extractor.find_course(index_data, args.query)
            output = {
                "status": status,
                "query": args.query,
                "course": course.to_dict() if course else None,
                "suggestions": suggestions
            }
            print(json.dumps(output))

        elif args.command == "extract":
            status, course, suggestions = extractor.find_course(index_data, args.course_query)
            if status != "EXACT_MATCH" or not course:
                output = {
                    "success": False,
                    "status": status,
                    "error": f"Course '{args.course_query}' not found as exact match.",
                    "suggestions": suggestions
                }
                print(json.dumps(output))
                sys.exit(2)

            os.makedirs(os.path.dirname(os.path.abspath(args.output_path)), exist_ok=True)
            pdf_bytes = extractor.extract_course_pdf(index_data, course, args.output_path)
            output = {
                "success": True,
                "status": "EXACT_MATCH",
                "course": course.to_dict(),
                "output_path": args.output_path,
                "file_size": len(pdf_bytes)
            }
            print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
