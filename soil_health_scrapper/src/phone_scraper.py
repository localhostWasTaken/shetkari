import requests
import random
import time
import json
import logging
import os
from typing import Optional, Dict, Any, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

URL = 'https://soilhealth4.dac.gov.in/'
TESTED_NUMBERS_FILE = 'tested_numbers.txt'

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0',
    'Mozilla/5.0 (Android 14; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0'
]

GRAPHQL_QUERY = """
query GetTestForPortal($state: String, $district: String, $village: String, $phone: String, $farmername: String) {
  getTestForPortal(
    state: $state
    district: $district
    village: $village
    phone: $phone
    farmername: $farmername
  ) {
    farmer {
      name
      __typename
    }
    computedID
    sampleDate
    cycle
    scheme
    status
    __typename
  }
}
"""

def load_tested_numbers() -> set:
    """Loads previously tested numbers from a file so we don't repeat them across runs.
    Handles lines with '-- Success' suffix by stripping the annotation."""
    if os.path.exists(TESTED_NUMBERS_FILE):
        with open(TESTED_NUMBERS_FILE, 'r') as f:
            numbers = set()
            for line in f:
                line = line.strip()
                if line:
                    # Strip any trailing annotations like '-- Success'
                    phone = line.split()[0]
                    numbers.add(phone)
            return numbers
    return set()

def save_tested_number(phone_number: str, success: bool = False):
    """Saves a newly tested number to the file immediately.
    Appends '-- Success' marker if the number yielded valid data."""
    with open(TESTED_NUMBERS_FILE, 'a') as f:
        entry = phone_number + (" -- Success" if success else "")
        f.write(entry + "\n")

def get_random_headers() -> Dict[str, str]:
    """Generates a reasonably realistic set of headers with a random User-Agent."""
    user_agent = random.choice(USER_AGENTS)
    
    platform = '"Windows"'
    if 'Macintosh' in user_agent:
        platform = '"macOS"'
    elif 'Linux' in user_agent:
        platform = '"Linux"'
    elif 'iPhone' in user_agent or 'iPad' in user_agent:
        platform = '"iOS"'
    elif 'Android' in user_agent:
        platform = '"Android"'

    return {
        'accept': '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
        'authorization': ';',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'origin': 'https://soilhealth.dac.gov.in',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://soilhealth.dac.gov.in/',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="122", "Chromium";v="122"',
        'sec-ch-ua-mobile': '?1' if 'Mobile' in user_agent or 'Android' in user_agent or 'iPhone' in user_agent else '?0',
        'sec-ch-ua-platform': platform,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': user_agent
    }

def generate_random_phone(tested_numbers: set) -> str:
    """
    Generates a random 12-digit Indian phone number starting with +9198,
    ensuring it hasn't been tested yet.
    """
    while True:
        random_digits = "".join([str(random.randint(0, 9)) for _ in range(8)])
        phone = f"+9198{random_digits}"
        if phone not in tested_numbers:
            return phone
    return ""

def test_phone_number(phone_number: str) -> Tuple[bool, Any]:
    """
    Sends a GraphQL request for the given phone number.
    Returns:
    - (True, data) if we got a DIFFERENT response that requires stopping.
    - (False, None) if we got the expected empty response format.
    """
    payload = {
        "query": GRAPHQL_QUERY,
        "variables": {
            "phone": phone_number
        }
    }

    headers = get_random_headers()
    
    try:
        response = requests.post(URL, headers=headers, json=payload, timeout=15)
        
        # If rate limited (HTTP 429), just log and retry later
        if response.status_code == 429:
            logging.warning("Rate limit HTTP 429 received! Sleeping for 60 seconds...")
            time.sleep(60)
            return False, None
            
        if response.status_code != 200:
            logging.warning(f"Unexpected HTTP status code {response.status_code}. Stopping script!")
            return True, {"status_code": response.status_code, "text": response.text}

        try:
            data = response.json()
        except ValueError:
            logging.warning("Response is not JSON! Stopping script!")
            return True, {"raw_text": response.text}
            
        # Check against the expected empty response
        if data.get("data", {}).get("getTestForPortal") == []:
            return False, None
            
        logging.info(f"SUCCESS OR DIFFERENT RESPONSE FOUND for phone number: {phone_number}")
        json_str = json.dumps(data, indent=2)
        logging.info(f"Response snippet: {json_str[:500]}...")
        return True, data
            
    except requests.exceptions.Timeout:
        logging.error(f"Request timeout for {phone_number}. Will retry next.")
        return False, None
    except requests.exceptions.RequestException as e:
        logging.error(f"Request exception for {phone_number}: {e}")
        time.sleep(5) # Delay on network error
        return False, None

def main():
    delay_between_requests = 1.0  # Base delay
    
    tested_numbers = load_tested_numbers()
    logging.info(f"Loaded {len(tested_numbers)} previously tested numbers from {TESTED_NUMBERS_FILE}.")
    logging.info("Starting infinite loop to find a valid response. Press Ctrl+C to stop.")
    
    attempts = 0
    
    try:
        while True:
            attempts += 1
            phone_number = generate_random_phone(tested_numbers)
            
            if attempts % 10 == 0:
                logging.info(f"Attempt {attempts}... testing {phone_number}")
            else:
                logging.debug(f"Testing phone number: {phone_number}")
            
            should_stop, result_data = test_phone_number(phone_number)
            
            # Always add to in-memory set immediately to avoid reuse this session
            tested_numbers.add(phone_number)
            
            if should_stop:
                computed_id = None
                try:
                    tests = result_data.get("data", {}).get("getTestForPortal", [])
                    if tests and len(tests) > 0:
                        computed_id = tests[0].get("computedID")
                except Exception:
                    pass
                
                # Save with -- Success marker if we got valid soil health data
                save_tested_number(phone_number, success=bool(computed_id))
                
                logging.info(f"\n==========================================")
                logging.info(f"SCRIPT STOPPED ON ATTEMPT {attempts}!")
                logging.info(f"Triggering Phone Number: {phone_number}")
                
                if computed_id:
                    logging.info(f"Found computedID: {computed_id}. Copy and run html_scraper.py with this ID.")
                
                # Save the new response so you can inspect it
                with open('successful_response.json', 'w', encoding='utf-8') as f:
                    json.dump({'phone': phone_number, 'data': result_data}, f, indent=2, ensure_ascii=False)
                logging.info("Raw JSON result saved to successful_response.json")
                break
            
            # Record non-success number to file
            save_tested_number(phone_number)
            
            sleep_time = delay_between_requests + random.uniform(0.5, 2.5)
            time.sleep(sleep_time)
            
    except KeyboardInterrupt:
        logging.info("\nScript stopped manually by user via Ctrl+C.")
        logging.info(f"Total attempts this session: {attempts}")

if __name__ == "__main__":
    main()
