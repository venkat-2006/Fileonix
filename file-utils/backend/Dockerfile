FROM node:20

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    poppler-utils \
    ghostscript \
    tesseract-ocr \
    imagemagick \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend ./

CMD ["node", "src/server.js"]
