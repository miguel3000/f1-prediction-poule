#!/bin/sh
# Starts (or stops) a throwaway Postgres on port 5433 for the backend tests, without Docker.
# Same connection string as docker-compose.test.yml:
#   postgresql://f1user:f1password@localhost:5433/f1_test
#   scripts/test-db.sh start | stop
DIR=/tmp/f1-pg-test
case "$1" in
  start)
    if [ ! -d "$DIR" ]; then
      LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 initdb -D "$DIR" -U f1user --auth=trust --locale=C --encoding=UTF8 >/dev/null || exit 1
    fi
    LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 pg_ctl -D "$DIR" -o "-p 5433 -k /tmp" -l "$DIR/server.log" -w start >/dev/null || exit 1
    createdb -h localhost -p 5433 -U f1user f1_test 2>/dev/null || true
    echo "test database ready on port 5433"
    ;;
  stop)
    pg_ctl -D "$DIR" -m fast stop
    ;;
  *)
    echo "usage: $0 start|stop"; exit 1;;
esac
