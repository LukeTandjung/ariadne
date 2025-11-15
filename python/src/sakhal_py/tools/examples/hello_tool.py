from pydantic import BaseModel
from returns.result import Result, Success, Failure

from sakhal_py.tools import ToolCall, ToolStruct


class HelloOutput(BaseModel):
    ok: bool = True
    message: str = ""
    error: str = ""

class HelloTool(ToolCall[HelloOutput]):
    @staticmethod
    def call() -> Result[HelloOutput, HelloOutput]:
        try:
            return Success(HelloOutput(ok=True, message="Hello from ToolCall!"))
        except Exception as e:
            return Failure(HelloOutput(ok=False, error=str(e)))

# Return ToolStruct 
def make_hello_tool() -> ToolStruct[HelloOutput]:
    return ToolStruct[HelloOutput](
        name="hello_tool",
        description="Returns a friendly greeting message.",
        call=HelloTool.call,
    )


if __name__ == "__main__":
    tool = make_hello_tool()
    res = tool.call()

    if isinstance(res, Success):
        data = res.unwrap()
        print("[OK]", data.message)
    else:
        err = res.failure()
        print("[ERR]", err.error)
