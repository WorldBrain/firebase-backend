from pydantic import BaseModel, Field, field_validator
from pydantic_core.core_schema import FieldValidationInfo
from typing import Optional, List
from datetime import datetime
from langchain_core.documents import Document
from external.dead_simple_rag.document_manager import (
    DocumentManager,
    FIRESTORE_SESSION_ID,
)
from external.dead_simple_rag.rag_utils import ContentType
from bs4 import BeautifulSoup


class MemexAnnotation(BaseModel):
    id: str = Field(..., min_length=1)
    creator: str = Field(..., min_length=1)
    normalized_page_url: str = Field(..., min_length=1)
    body: Optional[str] = None
    comment: Optional[str] = None
    created_when: int
    updated_when: int

    @field_validator("created_when", "updated_when")
    def validate_timestamps(cls, v):
        if v > int(datetime.now().timestamp()):
            raise ValueError("Timestamp cannot be in the future")
        return v

    @field_validator("updated_when")
    def validate_update_time(cls, v, info: FieldValidationInfo):
        if info.data.get("created_when") is not None and v < info.data["created_when"]:
            raise ValueError("updated_when cannot be before created_when")
        return v


async def ingest_annotations(
    document_manager: DocumentManager,
    annotation_data: List[MemexAnnotation],
    shared_list_id: str,
    comment_length_threshold: int = 50,
) -> str:
    """Ingest annotations into the RAG system.

    Args:
        document_manager: The document manager to use to ingest the annotations.
        annotation_data: The list of annotations to ingest.
        shared_list_id: The shared list ID to which the annotations belong.
        comment_length_threshold: Annotation comments that are shorter than this threshold will not be ingested.

    Returns:
        A string indicating the success or failure of the ingestion.
    """
    docs: List[Document] = []

    def append_doc(content: str, annot: MemexAnnotation):
        docs.append(
            Document(
                page_content=content,
                metadata={
                    "source": annot.normalized_page_url,
                    "__associated_id": annot.id,
                    "__content_type": "memex_annotation",
                    "__shared_list_id": shared_list_id,
                    "creator": annot.creator,
                    "created_when": annot.created_when,
                    "updated_when": annot.updated_when,
                },
            )
        )

    for annot in annotation_data:
        if annot.body is not None and len(annot.body) > 0:
            append_doc(annot.body, annot)

        if annot.comment is not None:
            cleaned_comment, image_url = _extract_img_url_from_comment(annot.comment)

            # Only index the comment if it's long enough after cleaning
            if len(cleaned_comment) > comment_length_threshold:
                append_doc(cleaned_comment, annot)

            if image_url:
                docs.extend(
                    await document_manager.process_content_into_documents(
                        [image_url],
                        associated_ids=[annot.id],
                        custom_metadata={
                            "source": annot.normalized_page_url,
                            "__associated_id": annot.id,
                            "__content_type": ContentType.IMAGE.value,
                            "__shared_list_id": shared_list_id,
                            "creator": annot.creator,
                            "created_when": annot.created_when,
                            "updated_when": annot.updated_when,
                        },
                    )
                )

    return await document_manager.ingest_documents(
        session_id=FIRESTORE_SESSION_ID,
        docs=docs,
    )


def _extract_img_url_from_comment(comment: str) -> tuple[str, Optional[str]]:
    """Attempts to extract any image URL from an annotation comment.

    Args:
        comment: The annotation comment string to process.

    Returns:
        A tuple containing:
        - The cleaned comment text with image tag removed.
        - The image URL if found, None otherwise
    """
    if not comment:  # Handle empty string
        return "", None

    try:
        soup = BeautifulSoup(comment, "html.parser")
        img_tag = soup.find("img")
        image_url = None

        if img_tag:
            image_url = img_tag.get("src")
            img_tag.decompose()  # Removes the img tag from the original text too

        return str(soup), image_url

    except Exception:
        return comment, None
