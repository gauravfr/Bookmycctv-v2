import logging
import re

class RedactingFilter(logging.Filter):
    _credentials = re.compile(r"(rtsp://)([^/@\s]+)@", re.IGNORECASE)
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._credentials.sub(r"\1***@", str(record.msg))
        record.args = ()
        return True

def configure_logging() -> logging.Logger:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logger = logging.getLogger("bookmycctv.ai")
    logger.addFilter(RedactingFilter())
    return logger
