import asyncio
import traceback
import json
from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
from google.cloud.firestore import SERVER_TIMESTAMP
from external.dead_simple_rag.document_manager import (
    DocumentManager,
    FIRESTORE_SESSION_ID,
)
from flask import Request, Response
from pydantic import BaseModel
from typing import List
from ingest_annotations import MemexAnnotation, ingest_annotations
from ingest_documents import ingest_remote_documents

app = initialize_app()


class RagIngestDocumentsRequest(BaseModel):
    document_locations: List[str]
    associated_doc_ids: List[str]
    shared_list_id: str


@https_fn.on_request(timeout_sec=540)
def rag_ingest_documents(req: Request) -> Response:
    try:
        data = req.get_json()
        if data is None:
            return Response("Request body must be JSON", status=400)

        request_data = RagIngestDocumentsRequest(**data)

        if len(request_data.document_locations) == 0:
            return Response("document_locations must be a non-empty list", status=400)
        if len(request_data.associated_doc_ids) == 0:
            return Response("associated_doc_ids must be a non-empty list", status=400)
        if len(request_data.document_locations) != len(request_data.associated_doc_ids):
            return Response(
                "document_locations and associated_doc_ids must be the same length",
                status=400,
            )
        if len(request_data.shared_list_id) == 0:
            return Response("shared_list_id must be a non-empty string", status=400)

        db = firestore.client()

        async def on_full_content_available(source: str, full_content: str):
            db.collection("documentContent").add(
                {
                    "source": source,
                    "content": full_content,
                    "sharedListId": request_data.shared_list_id,
                    "createdWhen": SERVER_TIMESTAMP,
                }
            )

        document_manager = DocumentManager(
            provider="google",
            vector_store_type="firestore",
            on_full_content_available=on_full_content_available,
        )

        result = asyncio.run(
            ingest_remote_documents(
                document_manager=document_manager,
                document_locations=request_data.document_locations,
                associated_doc_ids=request_data.associated_doc_ids,
                shared_list_id=request_data.shared_list_id,
            )
        )
        return Response(result, status=200)
    except ValueError as e:
        # Log Pydantic validation error for debugging purposes
        print(e)
        return Response(f"Invalid request data", status=400)
    except Exception as e:
        print(traceback.format_exc())
        return Response(f"Error: {str(e)}", status=500)


class RagIngestMemexAnnotationsRequest(BaseModel):
    annotation_data: List[MemexAnnotation]
    shared_list_id: str


@https_fn.on_request(timeout_sec=540)
def rag_ingest_memex_annotations(req: Request) -> Response:
    try:
        data = req.get_json()
        if data is None:
            return Response("Request body must be JSON", status=400)

        request_data = RagIngestMemexAnnotationsRequest(**data)

        if len(request_data.annotation_data) == 0:
            return Response("annotation_data must be a non-empty list", status=400)
        if len(request_data.shared_list_id) == 0:
            return Response("shared_list_id must be a non-empty string", status=400)

        db = firestore.client()

        async def on_full_content_available(source: str, full_content: str):
            db.collection("documentContent").add(
                {
                    "source": source,
                    "content": full_content,
                    "sharedListId": request_data.shared_list_id,
                    "createdWhen": SERVER_TIMESTAMP,
                }
            )

        document_manager = DocumentManager(
            provider="google",
            vector_store_type="firestore",
            on_full_content_available=on_full_content_available,
        )

        result = asyncio.run(
            ingest_annotations(
                document_manager=document_manager,
                annotation_data=request_data.annotation_data,
                shared_list_id=request_data.shared_list_id,
                comment_length_threshold=50,
            )
        )
        return Response(result, status=200)
    except ValueError as e:
        # Log Pydantic validation error for debugging purposes
        print(e)
        return Response(f"Invalid request data", status=400)
    except Exception as e:
        print(traceback.format_exc())
        return Response(f"Error: {str(e)}", status=500)


class RagQueryDocumentsRequest(BaseModel):
    query: str
    shared_list_id: str


@https_fn.on_request()
def rag_query_documents(req: Request) -> Response:
    try:
        data = req.get_json()
        if data is None:
            return Response("Request body must be JSON", status=400)

        request_data = RagQueryDocumentsRequest(**data)

        if len(request_data.query) == 0:
            return Response("query must be a non-empty string", status=400)
        if len(request_data.shared_list_id) == 0:
            return Response("shared_list_id must be a non-empty string", status=400)

        document_manager = DocumentManager(
            provider="google",
            vector_store_type="firestore",
        )
        result = asyncio.run(
            document_manager.query_documents(
                session_id=FIRESTORE_SESSION_ID,
                query=request_data.query,
                filter={
                    "field": "metadata._shared_list_id",
                    "op": "==",
                    "value": request_data.shared_list_id,
                },
            )
        )
        return Response(json.dumps(result), status=200)
    except ValueError as e:
        # Log Pydantic validation error for debugging purposes
        print(e)
        return Response(f"Invalid request data", status=400)
    except Exception as e:
        print(traceback.format_exc())
        return Response(f"Error: {str(e)}", status=500)
