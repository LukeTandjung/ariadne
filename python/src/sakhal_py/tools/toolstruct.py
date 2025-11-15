from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Generic, TypeVar
from pydantic import BaseModel
from returns.result import Result

T = TypeVar("T", bound=BaseModel)

@dataclass
class ToolStruct(Generic[T]):
    """
    Data class that describes a tool that an LLM agent can call.

    - name: The name of the tool.
    - description: A description that the LLM can ingest.
    - call: return Result[T, T] for type safety and error accumulation.
    """
    name: str
    description: str
    call: Callable[[], Result[T, T]]




