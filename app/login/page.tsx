export default function Login() {
  return (
    <main style={{padding:40,fontFamily:"Arial"}}>

      <h1>Login</h1>

      <div style={{marginTop:20}}>
        <input placeholder="Email" style={{display:"block",marginBottom:10,padding:10}}/>
        <input placeholder="Password" type="password" style={{display:"block",marginBottom:10,padding:10}}/>

        <button style={{padding:"10px 20px"}}>
          Увійти
        </button>
      </div>

    </main>
  )
}