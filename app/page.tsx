import Link from "next/link";

export default function Home() {
  return (
    <main style={{fontFamily:"Arial",padding:40,maxWidth:900,margin:"0 auto"}}>

      
      <header style={{marginBottom:60}}>
        <h1 style={{fontSize:42}}>LMS Platform</h1>
        <p>Онлайн курси психології та саморозвитку</p>
      </header>

      <section style={{marginBottom:50}}>
        <h2>Що ви отримаєте</h2>

        <div style={{display:"grid",gap:20,marginTop:20}}>
          <div style={{padding:20,border:"1px solid #ddd"}}>📚 Відеоуроки</div>
          <div style={{padding:20,border:"1px solid #ddd"}}>🧠 Практичні завдання</div>
          <div style={{padding:20,border:"1px solid #ddd"}}>🎓 Сертифікат після курсу</div>
        </div>
      </section>

      <Link href="/courses">
        <button style={{
          padding:"14px 30px",
          fontSize:18,
          background:"#000",
          color:"#fff",
          border:"none",
          cursor:"pointer"
        }}>
          Почати навчання
        </button>
      </Link>

    </main>
  )
}