import asyncio
import itertools
from typing import List, Dict
from collections import defaultdict
from langchain_core.documents import Document
from external.dead_simple_rag.content_analysis import DEFAULT_ANALYSIS_STAGES
from external.dead_simple_rag.content_types import ContentType
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
        custom_metadata={"__shared_list_id": shared_list_id},
    )

    # Group produced docs by source then content type, for doing content-based meta-analysis
    docs_by_source: Dict[str, Dict[ContentType, List[Document]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for doc in docs:
        source = doc.metadata.get("source", "unknown")
        content_type = ContentType(
            doc.metadata.get("_content_type", ContentType.UNSUPPORTED.value)
        )
        docs_by_source[source][content_type].append(doc)

    # Do content-based meta-analysis for each content type in parallel
    analysis_tasks = [
        document_manager.analyze_documents(
            docs=docs,
            analysis_type=analysis_stage,
        )
        for content_type_docs in docs_by_source.values()
        for content_type, docs in content_type_docs.items()
        for analysis_stage in DEFAULT_ANALYSIS_STAGES[content_type]
    ]

    analysis_results = await asyncio.gather(*analysis_tasks)
    analysis_docs = list(itertools.chain.from_iterable(analysis_results))

    # Finally write all docs to vector store
    return await document_manager.ingest_documents(
        session_id=FIRESTORE_SESSION_ID,
        docs=[*docs, *analysis_docs],
    )
