'''
FastAPI application entry point.
'''
import math
import json
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import records, aliases, excel_import, compute, chat

load_dotenv()


class SafeJSONEncoder(json.JSONEncoder):
    '''Custom JSON encoder that handles NaN, Inf, and numpy types.'''
    def default(self, obj):
        try:
            import numpy as np
            if isinstance(obj, (np.floating,)):
                val = float(obj)
                if math.isnan(val) or math.isinf(val):
                    return 0
                return val
            if isinstance(obj, (np.integer,)):
                return int(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
        except ImportError:
            pass
        return super().default(obj)

    def encode(self, o):
        return super().encode(self._sanitize(o))

    def _sanitize(self, obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0
            return obj
        if isinstance(obj, dict):
            return {str(k): self._sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [self._sanitize(v) for v in obj]
        if isinstance(obj, (int, str, bool, type(None))):
            return obj
        try:
            import numpy as np
            if isinstance(obj, (np.floating,)):
                val = float(obj)
                return 0 if (math.isnan(val) or math.isinf(val)) else val
            if isinstance(obj, (np.integer,)):
                return int(obj)
            if isinstance(obj, np.ndarray):
                return self._sanitize(obj.tolist())
        except ImportError:
            pass
        return obj


class SafeJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(',', ':'),
            cls=SafeJSONEncoder,
        ).encode('utf-8')


app = FastAPI(
    title='Classify Sales API',
    description='Backend API for after-sales data classification and analysis',
    version='1.0.0',
    default_response_class=SafeJSONResponse,
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
