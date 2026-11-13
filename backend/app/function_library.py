"""Pure merge logic for evidence-backed, manually triggered vocabulary runs."""
import copy


def merge_run(current, run):
    result = copy.deepcopy(current or {"terms": [], "runs": []})
    if any(r["id"] == run["id"] for r in result["runs"]):
        return result
    for incoming in run["terms"]:
        key = (run["category"].strip(), incoming["name"].strip())
        existing = next((t for t in result["terms"] if (t["category"], t["name"]) == key), None)
        if existing is None:
            existing = {"category": key[0], "name": key[1], "aliases": [], "sources": [], "runIds": []}
            result["terms"].append(existing)
        existing["aliases"] = sorted(set(existing["aliases"] + incoming.get("aliases", [])))
        for source in incoming["sources"]:
            if source not in existing["sources"]:
                existing["sources"].append(source)
        existing["runIds"].append(run["id"])
        existing["updatedAt"] = run["completedAt"]
    result["runs"].append({k: v for k, v in run.items() if k != "terms"} | {"termCount": len(run["terms"])})
    return result
