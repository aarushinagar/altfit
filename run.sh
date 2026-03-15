#!/bin/bash

set -e

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Starting dev server..."
npm run dev
