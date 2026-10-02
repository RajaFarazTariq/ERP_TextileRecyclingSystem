FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Admin/API-docs static files, served by whitenoise. collectstatic only needs
# settings to load, so it gets a throwaway key and DB password here.
RUN SECRET_KEY=build-only DB_PASSWORD=build-only python manage.py collectstatic --noinput

RUN useradd --create-home appuser && mkdir -p /app/media && chown -R appuser /app
USER appuser

EXPOSE 8000

# Apply migrations, then serve
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-3} --access-logfile -"]
