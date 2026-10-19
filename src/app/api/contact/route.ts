import { NextResponse } from 'next/server'
export async function POST() { return NextResponse.json({success:true,message:'هذه نسخة عرض، لم يتم إرسال رسالة فعلية.'}) }
