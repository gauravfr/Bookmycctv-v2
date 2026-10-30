FROM python:3.12-slim
WORKDIR /worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY models ./models
RUN mkdir -p /evidence && chown -R nobody:nogroup /worker /evidence
USER nobody
ENV PYTHONPATH=/worker
CMD ["python", "-m", "app.main"]
