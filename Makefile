.PHONY: help build run stop clean logs shell test dev prod

# Default target
help:
	@echo "Cash Cleaner Optimizer - Docker Commands"
	@echo "========================================"
	@echo "Available commands:"
	@echo "  build     - Build Docker image"
	@echo "  run       - Run application in development mode"
	@echo "  prod      - Run application in production mode with nginx"
	@echo "  stop      - Stop all containers"
	@echo "  clean     - Remove containers and images"
	@echo "  logs      - Show application logs"
	@echo "  shell     - Open shell in running container"
	@echo "  test      - Run basic connectivity test"
	@echo "  restart   - Restart the application"
	@echo ""
	@echo "Quick start:"
	@echo "  make run    # Development mode (port 5000)"
	@echo "  make prod   # Production mode with nginx (port 80)"

# Build the Docker image
build:
	@echo "Building Cash Cleaner Optimizer Docker image..."
	docker compose build

# Run in development mode
run: build
	@echo "Starting Cash Cleaner Optimizer in development mode..."
	docker compose up -d cash-cleaner-optimizer
	@echo "Application available at: http://localhost:5000"

# Run in production mode with nginx
prod: build
	@echo "Starting Cash Cleaner Optimizer in production mode..."
	docker compose --profile production up -d
	@echo "Application available at: http://localhost:80"

# Stop all containers
stop:
	@echo "Stopping all containers..."
	docker compose --profile production down

# Clean up containers and images
clean: stop
	@echo "Cleaning up containers and images..."
	docker compose --profile production down --rmi all --volumes
	docker system prune -f

# Show logs
logs:
	@echo "Showing application logs..."
	docker compose logs -f cash-cleaner-optimizer

# Open shell in running container
shell:
	@echo "Opening shell in cash-cleaner-optimizer container..."
	docker compose exec cash-cleaner-optimizer /bin/bash

# Test connectivity
test:
	@echo "Testing application connectivity..."
	@if curl -f http://localhost:5000/ > /dev/null 2>&1; then \
		echo "✅ Application is running and accessible!"; \
	else \
		echo "❌ Application is not accessible. Check if it's running with 'make logs'"; \
	fi

# Restart application
restart: stop run
	@echo "Application restarted!"

# Development with auto-reload
dev:
	@echo "Starting development server with auto-reload..."
	@echo "Note: This runs outside Docker for faster development"
	python app.py 