import { prisma } from "@/lib/prisma"

type Props = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonPage({ params }: Props) {
  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId
    }
  })

  if (!lesson) {
    return <div>Lesson not found</div>
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>{lesson.title}</h1>

      {lesson.videoUrl && (
        <iframe
          width="800"
          height="450"
          src={lesson.videoUrl}
          allowFullScreen
        />
      )}

      <p>{lesson.content}</p>
    </div>
  )
}