from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from app.models.schemas import Citation


@dataclass(frozen=True)
class AgentAnswer:
    answer: str
    confidence: str
    used_crewai: bool


class CorpMindCoordinator:
    def __init__(self, openai_api_key: str | None, model: str) -> None:
        self.openai_api_key = openai_api_key
        self.model = model

    def answer(self, question: str, matches: list[dict], citations: list[Citation]) -> AgentAnswer:
        if not matches:
            return AgentAnswer(
                answer="I could not find relevant evidence in the indexed documents.",
                confidence="low",
                used_crewai=False,
            )

        if self.openai_api_key:
            crew_answer = self._try_crewai_answer(question, matches)
            if crew_answer:
                return AgentAnswer(answer=crew_answer, confidence="high", used_crewai=True)

            direct_answer = self._direct_llm_answer(question, matches)
            if direct_answer:
                return AgentAnswer(answer=direct_answer, confidence="medium", used_crewai=False)

        return AgentAnswer(
            answer=self._extractive_answer(question, citations),
            confidence="medium" if citations else "low",
            used_crewai=False,
        )

    def _try_crewai_answer(self, question: str, matches: list[dict]) -> str | None:
        try:
            from crewai import Agent, Crew, Process, Task
        except Exception:
            return None

        context = self._format_context(matches)
        retrieval_agent = Agent(
            role="Retrieval Agent",
            goal="Select the evidence that directly answers the user's document question.",
            backstory="You are strict about grounding every claim in retrieved document passages.",
            allow_delegation=False,
            verbose=False,
        )
        synthesis_agent = Agent(
            role="Synthesis Agent",
            goal="Write a concise answer using only the retrieved evidence.",
            backstory="You produce clear enterprise-ready answers and avoid unsupported claims.",
            allow_delegation=False,
            verbose=False,
        )
        retrieval_task = Task(
            description=(
                "Review the retrieved passages and identify the facts relevant to this question:\n"
                f"{question}\n\nRetrieved passages:\n{context}"
            ),
            expected_output="A compact evidence brief with source ids.",
            agent=retrieval_agent,
        )
        synthesis_task = Task(
            description=(
                "Use the evidence brief to answer the question. "
                "Do not include facts that are not present in the retrieved passages."
            ),
            expected_output="A concise answer in 1 to 3 paragraphs.",
            agent=synthesis_agent,
            context=[retrieval_task],
        )
        crew = Crew(
            agents=[retrieval_agent, synthesis_agent],
            tasks=[retrieval_task, synthesis_task],
            process=Process.sequential,
            verbose=False,
        )
        try:
            result = crew.kickoff()
            return str(result).strip()
        except Exception:
            return None

    def _direct_llm_answer(self, question: str, matches: list[dict]) -> str | None:
        llm = ChatOpenAI(
            api_key=self.openai_api_key,
            model=self.model,
            temperature=0.1,
        )
        prompt = (
            "You are CorpMind, an enterprise document Q&A assistant. "
            "Answer only from the provided context. If the context is insufficient, say so.\n\n"
            f"Question: {question}\n\n"
            f"Context:\n{self._format_context(matches)}\n\n"
            "Answer:"
        )
        try:
            return llm.invoke(prompt).content.strip()
        except Exception:
            return None

    def _extractive_answer(self, question: str, citations: list[Citation]) -> str:
        snippets = [citation.snippet for citation in citations[:3]]
        joined = "\n\n".join(f"- {snippet}" for snippet in snippets)
        return (
            "I found relevant passages for your question, but no OpenAI key is configured, "
            "so I am returning an extractive answer from the retrieved sources:\n\n"
            f"{joined}"
        )

    def _format_context(self, matches: list[dict]) -> str:
        blocks: list[str] = []
        for index, match in enumerate(matches, start=1):
            metadata = match["metadata"]
            page = metadata.get("page") or "n/a"
            blocks.append(
                "[Source {index}] file={filename}, page={page}, chunk={chunk_id}, score={score}\n{text}".format(
                    index=index,
                    filename=metadata.get("filename", "unknown"),
                    page=page,
                    chunk_id=match["chunk_id"],
                    score=match["score"],
                    text=match["text"],
                )
            )
        return "\n\n".join(blocks)

