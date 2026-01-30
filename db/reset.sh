#!/bin/bash

# Reset the development database

DB_NAME="dev"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"

read -p "Are you sure you want to reset the '$DB_NAME' database? [y/N]: " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "Resetting database '$DB_NAME'..."

mongosh "$MONGO_URI/$DB_NAME" --eval "
  db.dropDatabase();
  print('Database dropped.');
"
