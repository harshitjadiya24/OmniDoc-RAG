import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from src.docqa.summarize import summarize_document
from src.llm.providers import chat_model
from src.config import settings

llm = chat_model("ollama", settings, summarize=True)
summary, q = summarize_document(llm, "Agentic AI", "The document provides a comprehensive survey of Agentic AI, an emerging paradigm in artificial intelligence that focuses on autonomous systems capable of pursuing complex goals with minimal human intervention. It explores the foundational concepts, unique characteristics, and methodologies of Agentic AI, its applications in various fields such as healthcare, finance, and adaptive software systems, and the ethical challenges associated with its deployment. The paper also outlines a framework for integrating Agentic AI into society while addressing issues like goal alignment, resource constraints, and environmental adaptability. " * 100)

print(summary)
