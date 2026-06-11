#!/bin/sh
set -e

export PORT="${PORT:-80}"
export API_UPSTREAM="${API_UPSTREAM:-http://web:8000}"
export API_HOST="$(echo "$API_UPSTREAM" | sed -E 's#^https?://([^:/]+).*#\1#')"
envsubst '${API_UPSTREAM} ${PORT} ${API_HOST}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
