'''
AI Chat API: streaming responses via ZhipuAI GLM-4-flash with deep thinking mode.
'''
import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from zai import ZhipuAiClient
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix='/api/chat', tags=['chat'])

SYSTEM_PROMPT = '''你是售后数据分析助手，专精于售后数据(红色旗子/绿色旗子/灰色旗子)的分析诊断。
你的能力包括:
1. 分析售后问题的地域分布、产品分布、店铺分布
2. 解读标记分类(红色/绿色/灰色旗子)的含义和趋势
3. 给出改进建议和预警提示
4. 帮助用户理解客服备注中反映的问题

请用中文回答，保持专业且易于理解。'''


class ChatRequest(BaseModel):
    messages: list[dict]
    stream: bool = True


async def generate_stream(messages: list[dict]):
    """Generate SSE streaming response from ZhipuAI."""
    api_key = os.getenv('ZHIPUAI_API_KEY')
    if not api_key:
        yield f'data: {json.dumps({"error": "未配置 ZHIPUAI_API_KEY 环境变量"}, ensure_ascii=False)}\n\n'
        return

    try:
        client = ZhipuAiClient(api_key=api_key)

        response = client.chat.completions.create(
            model='glm-4-flash',
            messages=[{'role': 'system', 'content': SYSTEM_PROMPT}] + messages,
            stream=True,
            thinking={'type': 'enabled'},
            max_tokens=65536,
            temperature=1.0,
        )

        for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            data = {}
            # Reasoning content (thinking mode output)
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                data['reasoning_content'] = delta.reasoning_content
            # Normal content
            if hasattr(delta, 'content') and delta.content:
                data['content'] = delta.content

            if data:
                yield f'data: {json.dumps(data, ensure_ascii=False)}\n\n'

            # Check for finish reason
            if chunk.choices[0].finish_reason:
                yield f'data: {json.dumps({"finish": chunk.choices[0].finish_reason}, ensure_ascii=False)}\n\n'

    except Exception as e:
        yield f'data: {json.dumps({"error": str(e)}, ensure_ascii=False)}\n\n'


@router.post('/stream')
async def chat_stream(req: ChatRequest):
    """Streaming chat endpoint using SSE."""
    return StreamingResponse(
        generate_stream(req.messages),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    )


@router.post('')
async def chat(req: ChatRequest):
    """Non-streaming chat endpoint (fallback)."""
    api_key = os.getenv('ZHIPUAI_API_KEY')
    if not api_key:
        raise HTTPException(500, 'ZHIPUAI_API_KEY not configured')

    try:
        client = ZhipuAiClient(api_key=api_key)
        response = client.chat.completions.create(
            model='glm-4-flash',
            messages=[{'role': 'system', 'content': SYSTEM_PROMPT}] + req.messages,
            thinking={'type': 'enabled'},
            max_tokens=65536,
            temperature=1.0,
        )
        return {
            'content': response.choices[0].message.content,
            'reasoning_content': getattr(response.choices[0].message, 'reasoning_content', None),
        }
    except Exception as e:
        raise HTTPException(500, str(e))
