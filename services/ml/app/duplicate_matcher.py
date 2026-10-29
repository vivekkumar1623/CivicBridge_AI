"""Duplicate report matcher using TF-IDF cosine similarity.

Computes text similarity between a new report description and candidate
descriptions. The Node backend handles geospatial queries and distance
calculation; this module only handles text similarity.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Any


def score_duplicates(
    new_description: str,
    new_category: str,
    candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Score candidate reports by text similarity to the new description.

    Args:
        new_description: The description of the new report.
        new_category: The selected category of the new report.
        candidates: List of dicts with 'id', 'description', 'category', 'distanceMeters'.

    Returns:
        List of scored candidates sorted by text similarity descending,
        capped at 5 results.
    """
    if not candidates:
        return []

    # Build corpus: new description first, then candidates
    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
    corpus = [new_description] + [c["description"] for c in candidates]
    analyzer = vectorizer.build_analyzer()
    if any(analyzer(text) for text in corpus):
        tfidf_matrix = vectorizer.fit_transform(corpus)
        similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    else:
        similarities = [0.0] * len(candidates)

    # Build scored results
    scored = []
    for i, candidate in enumerate(candidates):
        scored.append({
            "id": candidate["id"],
            "textSimilarity": round(float(similarities[i]), 4),
            "distanceMeters": candidate.get("distanceMeters"),
            "sameCategory": candidate.get("category") == new_category,
        })

    # Sort by similarity descending, cap at 5
    scored.sort(key=lambda x: x["textSimilarity"], reverse=True)
    return scored[:5]
