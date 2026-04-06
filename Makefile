.PHONY: build watch type-check package install format knip knip-fix clean dev

## Core

build:          ## Build extension bundle
	pnpm build

watch:          ## Watch mode for development
	pnpm watch

type-check:     ## TypeScript type checking
	pnpm type-check

package: build  ## Package .vsix (builds first)
	pnpm package

install: package ## Build, package, and install into VS Code
	code --install-extension $$(ls -t *.vsix | head -1)

## Quality

format:         ## Format all source files
	pnpm format

knip:           ## Dead code detection
	pnpm knip

knip-fix:       ## Auto-remove safe unused exports
	pnpm knip:fix

## Shortcuts

dev: type-check build ## Type-check then build
	@echo "Ready"

clean:          ## Remove build artifacts
	rm -rf dist *.vsix

help:           ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
