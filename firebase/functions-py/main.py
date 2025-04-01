import asyncio
import json
from firebase_functions import https_fn
from firebase_admin import initialize_app
from external.dead_simple_rag.document_manager import DocumentManager, FIRESTORE_SESSION_ID
from flask import Request, Response


app = initialize_app()


@https_fn.on_request()
def rag_ingest_documents(req: Request) -> Response:
    documents_str = req.args.get("document_locations")
    associated_ids_str = req.args.get("associated_ids")

    if documents_str is None:
        return Response("documents is required", status=400)
    if associated_ids_str is None:
        return Response("associated_ids is required", status=400)

    try:
        documents = json.loads(documents_str)
        associated_ids = json.loads(associated_ids_str)
    except json.JSONDecodeError:
        return Response(
            "Invalid JSON format for documents or associated_ids", status=400
        )

    if not isinstance(documents, list) or not all(
        isinstance(x, str) for x in documents
    ):
        return Response("documents must be a list of strings", status=400)
    if not isinstance(associated_ids, list) or not all(
        isinstance(x, str) for x in associated_ids
    ):
        return Response("associated_ids must be a list of strings", status=400)

    document_manager = DocumentManager(
        provider="google",
        vector_store_type="firestore",
    )
    try:
        result = asyncio.run(
            document_manager.ingest_documents(
                session_id=FIRESTORE_SESSION_ID,
                documents=documents,
                associated_ids=associated_ids,
            )
        )
        return Response(result, status=200)
    except Exception as e:
        return Response(f"Error: {str(e)}", status=500)


@https_fn.on_request()
def rag_query_documents(req: Request) -> Response:
    query = req.args.get("query")
    if query is None:
        return Response("query is required", status=400)

    document_manager = DocumentManager(
        provider="google",
        vector_store_type="firestore",
    )
    try:
        result = asyncio.run(
            document_manager.query_documents(
                session_id=FIRESTORE_SESSION_ID,
                query=query,
            )
        )
        return Response(json.dumps(result), status=200)
    except Exception as e:
        return Response(f"Error: {str(e)}", status=500)
