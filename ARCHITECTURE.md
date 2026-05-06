# 📐 Kiến Trúc & Thiết Kế - Architecture & Design

**📋 Xem thêm**: [USE_CASES.md](./USE_CASES.md) - Tất cả use cases & sequence diagrams

## Mục Lục
1. [Tổng Quan Kiến Trúc](#tổng-quan-kiến-trúc)
2. [Patterns & Best Practices](#patterns--best-practices)
3. [Communication Flow](#communication-flow)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Error Handling](#error-handling)
7. [Scalability & Performance](#scalability--performance)
8. [Deployment Architecture](#deployment-architecture)

---

## 🏗️ Tổng Quan Kiến Trúc

### Kiến Trúc Microservices

Dự án áp dụng **SOA (Service Oriented Architecture)** với các nguyên lý:

```
┌─────────────────────────────────────────────────┐
│                    Client Layer                 │
│                                                 │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐   │
│  │  Browser  │  │   Mobile │  │ Admin App  │   │
│  └───────────┘  └──────────┘  └────────────┘   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              API Gateway Layer                  │
│  ┌─────────────────────────────────────────┐   │
│  │  • Request Routing                       │   │
│  │  • Authentication & Authorization       │   │
│  │  • Rate Limiting (optional)              │   │
│  │  • CORS Handling                         │   │
│  │  • Request/Response Transformation      │   │
│  └─────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
    ┌────────┐ ┌───────┐ ┌────────┐ ┌────────┐
    │Product │ │ Order │ │Payment │ │  User  │
    │Service │ │Service│ │Service │ │Service │
    └────────┘ └───────┘ └────────┘ └────────┘
         │          │          │          │
         ▼          ▼          ▼          ▼
    ┌────────┐ ┌───────┐ ┌────────┐ ┌────────┐
    │Product │ │ Order │ │Payment │ │  User  │
    │   DB   │ │  DB   │ │  DB    │ │  DB    │
    └────────┘ └───────┘ └────────┘ └────────┘
```

### Các Nguyên Lý Cốt Lõi

#### 1. **Loose Coupling**
- Mỗi service hoàn toàn độc lập
- Không shared database
- Giao tiếp qua API HTTP
- Thay đổi một service không ảnh hưởng đến service khác

#### 2. **High Cohesion**
- Mỗi service có một trách nhiệm duy nhất
- Nhóm các tính năng liên quan lại với nhau
- Business logic rõ ràng và tập trung

#### 3. **Service Independence**
- Mỗi service có lifecycle riêng
- Deploy độc lập
- Có thể restart mà không ảnh hưởng toàn hệ thống
- Có thể scale riêng biệt

#### 4. **Database per Service**
- Mỗi service có database riêng
- Tránh shared database coupling
- Cho phép chọn DB type phù hợp per service

---

## 🎯 Patterns & Best Practices

### 1. **API Gateway Pattern**
```javascript
// API Gateway làm:
- Single entry point cho tất cả requests
- Xác thực & ủy quyền tập trung
- Định tuyến requests đến services
- Xử lý CORS, rate limiting
- Transformation requests/responses

// Benefits:
✓ Simplified client interaction
✓ Centralized authentication
✓ Easy to add cross-cutting concerns
✓ Version management
```

### 2. **Service Discovery Pattern**
```
Trong Docker Compose:
- Services khám phá nhau qua service names
- product-service:3001
- order-service:3002
- payment-service:3003
- user-service:3005

VD: Order Service gọi Product Service:
GET http://product-service:3001/api/products
```

### 3. **Circuit Breaker Pattern** (Optional Enhancement)
```javascript
// Nếu một service down, circuit breaker:
- Fail fast (không chờ timeout)
- Return cached response
- Periodic retry
- Alert system admin
```

### 4. **Bulkhead Pattern**
```
Mỗi service:
- Chạy trong container riêng
- Có resources riêng (CPU, Memory)
- Failure không cascade
- Độc lập scale
```

### 5. **Event-Driven Architecture** (Optional)
```javascript
Sự kiện có thể được publish:
- product.created
- order.created
- payment.confirmed
- user.registered

Services subscribe to events:
Order Service -> subscribe to payment.confirmed
  -> Update order status to "completed"
```

---

## 📡 Communication Flow

### Synchronous Communication (HTTP/REST)

#### 1. Client → API Gateway
```
Request:
GET /api/products HTTP/1.1
Host: localhost:3000
Authorization: Bearer <jwt_token>

Response:
HTTP/1.1 200 OK
Content-Type: application/json

[
  { id: "1", name: "Product 1", price: 100 },
  { id: "2", name: "Product 2", price: 200 }
]
```

#### 2. API Gateway → Product Service
```
// API Gateway forwards to Product Service:
GET /api/products HTTP/1.1
Host: product-service:3001
Content-Type: application/json
```

#### 3. Order Service → Product Service (Internal Call)
```
Order Service cần thông tin sản phẩm:

GET /api/internal/products/orders HTTP/1.1
Host: product-service:3001
X-Internal-Token: local-dev-product-token

Request Body:
{
  "productIds": ["prod_1", "prod_2"]
}

Response:
[
  { id: "prod_1", name: "Product 1", price: 100, quantity: 50 },
  { id: "prod_2", name: "Product 2", price: 200, quantity: 30 }
]
```

### Authentication Flow

```
1. Login Request:
   POST /auth/login
   { email: "user@example.com", password: "password" }

2. User Service validates credentials:
   - Hash password & compare
   - If valid, generate JWT token

3. JWT Token Response:
   { token: "eyJhbGciOiJIUzI1NiIs...", user: {...} }

4. Client stores token:
   localStorage.setItem('token', jwt_token)

5. Subsequent Requests:
   GET /api/products
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

6. API Gateway verifies token:
   - Decode JWT
   - Check signature
   - Verify expiration
   - Extract user info

7. Forward with user context:
   GET /api/products
   X-User-Id: user_123
   X-User-Email: user@example.com
```

---

## 🔄 Data Flow

### Product Data Flow

```
1. Admin adds product via Frontend:
   PUT /api/products
   { name: "New Product", price: 100, ... }

2. API Gateway -> Product Service

3. Product Service:
   - Validate input
   - Check database
   - Save to MongoDB
   - Log audit record

4. Response to Frontend:
   { id: "prod_123", name: "New Product", ... }

5. Frontend updates UI
```

### Order Creation Flow

```
1. Customer clicks "Checkout":
   POST /orders
   { userId: "user_123", items: [...], totalAmount: 500 }

2. API Gateway routes to Order Service

3. Order Service:
   a) Validate order data
   b) Call Product Service to verify product exists & stock
      GET /api/internal/products/orders
   c) Deduct inventory from Product Service
   d) Create order record

4. Frontend triggers Payment Service through API Gateway:
   POST /payments
   { orderId: "order_123", amount: 500, method: "momo" | "cash" }

5. Payment Service:
   a) Validate order and amount
   b) If method is "momo", create MoMo signature
   c) Call MoMo /v2/gateway/api/create
   d) Save MoMo payment as "pending"
   e) Return MoMo payUrl
   f) If method is "cash", save payment as "paid" and update order to "paid"

6. Frontend redirects customer to MoMo payUrl if method is "momo"; otherwise shows cash success

7. MoMo sends redirect/IPN result to Payment Service for MoMo payments

8. Payment Service verifies MoMo signature:
   a) If resultCode = 0, update payment to "paid"
   b) Call Order Service to update order status to "paid"
   c) Redirect customer to payment result page
```

### User Registration Flow

```
1. User enters credentials:
   POST /auth/register
   { email: "new@example.com", password: "pass123" }

2. User Service:
   a) Validate input
   b) Check if email exists
   c) Hash password using bcrypt
   d) Create user record
   e) Generate verification token (optional)

3. Response:
   { id: "user_123", email: "new@example.com", ... }

4. Frontend redirects to login
```

---

## 🔐 Security Architecture

### 1. Authentication (AuthN)

#### JWT Token Structure
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
  .eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
  .SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

Header: { alg: "HS256", typ: "JWT" }
Payload: { sub: "user_123", email: "user@example.com", role: "user", exp: 1234567890 }
Signature: HMACSHA256(header.payload, secret)
```

#### Token Validation Process
```javascript
// API Gateway
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    // Check expiration
    if (decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    return decoded;
  } catch (err) {
    throw new Error('Invalid token');
  }
}
```

### 2. Authorization (AuthZ)

#### Role-Based Access Control (RBAC)
```javascript
// Example: Only admins can create products
app.post('/api/products', 
  requireAuth,
  requireRole('admin'),
  createProduct
);

// Middleware checks:
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### 3. Service-to-Service Authentication

#### Internal Service Token
```javascript
// Order Service calling Product Service
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN
};

// Product Service validates:
if (req.headers['x-internal-token'] !== INTERNAL_TOKEN) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

### 4. Data Protection

#### Password Hashing
```javascript
// User Service
const bcrypt = require('bcrypt');

// Register
const hashedPassword = await bcrypt.hash(password, 10);
user.password = hashedPassword;

// Login
const isValid = await bcrypt.compare(inputPassword, storedHashedPassword);
```

#### HTTPS (Production)
```
- Encrypt data in transit
- SSL/TLS certificates
- Redirect HTTP to HTTPS
```

#### Environment Variables
```bash
# Secrets không commit lên git
INTERNAL_SERVICE_TOKEN=secret-token-123
JWT_SECRET=jwt-secret-key-456
DATABASE_URL=mongodb://...
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
PUBLIC_API_BASE_URL=https://api.example.com
FRONTEND_URL=https://shop.example.com
```

---

## ⚠️ Error Handling

### Error Hierarchy

```
┌─────────────────────────┐
│   HTTP Status Codes     │
└────────────┬────────────┘
             │
     ┌───────┼───────┐
     ▼       ▼       ▼
   2xx     4xx     5xx
  Success Client Server
             │       │
        ┌────┴──┐ ┌──┴─────┐
        ▼       ▼ ▼        ▼
       400    401 500     503
       Bad    Unauth Intern Unavail
       Req             Error
```

### Error Response Format

```javascript
// Standardized error response
{
  "error": "Product not found",
  "code": "PRODUCT_NOT_FOUND",
  "statusCode": 404,
  "timestamp": "2024-05-06T10:30:00Z",
  "path": "/api/products/123"
}
```

### Error Handling Flow

```javascript
// API Gateway
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    code: err.code,
    statusCode: statusCode,
    timestamp: new Date().toISOString()
  });
});

// Service catches errors
app.get('/api/products/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});
```

---

## ⚡ Scalability & Performance

### 1. Horizontal Scaling

```
Trước:
┌──────────────────┐
│  API Gateway     │
│  Product Service │
│  Database        │
└──────────────────┘

Sau:
                    ┌──────────────────┐
                    │  Load Balancer   │
                    └────────┬─────────┘
                    ┌────────┴─────────┐
                    ▼                  ▼
            ┌──────────────┐    ┌──────────────┐
            │Product Svc 1 │    │Product Svc 2 │
            │Database 1    │    │Database 1    │
            └──────────────┘    └──────────────┘
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ Shared Cache     │
                    │ (Redis optional) │
                    └──────────────────┘
```

### 2. Database Optimization

#### Indexing Strategy
```javascript
// Product Service
db.products.createIndex({ category: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ name: "text" });
// Product text search

// Order Service
db.orders.createIndex({ userId: 1, createdAt: -1 });
db.orders.createIndex({ status: 1 });
```

#### Query Optimization
```javascript
// Inefficient
const product = await Product.findById(id);
const category = await Category.findById(product.categoryId);

// Efficient (single query)
const product = await Product.findById(id).populate('category');
```

### 3. Caching Strategy

```javascript
// Frontend caching
localStorage.setItem('products', JSON.stringify(products));
sessionStorage.setItem('cart', JSON.stringify(cart));

// HTTP caching headers
res.set('Cache-Control', 'public, max-age=3600');

// Backend caching (optional)
const cache = new Map();
function getCachedProducts() {
  if (cache.has('products')) {
    return cache.get('products');
  }
  // fetch from DB
}
```

### 4. Asynchronous Processing

```javascript
// Instead of blocking wait:
// ❌ const payment = await processPayment(); // Takes 30s
// const order = await createOrder();

// ❌ Creates bottleneck

// ✅ Better approach:
const payment = processPaymentAsync();
const order = await createOrder(); // Doesn't wait for payment
sendNotificationAsync(); // Fire and forget
```

---

## 🐳 Deployment Architecture

### Docker Container Structure

```
┌──────────────────────────────────────────────────────────┐
│                   Docker Engine                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  API Gateway     │  │  Product Service Container   │ │
│  │  Container       │  │  ┌───────────────────────┐   │ │
│  │  ┌────────────┐  │  │  │ Node.js Process       │   │ │
│  │  │ Express.js │  │  │  │ Express App           │   │ │
│  │  │ (listening │  │  │  │ (listening on 3001)   │   │ │
│  │  │ on 3000)   │  │  │  │                       │   │ │
│  │  │            │  │  │  └───────────────────────┘   │ │
│  │  └────────────┘  │  │  ┌───────────────────────┐   │ │
│  │                  │  │  │ MongoDB driver        │   │ │
│  │  Ports exposed:  │  │  │ Mongoose ODM          │   │ │
│  │  3000 -> 3000    │  │  │                       │   │ │
│  │                  │  │  └───────────────────────┘   │ │
│  └──────────────────┘  │  Volumes:                    │ │
│                        │  - /app/src                  │ │
│                        │  - /app/public               │ │
│                        │  Ports exposed:              │ │
│                        │  3001 (internal to network)  │ │
│                        └──────────────────────────────┘ │
│                                                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  MongoDB         │  │  Order Service Container     │ │
│  │  Container       │  │  ┌───────────────────────┐   │ │
│  │  ┌────────────┐  │  │  │ Node.js Process       │   │ │
│  │  │ MongoDB 7  │  │  │  │ Express App           │   │ │
│  │  │ (listening │  │  │  │ (listening on 3002)   │   │ │
│  │  │ on 27018)  │  │  │  │                       │   │ │
│  │  │            │  │  │  └───────────────────────┘   │ │
│  │  │            │  │  │  Ports exposed:              │ │
│  │  │ Volumes:   │  │  │  3002 (internal to network)  │ │
│  │  │ product_data   │  └──────────────────────────────┘ │
│  │  │            │  │                                   │ │
│  │  └────────────┘  │  Similar for:                    │ │
│  └──────────────────┘  - Payment Service               │ │
│                        - User Service                  │ │
│                        - Payment/Order/User DBs        │ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Docker Network (app-network)                      │ │
│  │  - All containers connected                        │ │
│  │  - Can communicate via service names               │ │
│  │  - product-service:3001                            │ │
│  │  - order-service:3002                              │ │
│  │  - etc.                                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Dockerfile Structure

```dockerfile
# product-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
```

### Docker Compose Networking

```yaml
version: '3.8'

services:
  product-service:
    build: ./product-service
    container_name: product-service
    expose:
      - "3001"              # Only expose internally
    networks:
      - app-network         # Connect to bridge network
    
  api-gateway:
    build: ./api-gateway
    ports:
      - "3000:3000"         # Only gateway exposed to host
    networks:
      - app-network

networks:
  app-network:
    driver: bridge         # Bridge network for service discovery
```

---

## 📊 Monitoring & Observability

### Health Checks

```javascript
// Each service has health endpoint
GET /health

Response:
{
  "status": "ok",           // ok, degraded, down
  "service": "product-service",
  "databaseReady": true,
  "uptime": 3600,
  "timestamp": "2024-05-06T10:30:00Z"
}
```

### Logging

```javascript
// Structured logging
const logEvent = {
  timestamp: new Date(),
  level: 'INFO',         // INFO, WARN, ERROR
  service: 'product-service',
  userId: 'user_123',
  action: 'product.created',
  data: { productId: 'prod_123', name: 'Product' },
  duration: 150          // ms
};
```

### Metrics to Track

```
- Response time (latency)
- Request count per service
- Error rate
- Database connection pool
- CPU & Memory usage
- Request size
- Cache hit rate
```

---

## 🔄 Resilience Patterns

### Retry Logic

```javascript
async function callServiceWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(100 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

### Timeout Handling

```javascript
const timeout = 5000; // 5 seconds
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

try {
  const response = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeoutId);
}
```

### Graceful Degradation

```javascript
// If Product Service is down, show cached data
async function getProducts() {
  try {
    return await fetch('/api/products');
  } catch (err) {
    console.error('Product Service down, using cache');
    return getCachedProducts();
  }
}
```

---

## 📈 Future Enhancements

1. **Message Queue** (RabbitMQ/Kafka)
   - Asynchronous service communication
   - Event streaming
   - Decoupling services

2. **API Versioning**
   - /api/v1/products
   - /api/v2/products

3. **GraphQL**
   - Instead of REST
   - Better client control of data

4. **Service Mesh** (Istio)
   - Advanced traffic management
   - Security policies
   - Observability

5. **Distributed Tracing** (Jaeger)
   - Track requests across services
   - Performance analysis

6. **API Rate Limiting**
   - Protect from abuse
   - Fair usage

7. **Caching Layer** (Redis)
   - Improve performance
   - Reduce database load

---

## 📚 References

- Microservices.io - https://microservices.io/
- 12 Factor App - https://12factor.net/
- Martin Fowler - Microservices - https://martinfowler.com/articles/microservices.html
- Docker Best Practices - https://docs.docker.com/develop/

---

**Last Updated**: May 6, 2024  
**Version**: 1.0

