#!/bin/bash

set -e

rm -rf node_modules

echo "Installing dependencies..."
npm install && npm build

echo "Generating Prisma client..."
npx prisma generate

echo "Starting dev server..."
npm run dev
