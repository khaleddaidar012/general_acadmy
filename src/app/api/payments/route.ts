import { NextResponse } from 'next/server'
export async function GET(){return NextResponse.json({available:false,orders:[],mode:'test'})}
export async function POST(){return NextResponse.json({error:'هذه نسخة عرض. الدفع الحقيقي غير مفعّل.'},{status:403})}
