import sys
import os
import subprocess
import time
import signal
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server_runner.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def is_venv():
    """Check if running in a virtual environment."""
    return hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)

def setup_environment():
    """Setup virtual environment and install dependencies."""
    try:
        if not is_venv():
            logger.info("Creating virtual environment...")
            subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
            
            # Activate virtual environment
            if sys.platform == "win32":
                python = str(Path("venv/bin/python.exe").absolute())
                pip = str(Path("venv/bin/pip.exe").absolute())
            else:
                python = str(Path("venv/bin/python").absolute())
                pip = str(Path("venv/bin/pip").absolute())
            
            logger.info("Installing dependencies...")
            print(f"Installing dependencies from {pip} with {python}")
            subprocess.run([pip, "install", "-r", "requirements.txt"], check=True)
            return python
        
        return sys.executable
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to setup environment: {str(e)}")
        raise

def run_server(python_path):
    """Run the FastAPI server."""
    try:
        logger.info("Starting server...")
        server_process = subprocess.Popen(
            [python_path, "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Monitor server startup
        time.sleep(2)
        if server_process.poll() is not None:
            out, err = server_process.communicate()
            logger.error(f"Server failed to start:\nOutput: {out}\nError: {err}")
            raise Exception("Server failed to start")
        
        logger.info("Server started successfully")
        return server_process
        
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        raise

def stop_server(process):
    """Stop the server gracefully."""
    if process:
        logger.info("Stopping server...")
        if sys.platform == "win32":
            process.terminate()
        else:
            process.send_signal(signal.SIGTERM)
        process.wait(timeout=5)
        logger.info("Server stopped")

def main():
    """Main entry point."""
    server_process = None
    try:
        # Change to script directory
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        
        # Setup environment
        python_path = setup_environment()
        
        # Run server
        server_process = run_server(python_path)
        
        # Keep running until interrupted
        while True:
            if server_process.poll() is not None:
                logger.error("Server process died unexpectedly")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        stop_server(server_process)

if __name__ == "__main__":
    main() 