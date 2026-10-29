"""Build the clearly-labelled synthetic demo corpus used for model development."""

import csv
from pathlib import Path

from app.config import VALID_CATEGORIES

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "category_examples.csv"

SCENARIOS = {
    "road_damage": {
        "issues": [
            "a deep pothole",
            "cracked asphalt",
            "a broken road edge",
            "loose paving stones",
            "a sunken section of pavement",
        ],
        "sites": [
            "the north campus entrance",
            "the road beside the library",
            "the junction near the bus stop",
            "the lane behind the market",
            "the footpath outside the community hall",
        ],
        "impacts": [
            "Cyclists are swerving into traffic to avoid it.",
            "The uneven surface is difficult to cross safely.",
            "Rainwater collects in the damaged section.",
            "The defect is getting wider with regular traffic.",
            "People using mobility aids have trouble passing.",
        ],
    },
    "waste_management": {
        "issues": [
            "an overflowing waste bin",
            "uncollected household rubbish",
            "a pile of mixed plastic waste",
            "a broken public litter container",
            "food waste left beside the collection point",
        ],
        "sites": [
            "the north campus entrance",
            "the lane beside the library",
            "the junction near the bus stop",
            "the corner behind the market",
            "the area outside the community hall",
        ],
        "impacts": [
            "Litter is spreading across the nearby walkway.",
            "The waste has remained there for several days.",
            "The collection area is attracting stray animals.",
            "People are leaving more rubbish beside the full bin.",
            "The public path is becoming unpleasant to use.",
        ],
    },
    "streetlight": {
        "issues": [
            "a streetlight that does not turn on",
            "a flickering lamp post",
            "a damaged light fixture",
            "a row of lights that goes dark at night",
            "an exposed electrical fitting on a lamp post",
        ],
        "sites": [
            "the north campus entrance",
            "the path beside the library",
            "the junction near the bus stop",
            "the lane behind the market",
            "the walkway outside the community hall",
        ],
        "impacts": [
            "The area is very dark after sunset.",
            "Pedestrians cannot easily see the path at night.",
            "The light has failed for the past three evenings.",
            "The damaged fitting may need a safety inspection.",
            "Several people have reported poor visibility there.",
        ],
    },
    "water_drainage": {
        "issues": [
            "a leaking water pipe",
            "a blocked storm drain",
            "standing water across the pavement",
            "a drain cover that is missing",
            "wastewater flowing from a damaged outlet",
        ],
        "sites": [
            "the north campus entrance",
            "the path beside the library",
            "the junction near the bus stop",
            "the lane behind the market",
            "the walkway outside the community hall",
        ],
        "impacts": [
            "Water is pooling and making the route slippery.",
            "The drain backs up whenever it rains.",
            "The leak has continued throughout the day.",
            "People are stepping into the road to get around it.",
            "The water is flowing toward nearby buildings.",
        ],
    },
    "public_property": {
        "issues": [
            "a damaged public bench",
            "a broken section of boundary railing",
            "a cracked pavement slab",
            "a damaged signpost",
            "a broken handrail on the public steps",
        ],
        "sites": [
            "the north campus entrance",
            "the path beside the library",
            "the courtyard near the bus stop",
            "the lane behind the market",
            "the walkway outside the community hall",
        ],
        "impacts": [
            "The structure is unstable and needs inspection.",
            "People cannot use the facility as intended.",
            "A sharp edge is exposed along the damaged part.",
            "The defect is obstructing the accessible route.",
            "The public fixture has been damaged for a week.",
        ],
    },
    "other": {
        "issues": [
            "an abandoned bicycle blocking the walkway",
            "a fallen tree branch on the shared path",
            "a noisy construction activity outside permitted hours",
            "a damaged public notice board",
            "an animal hazard on the pedestrian route",
        ],
        "sites": [
            "the north campus entrance",
            "the path beside the library",
            "the courtyard near the bus stop",
            "the lane behind the market",
            "the walkway outside the community hall",
        ],
        "impacts": [
            "Pedestrians need to step into the road to pass.",
            "The obstruction has remained there since yesterday.",
            "People nearby are unable to use the space normally.",
            "The concern does not fit the other listed categories.",
            "Please have a reviewer assess the reported issue.",
        ],
    },
}

WORDING = (
    "A resident reported {issue} at {site}. {impact}",
    "Please inspect the area at {site}: {issue} is present. {impact}",
    "There is {issue} at {site}. {impact}",
    "The problem at {site} is {issue}. {impact}",
    "We found {issue} at {site}. {impact}",
    "{issue_cap} was observed at {site}. {impact}",
)


def build_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for category in VALID_CATEGORIES:
        scenario = SCENARIOS[category]
        for index in range(20):
            issue = scenario["issues"][index % len(scenario["issues"])]
            site = scenario["sites"][(index * 2 + index // 5) % len(scenario["sites"])]
            impact = scenario["impacts"][(index * 3 + index // 4) % len(scenario["impacts"])]
            group = f"{category}_scenario_{index + 1:02d}"

            for wording in WORDING:
                description = wording.format(
                    issue=issue,
                    issue_cap=issue[0].upper() + issue[1:],
                    site=site,
                    impact=impact,
                )
                rows.append(
                    {
                        "description": description,
                        "category": category,
                        "source": "synthetic_demo",
                        "language": "en",
                        "split_group": group,
                    }
                )

    return rows


def main() -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    with DATA_PATH.open("w", newline="", encoding="utf-8") as data_file:
        writer = csv.DictWriter(
            data_file,
            fieldnames=["description", "category", "source", "language", "split_group"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} synthetic demo rows at {DATA_PATH}")


if __name__ == "__main__":
    main()
