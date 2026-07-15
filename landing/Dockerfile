# Plain static page — no build step, fonts/CSS/JS are all inlined in index.html.
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
