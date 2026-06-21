# Dùng môi trường Node.js có sẵn cực nhẹ
FROM node:18-alpine

# Tạo thư mục làm việc bên trong container
WORKDIR /app

# Copy các file cấu hình và cài đặt thư viện
COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ code của em vào
COPY . .

# Mở cổng 3001 (Vì web-ban-nuoc đang chạy ở cổng 3001)
EXPOSE 3002

# Lệnh để khởi động máy chủ
CMD ["node", "server.js"]
