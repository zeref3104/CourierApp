#!/usr/bin/env bash
set -Eeuo pipefail

# One-shot replica-set bootstrap for the local docker MongoDB.
# Runs after the mongodb service is healthy. Idempotent: it only calls
# rs.initiate() when the node is not already part of an initialized set.
#
# NOTE: this runs as a separate one-shot service instead of a
# /docker-entrypoint-initdb.d script because the mongo:7 entrypoint strips
# --replSet from the temporary first-boot server when MONGO_INITDB_ROOT_USERNAME
# is set, so rs.initiate() cannot run from an initdb script.

: "${MONGO_HOST:=mongodb}"
: "${MONGO_PORT:=27017}"
: "${MONGO_ROOT_PASSWORD:=changeme}"
: "${REPLICA_SET_NAME:=rs0}"

echo "Waiting for MongoDB at ${MONGO_HOST}:${MONGO_PORT} to accept connections..."
until mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u admin -p "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; do
  sleep 2
done

echo "Configuring replica set '${REPLICA_SET_NAME}' (idempotent)..."
mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" -u admin -p "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin --quiet <<EOF
// replSetGetStatus THROWS in mongosh (mongo:7) instead of returning ok:0 when
// the node has not received any replset config yet, so the check must never
// escape the script (set -Eeuo pipefail would abort before rs.initiate).
let status;
try {
  status = db.adminCommand({ replSetGetStatus: 1 });
} catch (e) {
  status = { ok: 0 };
}
if (status.ok === 1) {
  print('Replica set already initialized; nothing to do.');
} else {
  print('Initializing replica set');
  rs.initiate({
    _id: '${REPLICA_SET_NAME}',
    members: [{ _id: 0, host: 'mongodb:27017' }],
  });
  print('Replica set initialized.');
}
EOF

echo "Replica set bootstrap complete."
