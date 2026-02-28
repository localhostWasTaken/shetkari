import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from soil_health.phone_scraper import test_phone_number
from soil_health.html_scraper import fetch_html, get_random_headers
from soil_health.html_extractor import parse_html_to_json

router = APIRouter()
logger = logging.getLogger(__name__)


class SoilHealthRequest(BaseModel):
    phone_number: str
    """Indian mobile number, e.g. '+919812345678'"""


@router.post("")
def get_soil_health(request: SoilHealthRequest) -> dict:
    """
    Given an Indian phone number, return the parsed Soil Health Card data.

    Pipeline:
    1. Phone number → GraphQL lookup → computedID
    2. computedID → fetch HTML report
    3. HTML → structured JSON extract
    """
    phone = request.phone_number
    logger.info("Checking phone number: %s", phone)

    should_stop, result_data = test_phone_number(phone)

    if not should_stop:
        raise HTTPException(status_code=404, detail="No valid soil health data found for this phone number.")

    computed_id = None
    try:
        tests = result_data.get("data", {}).get("getTestForPortal", [])
        if tests:
            computed_id = tests[0].get("computedID")
    except Exception:
        pass

    if not computed_id:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Valid response received but no computedID could be parsed.",
                "raw_response": result_data,
            },
        )

    html_content = fetch_html(computed_id, get_random_headers())
    if not html_content:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch HTML report for computedID: {computed_id}",
        )

    extracted = parse_html_to_json(html_content)
    extracted["_metadata"] = {"phone_number": phone, "computedID": computed_id}
    return extracted
