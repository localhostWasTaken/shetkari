"""
AI Farm Analyst — API Entry Point
==============================
Exposes a FastAPI endpoint to generate farm advisory reports.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from analyst.engine import analyse
from models.inputs import AnalyseRequest

app = FastAPI(
    title="AI Farm Analyst API",
    description="Generates multilingual farm advisory reports using Google Gemini.",
    version="1.0.0",
)

@app.post("/api/v1/analyse")
def process_analysis(request: AnalyseRequest):
    """
    Generate an AI Farm Analyst report based on soil, weather, and crop data.
    The response is returned in the language specified by `expected_language`.
    """
    report = analyse(
        soil=request.soil,
        weather=request.weather,
        crop=request.crop,
        expected_language=request.expected_language,
    )
    
    return report

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
