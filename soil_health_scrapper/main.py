import json
import logging
import json
import logging
import sys
from src.phone_scraper import test_phone_number
from src.html_scraper import fetch_html, get_random_headers
from src.html_extractor import parse_html_to_json

def get_soil_health_data(phone_number: str) -> dict:
    """
    Given an Indian phone number (e.g., +9198XXXXXXXX), process the pipeline:
    1. Phone check -> get computedID
    2. computedID -> fetch HTML
    3. HTML -> parse and extract JSON
    """
    logging.info(f"Checking phone number: {phone_number}")
    should_stop, result_data = test_phone_number(phone_number)
    
    if not should_stop:
        return {"error": "No valid data found for this phone number."}
        
    computed_id = None
    try:
        tests = result_data.get("data", {}).get("getTestForPortal", [])
        if tests and len(tests) > 0:
            computed_id = tests[0].get("computedID")
    except Exception:
        pass
        
    if not computed_id:
        return {"error": "Valid response received, but no computedID could be parsed.", "raw_response": result_data}
        
    logging.info(f"Retrieved computedID: {computed_id}. Fetching HTML form...")
    html_content = fetch_html(computed_id, get_random_headers())
    
    if not html_content:
        return {"error": f"Failed to fetch HTML or HTML was empty for computedID: {computed_id}"}
        
    logging.info(f"HTML retrieved. Extracting dynamic JSON...")
    extracted_data = parse_html_to_json(html_content)
    
    # We can also inject the computed_id or raw phone number if needed
    extracted_data["_metadata"] = {
        "phone_number": phone_number,
        "computedID": computed_id
    }
    
    return extracted_data

def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <phone_number>")
        print("Example: python main.py +9198XXXXXXXX")
        sys.exit(1)
        
    phone_number = sys.argv[1]
    result = get_soil_health_data(phone_number)
    
    print("\n--- EXTRACTED SOIL HEALTH DATA ---\n")
    print(json.dumps(result, indent=4, ensure_ascii=False))

if __name__ == "__main__":
    main()
