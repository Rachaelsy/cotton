#!/bin/sh
set -e

echo "[community] applying knowledge migrations"
node db/migrate.js

echo "[community] starting service"
exec node server.js
