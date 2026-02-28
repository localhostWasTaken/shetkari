"""
html_extractor.py
=================
Dynamically extracts all available data from the Soil Health Card HTML.

Output JSON structure:
{
  "test_center": { ... key-value pairs from <b> tags ... },
  "test_info":   { ... key-value pairs from <b> tags ... },
  "sample_info": { ... key-value pairs from table-item-1/2 ... },
  "beneficiary": { ... key-value pairs from table-item-1/2 ... },
  "plot_info":   { ... key-value pairs from <b> tags ... },
  "soil_parameters": [
    {
      "name": "उपलब्ध नाइट्रोजन (N)",
      "value": 125.00,
      "unit": "kg/ha",
      "ideal_range": "280 – 560",
      "status": "Deficient",
      "status_color": "orange"
    },
    ...
  ],
  "fertilizer_recommendations": [
    {
      "crop": "ರಾಗಿ (all variety / rainfed / kharif)",
      "combination_1": [{"product": "15-15-15", "dose": "250 किलो प्रति हेक्टेयर"}, ...],
      "combination_2": [...],
      "organic": "FYM: 6-8 टन प्रति हेक्टेयर | Compost: ..."
    },
    ...
  ]
}
"""

import json
import sys
import os
import re
from bs4 import BeautifulSoup, NavigableString


# ──────────────────────────────────────────────────────────────────────────────
# STATUS ICON MAPPING  (URL fragment → human-readable status)
# ──────────────────────────────────────────────────────────────────────────────
ICON_STATUS_MAP = {
    "green.png":  "Adequate",
    "yellow.png": "Medium",
    "orange.png": "Deficient",
    "red.png":    "Critical / Highly Acidic",
    "grey.png":   "Not Available",
}


def clean_text(text: str) -> str:
    """Collapse whitespace and strip a string."""
    if not text:
        return ""
    return " ".join(text.split()).strip()


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 1 – key-value pairs from <b>Label</b>: value  (and span siblings)
# ──────────────────────────────────────────────────────────────────────────────
def extract_b_tag_pairs(parent_el) -> dict:
    """
    Scan *parent_el* for <b> tags.
    The value is either:
      - the next <span> sibling, OR
      - the remaining text in the parent after removing the <b> text.
    Returns a dict of {label: value}.
    """
    result = {}
    for b_tag in parent_el.find_all("b"):
        # Skip <b> inside recommendation table rows to avoid double-counting
        if b_tag.find_parent("table", class_="recommendations"):
            continue
        # Skip <b> inside div.info cards (those are handled separately)
        if b_tag.find_parent("div", class_="info"):
            continue

        label = clean_text(b_tag.get_text()).strip(":").strip()
        if not label:
            continue

        # Try next <span> sibling first
        next_span = b_tag.find_next_sibling("span")
        if next_span:
            value = clean_text(next_span.get_text())
        else:
            # Fallback: remaining text in the parent element
            parent_text = clean_text(b_tag.parent.get_text(separator=" "))
            b_text = clean_text(b_tag.get_text(separator=" "))
            value = parent_text.replace(b_text, "", 1).strip(" :").strip()

        if label and value:
            result[label] = value

    return result


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 2 – key-value pairs from .table-item-1 / .table-item-2 grid
# ──────────────────────────────────────────────────────────────────────────────
def extract_table_item_pairs(soup) -> dict:
    result = {}
    for div1 in soup.find_all(class_="table-item-1"):
        label = clean_text(div1.get_text()).strip(":").strip()
        div2 = div1.find_next_sibling(class_="table-item-2")
        if div2:
            value = clean_text(div2.get_text(separator=" "))
            if label and value:
                result[label] = value
    return result


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 3 – Soil parameters from div.card > div.card-content > div.info
# ──────────────────────────────────────────────────────────────────────────────
def _icon_status(icon_img) -> tuple[str, str]:
    """Return (status_text, color_name) from an <img> element (or None)."""
    if icon_img is None:
        return "Unknown", "unknown"
    src = icon_img.get("src", "") or icon_img.get("src".lower(), "")
    for filename, status in ICON_STATUS_MAP.items():
        if filename in src:
            color = filename.replace(".png", "")
            return status, color
    return "Unknown", "unknown"


def extract_soil_parameters(soup) -> list:
    """
    Parse every div.card-content that sits inside the main card-group
    (NOT inside div.ms-sections which are just the legend).
    Returns a list of parameter dicts.
    """
    parameters = []

    for card_content in soup.find_all("div", class_="card-content"):
        # Skip legend cards (inside ms-sections)
        if card_content.find_parent(class_="ms-sections"):
            continue

        info_div = card_content.find("div", class_="info")
        if not info_div:
            continue

        # -- Name ---------------------------------------------------------
        label_span = info_div.find("span", recursive=False)  # outermost span = name
        if not label_span:
            # fallback: first span anywhere inside info
            label_span = info_div.find("span")
        if not label_span:
            continue

        name = clean_text(label_span.get_text())
        if not name:
            continue

        # -- Value --------------------------------------------------------
        value_span = info_div.find("span", class_="value")
        raw_value = clean_text(value_span.get_text()) if value_span else ""

        # -- Unit (text node or span right after value_span) --------------
        unit = ""
        if value_span:
            for sib in value_span.next_siblings:
                if isinstance(sib, NavigableString):
                    t = clean_text(str(sib))
                    if t:
                        unit += t + " "
                elif hasattr(sib, "name"):
                    if sib.name == "br":
                        break
                    style = sib.get("style", "")
                    if "text-transform: none" in style or "text-transform:none" in style:
                        unit += clean_text(sib.get_text()) + " "
        unit = clean_text(unit)

        # -- Ideal range --------------------------------------------------
        range_div = info_div.find("div")
        ideal_range = ""
        if range_div:
            range_text = clean_text(range_div.get_text(separator=" "))
            # strip the label "श्रेणी :" / "Range :" etc.
            ideal_range = re.sub(r"^.*?:\s*", "", range_text).strip()

        # -- Status icon --------------------------------------------------
        face_icon_div = card_content.find("div", class_="face-icon")
        icon_img = face_icon_div.find("img") if face_icon_div else None
        status, color = _icon_status(icon_img)

        # -- Numeric value ------------------------------------------------
        try:
            numeric_value = float(raw_value)
        except (ValueError, TypeError):
            numeric_value = raw_value  # keep as string if unparseable

        parameters.append({
            "name": name,
            "value": numeric_value,
            "unit": unit,
            "ideal_range": ideal_range,
            "status": status,
            "status_color": color,
        })

    return parameters


# ──────────────────────────────────────────────────────────────────────────────
# SECTION 4 – Fertilizer recommendations table (tbody > tr)
# ──────────────────────────────────────────────────────────────────────────────
def _parse_td_fertilizers(td) -> list:
    """
    Parse a <td> that contains fertilizer lines like:
      <div><b>15-15-15</b> - 250 <span>किलो प्रति हेक्टेयर</span></div>
    Returns a list of {"product": ..., "dose": ...}.
    """
    items = []
    # Each <div> is one fertilizer line
    for div in td.find_all("div"):
        b_tag = div.find("b")
        if b_tag:
            product = clean_text(b_tag.get_text()).strip(":")
            # Text after the <b>
            remainder = ""
            for sib in b_tag.next_siblings:
                if isinstance(sib, NavigableString):
                    remainder += str(sib)
                elif hasattr(sib, "get_text"):
                    remainder += sib.get_text(separator=" ")
            dose = clean_text(remainder).lstrip("- ").strip()
            if product and dose:
                items.append({"product": product, "dose": dose})
    return items


def _parse_td_organic(td) -> str:
    """
    Parse the organic recommendations <td> into a pipe-delimited string.
    Each <b>Label:</b> … <br /> segment becomes one entry.
    """
    # Get full text with newlines at <br>
    parts = []
    for child in td.children:
        if hasattr(child, "name") and child.name == "b":
            label = clean_text(child.get_text()).strip(":")
            # Collect text until next <b> or <br>
            value_parts = []
            for sib in child.next_siblings:
                if isinstance(sib, NavigableString):
                    value_parts.append(str(sib))
                elif hasattr(sib, "name"):
                    if sib.name == "b":
                        break
                    elif sib.name == "br":
                        break
                    else:
                        value_parts.append(sib.get_text(separator=" "))
            value = clean_text(" ".join(value_parts)).lstrip(": ").strip()
            if label:
                parts.append(f"{label}: {value}" if value else label)
    return " | ".join(p for p in parts if p)


def extract_recommendations(soup) -> list:
    recommendations = []
    table = soup.find("table", class_="recommendations")
    if not table:
        return recommendations

    tbody = table.find("tbody")
    if not tbody:
        return recommendations

    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 4:
            continue

        crop = clean_text(tds[0].get_text(separator=" "))
        combo1 = _parse_td_fertilizers(tds[1])
        combo2 = _parse_td_fertilizers(tds[2])
        organic = _parse_td_organic(tds[3])

        recommendations.append({
            "crop": crop,
            "combination_1": combo1,
            "combination_2": combo2,
            "organic_recommendations": organic,
        })

    return recommendations


# ──────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ──────────────────────────────────────────────────────────────────────────────
def parse_html_to_json(html_content: str) -> dict:
    soup = BeautifulSoup(html_content, "html.parser")

    # ------------------------------------------------------------------ #
    # 1.  Test-center details  (left top box – class="testcenter")
    # ------------------------------------------------------------------ #
    testcenter_div = soup.find("div", class_="testcenter")
    test_center = extract_b_tag_pairs(testcenter_div) if testcenter_div else {}

    # ------------------------------------------------------------------ #
    # 2.  Test ID / date / validity  (class="test")
    # ------------------------------------------------------------------ #
    test_div = soup.find("div", class_="test")
    test_info = extract_b_tag_pairs(test_div) if test_div else {}

    # ------------------------------------------------------------------ #
    # 3.  Sample info  (table-item-1/2 grid inside section-1)
    #     We split by side-section: first = sample, second = beneficiary
    # ------------------------------------------------------------------ #
    section1 = soup.find("div", class_="section-1")
    sample_info = {}
    beneficiary_info = {}
    plot_info = {}

    if section1:
        side_sections = section1.find_all("div", class_="side-section")
        # side_section[0] = नमूना जानकारी (sample)
        # side_section[1] = लाभार्थी का विवरण (beneficiary)
        # side_section[2] = प्लॉट का आकार (plot size / soil type)
        if len(side_sections) > 0:
            sample_info = extract_table_item_pairs(side_sections[0])
        if len(side_sections) > 1:
            # beneficiary also has an inline-style <b>पता:</b> <span>.....</span>
            beneficiary_info = extract_table_item_pairs(side_sections[1])
            # Capture "पता" that lives in a single table-item-1 with both label+value
            for div1 in side_sections[1].find_all(class_="table-item-1"):
                if not div1.find_next_sibling(class_="table-item-2"):
                    # Inline label+value: <span fw-bold>पता :</span> <span>value</span>
                    spans = div1.find_all("span")
                    if len(spans) == 2:
                        label = clean_text(spans[0].get_text()).strip(":")
                        value = clean_text(spans[1].get_text())
                        if label and value:
                            beneficiary_info[label] = value
        if len(side_sections) > 2:
            plot_info = extract_b_tag_pairs(side_sections[2])

    # ------------------------------------------------------------------ #
    # 4.  Soil parameters (div.card-content cards)
    # ------------------------------------------------------------------ #
    soil_parameters = extract_soil_parameters(soup)

    # ------------------------------------------------------------------ #
    # 5.  Fertilizer recommendations (table.recommendations tbody)
    # ------------------------------------------------------------------ #
    fertilizer_recommendations = extract_recommendations(soup)

    return {
        "test_center": test_center,
        "test_info": test_info,
        "sample_info": sample_info,
        "beneficiary": beneficiary_info,
        "plot_info": plot_info,
        "soil_parameters": soil_parameters,
        "fertilizer_recommendations": fertilizer_recommendations,
    }


# ──────────────────────────────────────────────────────────────────────────────
# CLI entry-point
# ──────────────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print("Usage: python html_extractor.py <path_to_html_file>")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    print(f"Extracting data from {file_path} ...")
    data = parse_html_to_json(html_content)

    output_filename = os.path.splitext(file_path)[0] + "_extracted.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    param_count = len(data.get("soil_parameters", []))
    rec_count   = len(data.get("fertilizer_recommendations", []))
    print(f"Extraction complete!")
    print(f"  Soil parameters    : {param_count}")
    print(f"  Crop recommendations: {rec_count}")
    print(f"Saved to {output_filename}")


if __name__ == "__main__":
    main()
