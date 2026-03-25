from langchain.agents import create_agent
from tools.ragTool import search_mongo


agent = create_agent(
    model="gpt-5-nano",
    tools=[search_mongo],
    system_prompt="You are a helpful agent that can search a mongodb vector store which contains github repositories that have been ingested. Your job is to answer the user's questions regarding the repository. If you do not know the answer or cannot answer simply state that. "
    )