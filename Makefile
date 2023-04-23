DATABASE_NAME = "postgres"
DATABASE_USER = "postgres"
DATABASE_PASSWORD = "postgres"
DATABASE_HOST = "localhost"
DATABASE_PORT = "5432"

init:
	@echo "Installing dependencies..."
	@pnpm install
	@echo "Installing dependencies... Done"
	@echo "Creating www .env file..."
	@cp ./apps/www/.env.example ./apps/www/.env
	@echo "Creating www .env file... Done"
	@echo "Creating db .env file..."
	@cp ./packages/db/.env.example ./packages/db/.env
	@echo "Creating db .env file... Done"

init-db:
	@echo "Creating db .env file..."
	@cp ./packages/db/.env.example ./packages/db/.env
	@echo "Creating db .env file... Done"

init-dash:
	@echo "Creating dashboard .env file..."
	@cp ./apps/dash/.env.example ./apps/dash/.env
	@echo "Creating dashboard .env file... Done"
