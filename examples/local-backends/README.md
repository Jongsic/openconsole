# Local backends

Docker Compose for spinning up AWS-compatible backends to try OpenConsole against.
Each backend is behind a [profile](https://docs.docker.com/compose/profiles/) — start only what you need:

```bash
cd examples/local-backends

docker compose --profile floci      up -d   # Floci (LocalStack drop-in; real EC2/ELB/ASG)
docker compose --profile localstack up -d   # LocalStack community
docker compose --profile minio      up -d   # MinIO (S3 only)
docker compose --profile moto       up -d   # moto_server
```

| Backend | Endpoint | Default creds | Notes |
| --- | --- | --- | --- |
| Floci | http://localhost:4566 | `test` / `test` | Real container-backed services; needs the Docker socket |
| LocalStack | http://localhost:4566 | `test` / `test` | ELB/ASG are Pro-only → shown as "not supported" |
| MinIO | http://localhost:9000 (console :9001) | `minioadmin` / `minioadmin` | S3 only |
| moto | http://localhost:5000 | any | Dashboard at `/moto-api/` |

> ⚠️ Floci and LocalStack default to the same host port **4566** — run only one at a time, or
> override one. Host ports are configurable via env vars (`FLOCI_PORT`, `LOCALSTACK_PORT`,
> `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `MOTO_PORT`):
>
> ```bash
> # something already on 4566? run Floci on 4567 and connect the app to http://localhost:4567
> FLOCI_PORT=4567 docker compose --profile floci up -d
> ```

CORS is fully open (all origins allowed) on every backend, so the browser app can call these directly
from any origin. This is for local dev convenience only — don't reuse these wide-open CORS settings
on anything exposed.

Stop / clean up:

```bash
docker compose --profile <name> down       # stop
docker compose --profile <name> down -v    # stop + drop data volumes
```
