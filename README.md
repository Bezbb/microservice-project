# ShopOnline Docker Deployment

This repo is prepared for Docker Compose deployment on an EC2 VM.

## Public Ports

- Frontend: `FE_PORT`, default `80`
- API Gateway: `API_GATEWAY_PORT`, default `3000`
- Product, order, payment, user services, MongoDB, and Mailpit stay inside the Docker network.

## Frontend Routing

The frontend Express server maps `/` to `fe/public/pages/index.html`.
Every HTML file in `fe/public/pages` is also mapped as `/<file-name>.html`, so the domain root and known pages do not depend on static-directory fallbacks.

The browser API base is injected at runtime through `/js/env.js` from `API_BASE_URL`. Leave `API_BASE_URL` empty to use same-origin `/api` through the frontend proxy to `api-gateway`.

## Deploy On EC2

```bash
git clone <your-repo-url>
cd <your-repo-directory>
cp .env.example .env
```

Edit `.env`:

- `FRONTEND_URL`: public frontend URL.
- `API_BASE_URL`: public API Gateway URL used by browser JavaScript, or empty for same-origin `/api`.
- `PUBLIC_API_BASE_URL`: public callback URL, usually the frontend domain because `/api` is proxied to the gateway.
- `CORS_ORIGINS`: comma-separated frontend origins allowed by the API Gateway.
- Change `INTERNAL_SERVICE_TOKEN`, admin password, OAuth, SMTP, and MoMo credentials.

Start production:

```bash
docker compose up -d --build
```

Equivalent explicit production file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check containers:

```bash
docker compose ps
docker compose logs -f fe api-gateway
```

## EC2 Security Group

Open inbound TCP ports:

- `80` for the frontend
- `3000` for the API Gateway

Keep database and internal service ports closed to the public internet.

## DNS Notes

Point the frontend domain to the EC2 public address. With `API_BASE_URL` empty, browser API calls use the same domain through `/api`, so changing the EC2 public IP only requires updating DNS.
