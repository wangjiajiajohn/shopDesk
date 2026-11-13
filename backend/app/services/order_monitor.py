"""Read-only monitoring of platform deadlines. No inferred business-day SLA."""
from datetime import timezone

PREPARING = {"AWAITING_SHIPMENT", "PARTIALLY_SHIPPING"}
PENDING = PREPARING | {"AWAITING_COLLECTION"}
WARNING_SECONDS = 24 * 3600  # Operational warning window, not a platform SLA.


def classify_order(order, now: int) -> dict:
    stage = "preparing" if order.status in PREPARING else "collection"
    deadline = order.rts_sla_time if stage == "preparing" else order.tts_sla_time
    cancel_deadline = order.cancel_order_sla_time
    remaining = deadline - now if deadline else None
    cancel_remaining = cancel_deadline - now if cancel_deadline else None
    if cancel_remaining is not None and cancel_remaining <= WARNING_SECONDS:
        risk = "cancellation"
    elif remaining is None:
        risk = "unknown"
    elif remaining <= 0:
        risk = "overdue"
    elif remaining <= WARNING_SECONDS:
        risk = "due_soon"
    else:
        risk = "on_track"
    synced = order.synced_at
    if synced and synced.tzinfo is None:
        synced = synced.replace(tzinfo=timezone.utc)
    return {
        "stage": stage, "risk": risk, "deadline": deadline,
        "remaining_seconds": remaining,
        "cancel_deadline": cancel_deadline,
        "cancel_remaining_seconds": cancel_remaining,
        "synced_at": synced.isoformat() if synced else None,
        "stale": synced is None or now - int(synced.timestamp()) > 30 * 60,
    }
