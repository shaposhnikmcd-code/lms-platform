import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'courseId обовязковий' }, { status: 400 });
    }

    const certificate = await prisma.certificate.findUnique({
      where: {
        userId_courseId: {
          userId: (session.user as any).id,
          courseId,
        },
      },
      include: { course: true },
    });

    if (!certificate) {
      return NextResponse.json({ error: 'Сертифікат не знайдено' }, { status: 404 });
    }

    const issuedAt = new Date(certificate.issuedAt).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const studentName = escapeHtml(session.user.name || 'Студент');
    const courseName = escapeHtml(certificate.course.title);

    // Генеруємо HTML сертифікат
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Сертифікат — ${courseName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 40px;
    }
    .certificate {
      width: 900px;
      min-height: 600px;
      border: 4px solid #1C3A2E;
      padding: 60px;
      text-align: center;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .certificate::before {
      content: '';
      position: absolute;
      inset: 8px;
      border: 1px solid #D4A017;
      pointer-events: none;
    }
    .label {
      font-size: 13px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #D4A017;
      font-weight: 600;
    }
    .org {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      color: #1C3A2E;
      font-weight: 700;
    }
    .text {
      font-size: 16px;
      color: #666;
      font-weight: 300;
    }
    .name {
      font-family: 'Playfair Display', serif;
      font-size: 40px;
      color: #1C3A2E;
      font-weight: 700;
    }
    .course {
      font-size: 22px;
      color: #D4A017;
      font-weight: 600;
    }
    .divider {
      width: 160px;
      height: 2px;
      background: #D4A017;
      margin: 8px auto;
    }
    .date {
      font-size: 13px;
      color: #999;
    }
    .footer {
      font-size: 13px;
      color: #1C3A2E;
      font-weight: 600;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <p class="label">Сертифікат про завершення</p>
    <p class="org">UIMP</p>
    <div class="divider"></div>
    <p class="text">Цим підтверджується, що</p>
    <p class="name">${studentName}</p>
    <p class="text">успішно завершив(ла) курс</p>
    <p class="course">${courseName}</p>
    <div class="divider"></div>
    <p class="date">Дата видачі: ${issuedAt}</p>
    <p class="footer">Український інститут психотерапії</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="certificate-${courseId}.html"`,
      },
    });
  } catch (error) {
    console.error('Помилка генерації сертифікату:', error);
    return NextResponse.json({ error: 'Помилка сервера' }, { status: 500 });
  }
}