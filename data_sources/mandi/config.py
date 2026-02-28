import os
from dotenv import load_dotenv

load_dotenv()

API_KEY: str = os.environ.get("MANDI_API_KEY", "")
BASE_URL: str = os.environ.get("MANDI_API_BASE_URL", "https://api.data.gov.in/resource")
RESOURCE_ID: str = os.environ.get("MANDI_RESOURCE_ID", "9ef84268-d588-465a-a308-a864a43d0070")
REQUEST_TIMEOUT: int = 30
SEARCH_RADIUS_KM: int = 100

# Common states and their codes (for reference / display)
STATE_CODES: dict[str, str] = {
    "Andhra Pradesh": "AP",
    "Telangana": "TG",
    "Karnataka": "KA",
    "Tamil Nadu": "TN",
    "Maharashtra": "MH",
    "Gujarat": "GJ",
    "Rajasthan": "RJ",
    "Madhya Pradesh": "MP",
    "Uttar Pradesh": "UP",
    "Punjab": "PB",
    "Haryana": "HR",
    "Bihar": "BR",
    "West Bengal": "WB",
    "Odisha": "OD",
}
