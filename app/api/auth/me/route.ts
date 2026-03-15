import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userEmail = cookieStore.get('user_email');

  if (userEmail && userEmail.value) {
    return NextResponse.json({ authenticated: true, email: userEmail.value });
  }

  return NextResponse.json({ authenticated: false });
}
