FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package*.json ./
RUN npm ci --omit=dev

# 再复制业务代码
COPY . .

# 确保上传目录存在
RUN mkdir -p public/uploads

EXPOSE 3000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
