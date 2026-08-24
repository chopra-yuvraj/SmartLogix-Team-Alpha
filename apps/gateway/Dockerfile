# SmartLogix FastAPI Gateway Dockerfile (Task 3.18)

FROM python:3.11-slim

WORKDIR /app

# Install system deps for cryptography package
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

ENV GATEWAY_HOST=0.0.0.0
ENV GATEWAY_PORT=8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
