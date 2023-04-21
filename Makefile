init:
	@echo "Installing dependencies..."
	@pnpm install
	@echo "Installing dependencies... Done"
	@echo "Creating www .env file..."
	@cp ./apps/www/.env.example ./apps/www/.env
	@echo "Creating www .env file... Done"
