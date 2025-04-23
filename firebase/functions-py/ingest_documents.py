from typing import List
from external.dead_simple_rag.content_analysis_utils import (
    perform_concurrent_analysis_over_mixed_docs,
)
from external.dead_simple_rag.document_manager import (
    DocumentManager,
    FIRESTORE_SESSION_ID,
)


async def ingest_remote_documents(
    document_manager: DocumentManager,
    document_locations: List[str],
    associated_doc_ids: List[str],
    shared_list_id: str,
):
    # First process all content into langchain documents
    docs = await document_manager.process_content_into_documents(
        document_locations=document_locations,
        associated_ids=associated_doc_ids,
        custom_metadata={"_shared_list_id": shared_list_id},
    )

    analysis_docs = await perform_concurrent_analysis_over_mixed_docs(
        document_manager=document_manager,
        docs=docs,
        custom_metadata={"_shared_list_id": shared_list_id},
    )

    # Finally write all produced docs to vector store
    return await document_manager.ingest_documents(
        session_id=FIRESTORE_SESSION_ID,
        docs=[*docs, *analysis_docs],
    )
