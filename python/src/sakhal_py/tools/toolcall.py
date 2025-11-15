from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from pydantic import BaseModel
from returns.result import Result

T = TypeVar("T", bound=BaseModel)

class ToolCall(ABC, Generic[T]):
    """Abstract base class for tool implementations."""
    @staticmethod
    @abstractmethod
    def call() -> Result[T, T]:
        raise NotImplementedError
    
    
    
    
