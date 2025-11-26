#!/bin/sh
set -e

until ollama create gittor -f /root/.ollama/Modelfile >/dev/null 2>&1; do
    echo "Waiting for Ollama..."
    sleep 2
done

echo "Model ready."