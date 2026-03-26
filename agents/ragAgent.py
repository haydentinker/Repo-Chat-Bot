from langchain.agents import create_agent
from tools.ragTool import search_mongo
from tools.updateRepoStateTool import update_repo_name
from state.repoState import RepoState
from langgraph.checkpoint.memory import InMemorySaver

ragAgent = create_agent(
    model="gpt-5-nano",
    tools=[search_mongo, update_repo_name],
    system_prompt="You are a helpful agent that can search a mongodb vector store which contains github repositories that have been ingested. Your job is to answer the user's questions regarding the repository. If you do not know the answer or cannot answer simply state that. ",
    state_schema = RepoState,
    checkpointer=InMemorySaver(),

    )