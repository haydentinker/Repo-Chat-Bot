from langchain.tools import tool, ToolRuntime
from langgraph.types import Command
from langchain.messages import ToolMessage

@tool
def update_repo_name(repo_name: str, runtime: ToolRuntime) -> Command:
    """Update the current repo_name that is used to filter the mongo vector store when searching for context"""
    return Command(
        update={
            "repo_name": repo_name,
            "messages": [
                ToolMessage(
                    content=f"Successfully updated repo_name to: {repo_name}",
                    tool_call_id=runtime.tool_call_id
                )
            ]
        }
    )