from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, TypeVar
from functools import reduce

T = TypeVar("T")

class ApproxMonoid[T](ABC):
  """This base type describes a set that is equiped with a binary operation such that...
  - an identity element exists
  - it is associative\n
  but there are no strong guarentees that it is closed. You will see that it is implemented
  exactly like how a monoid is; but for rigour I have chosen to reflect this in the class naming."""

  @staticmethod
  @abstractmethod
  def identity() -> ApproxMonoid[T]:
    pass

  @abstractmethod
  def operation(self, right_element: ApproxMonoid[T]) -> ApproxMonoid[T]:
    pass

  @classmethod
  def array_operation(cls, values: List[ApproxMonoid[T]]) -> ApproxMonoid[T]:
    """ Unlike Haskell which uses a right-fold implementation, we implement
    the array operation as a left-fold. It makes more sense as an array which
    goes from left to right"""

    return reduce(lambda x, y: x.operation(y), values)
