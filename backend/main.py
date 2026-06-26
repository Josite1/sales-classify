'''
FastAPI application entry point.
'''
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import records, aliases, excel_import, compute, chat

load_dotenv()
app = FastAPI(
    title='Classify Sales API',
    description='Backend API for after-sales data classification and analysis',
    version='1.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(records.router)
app.include_router(aliases.router)
app.include_router(excel_import.router)
app.include_router(compute.router)
app.include_router(chat.router)


@app.get('/api/health')
async def health_check():
    return {'status': 'ok', 'version': '1.0.0'}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8001, reload=True)
