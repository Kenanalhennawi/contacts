export default {
  async fetch(request, env) {
    const origin=request.headers.get("Origin")||"";
    const headers=corsHeaders(origin,env);
    if(request.method==="OPTIONS") return new Response(null,{headers});
    if(request.method!=="POST") return json(404,{success:false,error:"Not Found"},headers);
    try{
      const ct=(request.headers.get("Content-Type")||"").toLowerCase();
      if(!ct.includes("application/json")) return json(400,{success:false,error:"Content-Type must be application/json"},headers);
      const body=await request.json();
      console.log("Received request:", JSON.stringify(body, null, 2));
      
      if(body.type==="email"){
        const {sendTo,subject,text,html}=body;
        if(!sendTo||!subject||!text) return json(400,{success:false,error:"Missing fields: sendTo, subject, text"},headers);
        
        // Check if environment variables are set
        if(!env.SENDGRID_API_KEY) return json(500,{success:false,error:"SENDGRID_API_KEY not configured"},headers);
        if(!env.FROM_EMAIL) return json(500,{success:false,error:"FROM_EMAIL not configured"},headers);
        
        const payload={
          personalizations:[{to:[{email:sendTo}]}],
          from:{email:env.FROM_EMAIL,name:env.FROM_NAME||"Website"},
          subject,
          content:[
            {type:"text/plain",value:text},
            {type:"text/html",value:html||text.replace(/\n/g,"<br>")}
          ]
        };
        
        console.log("Sending to SendGrid:", JSON.stringify(payload, null, 2));
        
        const r=await fetch("https://api.sendgrid.com/v3/mail/send",{
          method:"POST",
          headers:{Authorization:`Bearer ${env.SENDGRID_API_KEY}`,"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        
        if(!r.ok){
          const err=await r.text();
          console.error("SendGrid error:", r.status, err);
          return json(502,{success:false,error:`SendGrid error (${r.status}): ${err}`},headers);
        }
        return json(200,{success:true},headers);
      }
      if(body.type==="whatsapp"){
        const {sendTo,text}=body;
        if(!sendTo||!text) return json(400,{success:false,error:"Missing fields: sendTo, text"},headers);
        const payload={
          messaging_product:"whatsapp",
          to:sendTo,
          type:"text",
          text:{body:text}
        };
        const r=await fetch(`https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
          method:"POST",
          headers:{Authorization:`Bearer ${env.WHATSAPP_TOKEN}`,"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        if(!r.ok){const err=await r.text();return json(502,{success:false,error:err||"WhatsApp API error"},headers);}
        return json(200,{success:true},headers);
      }
      return json(400,{success:false,error:"Unknown type"},headers);
    }catch(e){
      console.error("Worker error:", e);
      return json(500,{success:false,error:e.message||"Server error"},headers);
    }
  }
};
function corsHeaders(origin,env){
  const list=String(env.ALLOWED_ORIGIN||"").split(",").map(s=>s.trim()).filter(Boolean);
  const allow=list.length===0||list.includes(origin);
  return {"Access-Control-Allow-Origin":allow?origin:"null","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
}
function json(status,obj,headers){
  return new Response(JSON.stringify(obj),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
}
