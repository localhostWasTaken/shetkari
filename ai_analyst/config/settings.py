"""
Application settings loaded from environment variables.

Put your GEMINI_API_KEY in the .env file at the root of ai_analyst/.
"""

import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY: str = os.environ["GEMINI_API_KEY"]

# Model to use. Supports structured output (response_json_schema).
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
