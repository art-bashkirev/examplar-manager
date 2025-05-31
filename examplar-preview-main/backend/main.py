
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def event_generator():
    # In a real application, you would trigger this based on actual updates
    # For demonstration, we'll just send a message after a delay
    await asyncio.sleep(5) # Simulate some work or waiting for an update
    yield f"data: {{'message': 'The website has updated'}}"

@app.get("/events")
async def events(request: Request):
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/")
async def read_root():
    return {"Hello": "World"}
