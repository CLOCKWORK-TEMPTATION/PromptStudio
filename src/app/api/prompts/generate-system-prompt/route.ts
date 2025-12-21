
import { NextRequest, NextResponse } from 'next/server';
import { LLMServiceAdapter } from '@/backend/services/LLMServiceAdapter.js';

export async function POST(req: NextRequest) {
    try {
        const { task, provider } = await req.json();

        if (!task) {
            return NextResponse.json({ error: 'Task description is required' }, { status: 400 });
        }

        const systemPrompt = await LLMServiceAdapter.generateSystemPrompt(task, provider || 'openai');

        return NextResponse.json({ systemPrompt });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
