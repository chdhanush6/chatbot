"""
FastAPI Server for Dynamic, University-Independent Syllabus PDF Extraction & AI Assistant.
"""

import os
import io
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .syllabus_extractor import SyllabusExtractor, CourseInfo

app = FastAPI(
    title="Universal Syllabus AI Assistant & Course PDF Extractor",
    description="Dynamic extraction of course syllabi and standalone PDF generation across universities.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

extractor = SyllabusExtractor()

# Active document state
active_document_hash: Optional[str] = None
active_document_name: Optional[str] = None

# Pre-index default workspace PDF if available
DEFAULT_PDF = "R25 C25 CSE Course Structure & Syllabus.pdf"
if os.path.exists(DEFAULT_PDF):
    try:
        idx = extractor.index_document(DEFAULT_PDF, DEFAULT_PDF)
        active_document_hash = idx['doc_hash']
        active_document_name = DEFAULT_PDF
        print(f"[FastAPI] Pre-indexed workspace document: {DEFAULT_PDF} ({len(idx['courses'])} courses)")
    except Exception as e:
        print(f"[FastAPI] Could not pre-index default PDF: {e}")


class SearchRequest(BaseModel):
    query: str
    doc_hash: Optional[str] = None


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Universal Syllabus Extraction API",
        "active_document": active_document_name,
        "has_active_doc": active_document_hash is not None
    }


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload any university syllabus PDF and dynamically index all courses."""
    global active_document_hash, active_document_name

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for course syllabus extraction.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        index_result = extractor.index_document(content, file.filename)
        active_document_hash = index_result['doc_hash']
        active_document_name = file.filename

        return {
            "message": "Syllabus PDF processed and indexed successfully",
            "filename": file.filename,
            "doc_hash": index_result['doc_hash'],
            "total_pages": index_result['total_pages'],
            "is_scanned": index_result['is_scanned'],
            "courses_count": len(index_result['courses']),
            "courses": index_result['courses']
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/courses")
def get_courses(doc_hash: Optional[str] = None):
    """List all detected courses in the active or specified document."""
    target_hash = doc_hash or active_document_hash
    if not target_hash or target_hash not in extractor._cache:
        raise HTTPException(status_code=404, detail="No syllabus document is currently loaded or indexed.")

    idx = extractor._cache[target_hash]
    return {
        "filename": idx['filename'],
        "doc_hash": target_hash,
        "total_pages": idx['total_pages'],
        "courses_count": len(idx['courses']),
        "courses": idx['courses']
    }


@app.post("/api/courses/search")
def search_course(req: SearchRequest):
    """
    Search for a course by code or title.
    Returns status: EXACT_MATCH, MULTIPLE_MATCHES, SUGGESTION, or NOT_FOUND.
    """
    target_hash = req.doc_hash or active_document_hash
    if not target_hash or target_hash not in extractor._cache:
        raise HTTPException(status_code=404, detail="No syllabus document is loaded. Please upload a PDF first.")

    idx = extractor._cache[target_hash]
    status, course, suggestions = extractor.find_course(idx, req.query)

    return {
        "status": status,
        "query": req.query,
        "course": course.to_dict() if course else None,
        "suggestions": suggestions
    }


@app.get("/api/courses/{course_code}/download")
def download_course_pdf(course_code: str, doc_hash: Optional[str] = None):
    """
    Generate and download a standalone PDF containing ONLY the selected course syllabus.
    Preserves original vector formatting, tables, images, and text.
    """
    target_hash = doc_hash or active_document_hash
    if not target_hash or target_hash not in extractor._cache:
        raise HTTPException(status_code=404, detail="No document is active.")

    idx = extractor._cache[target_hash]
    status, course, suggestions = extractor.find_course(idx, course_code)

    if status != "EXACT_MATCH" or not course:
        if suggestions:
            suggest_names = ", ".join([f"{s['code']} ({s['title']})" for s in suggestions[:3]])
            raise HTTPException(
                status_code=404,
                detail=f"Course '{course_code}' not found as an exact match. Did you mean: {suggest_names}?"
            )
        raise HTTPException(status_code=404, detail=f"Course '{course_code}' was not found in the uploaded syllabus PDF.")

    try:
        pdf_bytes = extractor.extract_course_pdf(idx, course)
        safe_code = "".join(c for c in course.code if c.isalnum() or c in ('-', '_'))
        filename = f"{safe_code}_Syllabus.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate course PDF: {str(e)}")
