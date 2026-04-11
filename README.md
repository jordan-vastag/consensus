# Consensus

Group decision making tool

## Running Locally

### Quick Start

```bash
./scripts/start-app.sh
```

### Backend

```bash
cd backend
go run main.go
```

### Frontend

To install yarn: `npm i --global yarn`

```bash
cd frontend
yarn install
yarn dev
```

### Docker

`docker compose up --build`

Note: when developing it's easiest to run mongo via Docker and the frontend and backend directly. 

To only run mongo with docker compose: `docker compose up mongo` 

## Testing

In the `test` directory there is a [Bruno](https://www.usebruno.com/) collection for manually testing endpoints. To use it, open Bruno and select `Import Collection` from the main meatball (•••) menu.