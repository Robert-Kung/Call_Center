FROM node:20-alpine AS build

WORKDIR /app

# 複製 package files
COPY package.json ./

# 安裝依賴
RUN npm install

# 複製所有源碼
COPY . .

# 建置生產版本
RUN npm run build

# --- 生產階段 ---
FROM node:20-alpine

WORKDIR /app

# 安裝輕量靜態檔案伺服器
RUN npm install -g serve

# 從建置階段複製產出
COPY --from=build /app/dist ./dist

# 暴露端口
EXPOSE 3100

# 啟動靜態伺服器
CMD ["serve", "-s", "dist", "-l", "3100"]
