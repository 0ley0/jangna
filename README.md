# Jangna (จ้างนะ)

ลงเวลา ค่าแพ็ค และเงินเดือน ผ่าน LINE — จ้างง่าย จ่ายถูก

```bash
docker compose -f docker/docker-compose.yml up -d
cd backend && dotnet run --project src/Jangna.Api      # http://localhost:5099
cd frontend && npm run dev                             # http://localhost:3000
node scripts/seed-demo.mjs                             # demo@jangna.local / demo1234
```

เอกสารแยกตามเรื่องอยู่ใน [`docs/`](docs/README.md) — เริ่มที่ [roadmap](docs/roadmap.md) หรือ [dev setup](docs/dev-setup.md)
