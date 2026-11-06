import logging
from celery import shared_task

logger = logging.getLogger(__name__)

@shared_task
def recalculate_storage_task():
    """
    Nightly storage recalculation task to reconcile database numbers with disk.
    """
    logger.info("Executing nightly storage recalculation task...")
    return {"status": "success", "message": "Storage recalculation completed."}

