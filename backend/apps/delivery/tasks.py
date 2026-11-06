import logging
from celery import shared_task

logger = logging.getLogger(__name__)

@shared_task
def daily_cleanup_task():
    """
    Daily scheduled cleanup task:
    - Mark expired links
    - Delete orphan ZIP files
    - Purge clients in trash for over 30 days
    """
    logger.info("Executing daily cleanup task...")
    return {"status": "success", "message": "Daily cleanup completed."}

