from __future__ import annotations
from dataclasses import dataclass, field
from math import sqrt
from typing import Tuple
from enum import Enum
import mlx.core as mx

class InitStrategy(Enum):
  He_Uniform = "he_uniform"
  He_Normal = "he_normal"
  Glorot_Uniform = "glorot_uniform"
  Glorot_Normal = "glorot_normal"
  LeCun_Uniform = "lecun_uniform"
  LeCun_Normal = "lecun_normnal"

@dataclass(slots=True)
class Array:
  rows: int
  cols: int
  data_type: mx.Dtype
  init_strategy: InitStrategy
  __value: mx.array = field(init=False)

  def __post_init__(self):
    # Allocation (all ones)
    match self.init_strategy:
      case InitStrategy.He_Uniform:
        self.__value = mx.random.uniform(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          low=-sqrt(6 / self.cols),
          high=sqrt(6 / self.cols)
        )

      case InitStrategy.He_Normal:
        self.__value = mx.random.normal(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          loc=0,
          scale=sqrt(2 / self.cols)
        )

      case InitStrategy.Glorot_Uniform:
        self.__value = mx.random.uniform(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          low=-sqrt(6 / (self.rows + self.cols)),
          high=sqrt(6 / (self.rows + self.cols))
        )

      case InitStrategy.Glorot_Normal:
        self.__value = mx.random.normal(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          loc=0,
          scale=sqrt(2 / (self.rows + self.cols))
        )

      case InitStrategy.LeCun_Uniform:
        self.__value = mx.random.uniform(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          low=-sqrt(3 / self.cols),
          high=sqrt(3 / self.cols)
        )

      case InitStrategy.LeCun_Normal:
        self.__value = mx.random.normal(
          shape=(self.rows, self.cols),
          dtype=self.data_type,
          loc=0,
          scale=sqrt(1 / self.cols)
        )

  # Lets wrapper behave like the underlying array
  def __getattr__(self, item):
    return getattr(self.__value, item)

  def __repr__(self):
    return f"OnesArray(shape={self.shape}, dtype={self.dtype}, value={self.__value})"
