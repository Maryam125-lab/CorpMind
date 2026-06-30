FROM python:3.12-slim

WORKDIR /app

ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8010

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app
RUN mkdir -p data/chroma data/uploads

EXPOSE 8010 7860

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
