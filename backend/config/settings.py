from pathlib import Path
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# All secrets and environment-specific values come from .env (see .env.example)
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())
# Names other services use to reach this API inside a private network (e.g. the
# Next.js app calling http://backend:8000 in Docker). Added to ALLOWED_HOSTS.
ALLOWED_HOSTS += config('INTERNAL_HOSTS', default='', cast=Csv())

AUTH_USER_MODEL = 'users.CustomUser'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    # Project apps
    'apps.users',
    'apps.warehouse',
    'apps.sorting',
    'apps.decolorization',
    'apps.drying',
    'apps.sales',
    'apps.inventory',
    'apps.procurement',
    'apps.quality',
    'apps.reports',
    'apps.audit',
    'apps.notifications',
    'apps.core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # serves admin static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# DB_ENGINE=sqlite is for local tests only; PostgreSQL is the real database.
if config('DB_ENGINE', default='postgresql') == 'sqlite':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': config('DB_NAME', default='ERP_DB'),
            'USER': config('DB_USER', default='postgres'),
            'PASSWORD': config('DB_PASSWORD'),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='5432'),
        }
    }

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'EXCEPTION_HANDLER': 'apps.core.exceptions.api_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.OptionalPageNumberPagination',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Only views that set throttle_scope are throttled (currently: login)
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'login': config('LOGIN_RATE_LIMIT', default='10/min'),
    },
    # Number of trusted proxies in front of Django (nginx and/or the Next.js
    # server). With 1, the login rate limit uses the client address from
    # X-Forwarded-For instead of the proxy's own address.
    'NUM_PROXIES': config('NUM_PROXIES', default=0, cast=int) or None,
}

from datetime import timedelta
SIMPLE_JWT = {
    # Short-lived access tokens; the frontend renews them with the refresh
    # token, which rotates on every use and is revoked on logout.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('ACCESS_TOKEN_MINUTES', default=30, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS', default='http://localhost:3000', cast=Csv()
)

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Karachi'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# API documentation (/api/docs/). Open in development; admin-only otherwise
# (log in at /admin/ first).
SPECTACULAR_SETTINGS = {
    'TITLE': 'Textile Recycling ERP API',
    'VERSION': '1.0.0',
    'SERVE_PERMISSIONS': (
        ['rest_framework.permissions.AllowAny'] if DEBUG
        else ['rest_framework.permissions.IsAdminUser']
    ),
    'SERVE_AUTHENTICATION': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# Production hardening. These default to off so plain-HTTP local development
# keeps working; turn them on in the production .env (see .env.example).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')   # behind nginx
SECURE_SSL_REDIRECT     = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE   = config('SECURE_COOKIES', default=False, cast=bool)
CSRF_COOKIE_SECURE      = SESSION_COOKIE_SECURE
SECURE_HSTS_SECONDS     = config('SECURE_HSTS_SECONDS', default=0, cast=int)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS         = 'DENY'
CSRF_TRUSTED_ORIGINS    = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': config('LOG_LEVEL', default='INFO')},
}


# Email configuration (Gmail SMTP) ───────────────────────────────────────
# Without EMAIL_HOST_USER set, emails are printed to the console instead of sent.
EMAIL_HOST_USER     = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_BACKEND       = config(
    'EMAIL_BACKEND',
    default='django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST_USER
    else 'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST          = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT          = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS       = config('EMAIL_USE_TLS', default=True, cast=bool)
DEFAULT_FROM_EMAIL  = config(
    'DEFAULT_FROM_EMAIL',
    default=f'Textile ERP <{EMAIL_HOST_USER}>' if EMAIL_HOST_USER else 'Textile ERP <noreply@localhost>',
)

# Management alert recipient
MANAGEMENT_EMAIL    = config('MANAGEMENT_EMAIL', default='')