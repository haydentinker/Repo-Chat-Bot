from langchain.agents import create_agent
from tools.ragTool import search_mongo
from state.repoState import RepoState
from langgraph.checkpoint.memory import InMemorySaver
from dotenv import load_dotenv
load_dotenv()

ragAgent = create_agent(
    model="gpt-5-nano",
    tools=[search_mongo],
    system_prompt="You are a helpful coding assistant that can answer questions about GitHub repositories. You have access to the following tools: search_mongo. Always use search_mongo to retrieve information from the repository before answering, if the question is about repository code, files, or content. If you do not know the answer, say you do not know.",
    checkpointer=InMemorySaver(),

    )