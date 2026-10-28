const form=document.getElementById("complaint-form");
const message=document.getElementById("message");
const list=document.getElementById("complaint-list");
function el(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
async function loadComplaints(){
  list.replaceChildren(el("p","Loading complaints...","note"));
  try{
    const res=await fetch("/complaints");
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Unable to load complaints.");
    list.replaceChildren();
    if(!data.complaints||!data.complaints.length){list.appendChild(el("p","No complaints submitted yet.","note"));return;}
    data.complaints.forEach(c=>{
      const card=document.createElement("article");card.className="complaint";
      const top=document.createElement("div");top.className="row";
      top.appendChild(el("strong","Complaint #"+c.id));
      top.appendChild(el("span",c.urgency,c.urgency==="Urgent"?"badge urgent":"badge"));
      card.appendChild(top);
      card.appendChild(el("p",c.category+" • "+c.area));
      card.appendChild(el("p",c.description));
      card.appendChild(el("small",(c.name||"Anonymous")+" · "+c.role+" · Status: "+c.status));
      list.appendChild(card);
    });
  }catch(e){list.replaceChildren(el("p","Could not load complaints: "+e.message,"note"));}
}
form.addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=document.getElementById("submit-btn");btn.disabled=true;btn.textContent="Submitting...";
  const fd=new FormData(form);const payload=Object.fromEntries(fd.entries());
  message.hidden=false;message.textContent="Submitting your complaint...";
  try{
    const res=await fetch("/complaints",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error)throw new Error(data.error||"Submission failed.");
    message.textContent="Complaint submitted successfully. Your complaint ID is #"+data.id+". Status: "+data.status+". Please save this ID for reference.";
    form.reset();await loadComplaints();
  }catch(err){message.textContent="Could not submit: "+err.message;}
  finally{btn.disabled=false;btn.textContent="Submit complaint";}
});
document.getElementById("refresh").addEventListener("click",loadComplaints);
loadComplaints();
