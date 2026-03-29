PYTHON ?= python3
VENV ?= .venv

.PHONY: venv install run run-dev desktop-install desktop-run

venv:
	$(PYTHON) -m venv $(VENV)

install: venv
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install ./backend

run:
	$(VENV)/bin/uvicorn app.main:app --app-dir backend

run-dev:
	$(VENV)/bin/uvicorn app.main:app --app-dir backend --reload

desktop-install:
	cd desktop && npm install

desktop-run:
	cd desktop && npm start
