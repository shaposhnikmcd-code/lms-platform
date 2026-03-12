import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Починаємо наповнення бази даних...')

  // Створюємо курс
  const course = await prisma.course.upsert({
    where: { id: 'course-ohp-2026' },
    update: {},
    create: {
      id: 'course-ohp-2026',
      title: 'Основи християнської психології 2.0',
      description: 'Онлайн-курс Тетяни Шапошнік. Ми розглянемо людину на основі біблійної структури - духа, душі і тіла.',
      price: 0, // Тимчасово 0, потім зміниш
      published: true,
      imageUrl: '', // Додай URL зображення пізніше
    },
  })

  console.log(`✅ Створено курс: ${course.title}`)

  // Створюємо модуль 1: Тема Духа
  const module1 = await prisma.module.create({
    data: {
      title: 'Тема Духа',
      order: 1,
      courseId: course.id,
    },
  })
  console.log(`✅ Створено модуль: ${module1.title}`)

  // Уроки модуля 1
  const lessonsModule1 = [
    { title: 'Чому психологія є саме християнською в своїй першородній основі? Історія психології в розрізі християнства', date: '4 Березня', type: 'Лекція в записі' },
    { title: 'Божі облаштунки та важливість духовної частини особистості', date: '5 Березня', type: 'Лекція в записі' },
    { title: 'Яку шкоду несе сором', date: '6 Березня', type: 'Лекція в записі' },
    { title: 'Що робити з почуттям провини', date: '7 Березня', type: 'Лекція в записі' },
    { title: 'Тривога та боротьба з нею', date: '8 Березня', type: 'Лекція в записі' },
    { title: 'Практичне заняття в прямому етері. Завершення теми духа.', date: '9 Березня', time: '15:00-17:00 (за київським часом)', type: 'Практичне заняття' },
  ]

  for (let i = 0; i < lessonsModule1.length; i++) {
    const lesson = lessonsModule1[i]
    await prisma.lesson.create({
      data: {
        title: lesson.time 
          ? `${lesson.title} (${lesson.time})` 
          : lesson.title,
        order: i + 1,
        moduleId: module1.id,
        content: `**Дата:** ${lesson.date}\n\n**Тип:** ${lesson.type}\n\nОпис уроку буде додано пізніше.`,
      },
    })
  }
  console.log(`✅ Додано ${lessonsModule1.length} уроків до модуля ${module1.title}`)

  // Створюємо модуль 2: Тема Душі
  const module2 = await prisma.module.create({
    data: {
      title: 'Тема Душі',
      order: 2,
      courseId: course.id,
    },
  })
  console.log(`✅ Створено модуль: ${module2.title}`)

  // Уроки модуля 2
  const lessonsModule2 = [
    { title: 'Важливість душі', date: '11 Березня', type: 'Лекція в записі' },
    { title: 'Воля як душевний процес', date: '12 Березня', type: 'Лекція в записі' },
    { title: 'Внутрішні опори та самооцінка', date: '13 Березня', type: 'Лекція в записі' },
    { title: 'Когнітивні викривлення', date: '14 Березня', type: 'Лекція в записі' },
    { title: 'Психічні процеси та емоції', date: '15 Березня', type: 'Лекція в записі' },
    { title: 'Емоції Ісуса', date: '16 Березня', type: 'Лекція в записі' },
    { title: 'Практичне заняття в прямому етері. Завершення теми душі', date: '17 Березня', time: '15:00-17:00 (за київським часом)', type: 'Практичне заняття' },
  ]

  for (let i = 0; i < lessonsModule2.length; i++) {
    const lesson = lessonsModule2[i]
    await prisma.lesson.create({
      data: {
        title: lesson.time 
          ? `${lesson.title} (${lesson.time})` 
          : lesson.title,
        order: i + 1,
        moduleId: module2.id,
        content: `**Дата:** ${lesson.date}\n\n**Тип:** ${lesson.type}\n\nОпис уроку буде додано пізніше.`,
      },
    })
  }
  console.log(`✅ Додано ${lessonsModule2.length} уроків до модуля ${module2.title}`)

  // Створюємо модуль 3: Тема Тіла
  const module3 = await prisma.module.create({
    data: {
      title: 'Тема Тіла',
      order: 3,
      courseId: course.id,
    },
  })
  console.log(`✅ Створено модуль: ${module3.title}`)

  // Уроки модуля 3
  const lessonsModule3 = [
    { title: 'Важливість тіла та його здоров\'я', date: '18 Березня', type: 'Лекція в записі' },
    { title: 'Складна психосоматика', date: '19 Березня', type: 'Лекція в записі' },
    { title: 'Базові потреби', date: '20 Березня', type: 'Лекція в записі' },
    { title: 'Складнощі тілесних дисфункцій', date: '21 Березня', type: 'Лекція в записі' },
    { title: 'Практичне заняття в прямому етері. Завершення теми тіла та всього курсу', date: '22 Березня', time: '19:00-21:00 (за київським часом)', type: 'Практичне заняття' },
  ]

  for (let i = 0; i < lessonsModule3.length; i++) {
    const lesson = lessonsModule3[i]
    await prisma.lesson.create({
      data: {
        title: lesson.time 
          ? `${lesson.title} (${lesson.time})` 
          : lesson.title,
        order: i + 1,
        moduleId: module3.id,
        content: `**Дата:** ${lesson.date}\n\n**Тип:** ${lesson.type}\n\nОпис уроку буде додано пізніше.`,
      },
    })
  }
  console.log(`✅ Додано ${lessonsModule3.length} уроків до модуля ${module3.title}`)

  console.log('🎉 Базу даних успішно наповнено!')
}

main()
  .catch((e) => {
    console.error('❌ Помилка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })