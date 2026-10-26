from pydantic import BaseModel, ConfigDict, Field


class ProcessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(min_length=1, max_length=128)
    file_path: str = Field(min_length=1, max_length=4096)
    doc_title: str | None = Field(default=None, max_length=255)


class QueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=4000)
    doc_id: str | None = Field(default=None, max_length=128)
    doc_title: str = Field(default="All Documents", max_length=255)
    allowed_doc_ids: list[str] = Field(min_length=1, max_length=1000)
