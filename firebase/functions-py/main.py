import asyncio
import json
from firebase_functions import https_fn
from firebase_admin import initialize_app
from external.dead_simple_rag.document_manager import DocumentManager, FIRESTORE_SESSION_ID
from flask import Request, Response


app = initialize_app()


@https_fn.on_request()
def rag_ingest_documents(req: Request) -> Response:
    data = req.get_json()
    
    if data is None:
        return Response("Request body must be JSON", status=400)
        
    documents = data.get("document_locations")
    associated_doc_ids = data.get("associated_doc_ids")
    shared_list_id = data.get("shared_list_id")

    if documents is None:
        return Response("document_locations is required", status=400)
    if associated_doc_ids is None:
        return Response("associated_doc_ids is required", status=400)
    if shared_list_id is None:
        return Response("shared_list_id is required", status=400)

    # No need for JSON parsing since we're already getting parsed JSON
    if not isinstance(documents, list) or not all(isinstance(x, str) for x in documents):
        return Response("documents must be a list of strings", status=400)
    if not isinstance(associated_doc_ids, list) or not all(isinstance(x, str) for x in associated_doc_ids):
        return Response("associated_doc_ids must be a list of strings", status=400)

    document_manager = DocumentManager(
        provider="google",
        vector_store_type="firestore",
    )
    try:
        result = asyncio.run(
            document_manager.ingest_documents(
                session_id=FIRESTORE_SESSION_ID,
                documents=documents,
                associated_ids=associated_doc_ids,
                custom_metadata={"__shared_list_id": shared_list_id},
            )
        )
        return Response(result, status=200)
    except Exception as e:
        return Response(f"Error: {str(e)}", status=500)


@https_fn.on_request()
def rag_query_documents(req: Request) -> Response:
    query = req.args.get("query")
    shared_list_id = req.args.get("shared_list_id")

    if query is None:
        return Response("query is required", status=400)
    if shared_list_id is None:
        return Response("shared_list_id is required", status=400)

    document_manager = DocumentManager(
        provider="google",
        vector_store_type="firestore",
    )
    try:
        result = asyncio.run(
            document_manager.query_documents(
                session_id=FIRESTORE_SESSION_ID,
                query=query,
                filter={
                    "field": "metadata.__shared_list_id",
                    "op": "==",
                    "value": shared_list_id,
                },
            )
        )
        return Response(json.dumps(result), status=200)
    except Exception as e:
        return Response(f"Error: {str(e)}", status=500)
