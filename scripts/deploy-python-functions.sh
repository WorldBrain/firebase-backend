#!/bin/bash

# Deploy the Python functions to Firebase

# Fail early if `firebase` command not in PATH
if ! command -v firebase &> /dev/null; then
    echo "firebase command not found - ensure it's installed and in your PATH"
    exit 1
fi


cd firebase/

python -m venv functions-py/venv

source functions-py/venv/bin/activate && python -m pip install -r functions-py/requirements.txt

firebase deploy --only functions:dead-simple-rag

