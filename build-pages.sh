#!/bin/sh
set -eu

rm -rf dist
mkdir -p dist

cp index.html dist/
cp styles.css dist/

cp -R assets dist/
cp -R data dist/
cp -R js dist/
