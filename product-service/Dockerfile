FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 🔥 đảm bảo uploads là folder
RUN rm -rf /app/public/uploads
RUN mkdir -p /app/public/uploads

CMD ["npm", "start"]