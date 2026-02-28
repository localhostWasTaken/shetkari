import requests
import random
import json
import sys
import logging
from typing import Optional, Dict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

URL = 'https://soilhealth4.dac.gov.in/'

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
]

GRAPHQL_HTML_QUERY = """
query GetTestForPortal($locale: String, $computedId: String) {
  getTestForPortal(computedID: $computedId) {
    html(locale: $locale)
    __typename
  }
}
"""

def get_random_headers() -> Dict[str, str]:
    user_agent = random.choice(USER_AGENTS)
    platform = '"Windows"'
    if 'Macintosh' in user_agent:
        platform = '"macOS"'
    elif 'Linux' in user_agent:
        platform = '"Linux"'

    return {
        'accept': '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'origin': 'https://soilhealth.dac.gov.in',
        'referer': 'https://soilhealth.dac.gov.in/',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': platform,
        'user-agent': user_agent
    }

def fetch_html(computed_id: str, headers: Dict[str, str]) -> Optional[str]:
    payload = {
        "query": GRAPHQL_HTML_QUERY,
        "variables": {
            "computedId": computed_id,
            "locale": "hi"
        }
    }
    try:
        response = requests.post(URL, headers=headers, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            tests = data.get("data", {}).get("getTestForPortal", [])
            if tests and len(tests) > 0:
                return tests[0].get("html")
    except Exception as e:
        logging.error(f"Failed to fetch HTML for {computed_id}: {e}")
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python html_scraper.py <computedID>")
        sys.exit(1)
        
    computed_id = sys.argv[1]
    logging.info(f"Fetching HTML page for computedID: {computed_id}...")
    
    html_content = fetch_html(computed_id, get_random_headers())
    if html_content:
        html_filename = f"soil_health_card_{computed_id}.html"
        with open(html_filename, "w", encoding="utf-8") as f:
            f.write(html_content)
        logging.info(f"HTML successfully saved to {html_filename}")
    else:
        logging.error("Failed to fetch or parse HTML. Check the computedID or network connection.")

if __name__ == "__main__":
    main()
