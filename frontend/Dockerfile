FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install react-markdown lucide-react remark-gfm rehype-highlight tailwindcss postcss autoprefixer
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
