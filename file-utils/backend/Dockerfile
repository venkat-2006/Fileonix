FROM node:20

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# ML model cache
ENV XENOVA_CACHE_DIR=/app/model_cache
ENV TRANSFORMERS_CACHE=/app/model_cache

# Force sharp to use system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0
ENV SHARP_FORCE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_skip_download=true

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpng-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    poppler-utils \
    ghostscript \
    tesseract-ocr \
    imagemagick \
    qpdf \
    mupdf-tools \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install node dependencies
RUN npm ci --omit=dev --unsafe-perm

# Copy backend source
COPY backend ./

# Model cache directory
RUN mkdir -p /app/model_cache && chmod -R 777 /app/model_cache

EXPOSE 4000

CMD ["node", "src/server.js"]