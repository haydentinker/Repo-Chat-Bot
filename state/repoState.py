from langchain.agents import AgentState

class RepoState(AgentState):
    repo_name: str