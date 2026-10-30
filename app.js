import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase web config supplied for this project. Firebase rules must be deployed; see README.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBmSfz_YglnP4KwHaQ5bYt_GEu26UZ0RwU",
  authDomain: "eventregistration-2b0a2.firebaseapp.com",
  projectId: "eventregistration-2b0a2",
  storageBucket: "eventregistration-2b0a2.firebasestorage.app",
  messagingSenderId: "903456218696",
  appId: "1:903456218696:web:92b0d87aaae7590590c27d",
  measurementId: "G-S27SC862CJ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const eventModal = new bootstrap.Modal($("eventModal"));
const confirmModal = new bootstrap.Modal($("confirmModal"));
const toast = new bootstrap.Toast($("appToast"), { delay: 3200 });
let currentUser = null, currentProfile = null, currentEvents = [], currentRegistrations = [], currentStudents = [], activeFilter = "All", pendingEvent = null, unsubscribeEvents = null, unsubscribeRegs = null, unsubscribeStudents = null;
const icons = { Sports:"🏆", Dance:"💃", Singing:"🎤", Arts:"🎨", Technology:"💡", Other:"✳" };
const seedEvents = [
  {name:"Cricket Championship",category:"Sports",description:"Bring your team spirit. Big hits, bold plays, and campus glory.",date:futureDate(10),time:"09:00",venue:"College Sports Ground"},
  {name:"Volleyball Face-off",category:"Sports",description:"Six on court, one shared goal. Rally together and own the court.",date:futureDate(12),time:"10:30",venue:"Outdoor Volleyball Court"},
  {name:"Badminton Smash",category:"Sports",description:"Fast feet, sharp focus, and friendly competition.",date:futureDate(14),time:"14:00",venue:"Indoor Games Hall"},
  {name:"Move With The Beat",category:"Dance",description:"Solo, duo, or crew. Bring a routine and leave the stage glowing.",date:futureDate(16),time:"16:00",venue:"Main Auditorium"},
  {name:"Campus Voice",category:"Singing",description:"Acoustic, classical, or your favourite cover. This mic is yours.",date:futureDate(18),time:"15:30",venue:"Open-Air Stage"},
  {name:"Art After Hours",category:"Arts",description:"Sketch, paint, and make something unexpected with fellow creators.",date:futureDate(20),time:"11:00",venue:"Creative Arts Studio"}
];
function futureDate(days){const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showToast(message){$("toastMessage").textContent=message;toast.show();}
function setError(id,msg=""){ $(id).textContent=msg; }
function friendlyAuthError(error, isSignup=false){
  const code=error?.code||"";
  if(code==="auth/email-already-in-use") return "Email already exists. Please sign in or use another email.";
  if(code==="auth/invalid-email") return "Please enter a valid email address.";
  if(code==="auth/weak-password") return "Password is too weak. Use at least 8 characters with mixed character types.";
  if(code==="auth/invalid-credential"||code==="auth/wrong-password"||code==="auth/user-not-found") return "Email or password is incorrect.";
  if(code==="auth/too-many-requests") return "Too many attempts. Please wait a little and try again.";
  if(code==="auth/network-request-failed") return "Network error. Check your internet connection.";
  if(code==="permission-denied"||code==="firestore/permission-denied") return "Database access denied. Check the Firestore rules in README.";
  if(code==="auth/operation-not-allowed") return "Email/Password sign-in is disabled. Enable it in Firebase Authentication settings.";
  return isSignup ? "Could not create account. Check Firebase setup and try again." : "Could not sign in. Check your details and Firebase setup.";
}
function passwordChecks(p){return {length:p.length>=8,upper:/[A-Z]/.test(p),lower:/[a-z]/.test(p),number:/[0-9]/.test(p),symbol:/[^A-Za-z0-9]/.test(p)};}
function passwordScore(p){return Object.values(passwordChecks(p)).filter(Boolean).length;}
function updateStrength(){
  const p=$("signupPassword").value, checks=passwordChecks(p), score=passwordScore(p);
  const rules={ruleLength:checks.length,ruleUpper:checks.upper,ruleLower:checks.lower,ruleNumber:checks.number,ruleSymbol:checks.symbol};
  Object.entries(rules).forEach(([id,ok])=>$(id).classList.toggle("ok",ok));
  $("strengthBar").style.width=`${score*20}%`;
  $("strengthBar").style.background=score<=2?"#ff6485":score<=4?"#ffc76a":"#d8ff75";
  $("strengthLabel").textContent=!p?"Password strength":score<=2?"Weak":score<=4?"Getting stronger":"Strong";
}
function setMode(mode){
  $("loginFormWrap").classList.toggle("d-none",mode!=="login");$("signupFormWrap").classList.toggle("d-none",mode!=="signup");
  document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  setError("loginError");setError("signupError");
}
document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
document.querySelectorAll(".show-password").forEach(b=>b.addEventListener("click",()=>{const input=$(b.dataset.target);input.type=input.type==="password"?"text":"password";b.textContent=input.type==="password"?"Show":"Hide";}));
$("signupPassword").addEventListener("input",updateStrength);
$("signupForm").addEventListener("submit",async e=>{
  e.preventDefault();setError("signupError");
  const name=$("signupName").value.trim(),email=$("signupEmail").value.trim().toLowerCase(),password=$("signupPassword").value,confirm=$("signupConfirm").value;
  if(name.length<2){setError("signupError","Please enter your full name (at least 2 characters).");return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){setError("signupError","Please enter a valid email address.");return;}
  const checks=passwordChecks(password);
  if(!Object.values(checks).every(Boolean)){setError("signupError","Password must have 8+ characters, uppercase, lowercase, a number, and a special character.");return;}
  if(password!==confirm){setError("signupError","Passwords do not match.");return;}
  const btn=e.submitter;btn.disabled=true;btn.textContent="Creating account…";
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    await updateProfile(cred.user,{displayName:name});
    await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,name,email,role:"student",createdAt:serverTimestamp(),lastLoginAt:serverTimestamp(),lastLoginText:new Date().toISOString()});
    showToast("Account created. Welcome to EventRegister!");
  }catch(err){setError("signupError",friendlyAuthError(err,true));if(auth.currentUser)await signOut(auth).catch(()=>{});}
  finally{btn.disabled=false;btn.innerHTML='Create student account <span>→</span>';}
});
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();setError("loginError");const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){setError("loginError","Please enter a valid email address.");return;}
  if(!password){setError("loginError","Please enter your password.");return;}
  const btn=e.submitter;btn.disabled=true;btn.textContent="Signing in…";
  try{await signInWithEmailAndPassword(auth,email,password);}catch(err){setError("loginError",friendlyAuthError(err));}
  finally{btn.disabled=false;btn.innerHTML='Sign in <span>→</span>';}
});
$("forgotPasswordBtn").addEventListener("click",async()=>{
  setError("loginError");setError("resetMessage");
  const email=$("loginEmail").value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
    setError("resetMessage","Enter your registered email address above first.");
    $("loginEmail").focus();return;
  }
  const btn=$("forgotPasswordBtn");btn.disabled=true;btn.textContent="Sending reset link…";
  try{
    await sendPasswordResetEmail(auth,email);
    setError("resetMessage","If this email is registered, Firebase has sent a password reset link. Check your inbox and spam folder.");
  }catch(err){
    // Log the full Firebase error in Chrome DevTools (F12 -> Console).
    console.error("PASSWORD RESET ERROR:", err);
    const code = err?.code || "unknown";
    let message;
    switch (code) {
      case "auth/invalid-email":
        message = "Please enter a valid email address.";
        break;
      case "auth/user-not-found":
        message = "No account was found for this email address. Check the email or create an account.";
        break;
      case "auth/too-many-requests":
        message = "Too many reset attempts. Please wait and try again later.";
        break;
      case "auth/operation-not-allowed":
        message = "Email/Password sign-in is disabled. Enable it in Firebase Authentication settings.";
        break;
      case "auth/unauthorized-domain":
        message = "This website domain is not authorized. Add localhost or 127.0.0.1 in Firebase Authentication > Settings > Authorized domains.";
        break;
      case "auth/network-request-failed":
        message = "Network request failed. Check your internet connection, browser extensions, and firewall.";
        break;
      case "auth/invalid-api-key":
        message = "Firebase API key is invalid or restricted. Check the Web app config and API key restrictions.";
        break;
      case "auth/invalid-continue-uri":
      case "auth/unauthorized-continue-uri":
        message = "The password reset return URL is not authorized. Check Firebase Authentication authorized domains and action URL settings.";
        break;
      default:
        message = `Firebase error: ${code}. ${err?.message || "Check the browser Console (F12) for details."}`;
    }
    setError("resetMessage", message);
  }finally{btn.disabled=false;btn.textContent="Forgot password?";}
});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
function listen(collectionName,callback,errCallback=()=>{}){
  return onSnapshot(collection(db,collectionName),snap=>callback(snap.docs.map(d=>({id:d.id,...d.data()}))),errCallback);
}
async function ensureSeedEvents(){
  const snap=await getDocs(collection(db,"events"));
  if(snap.empty){for(const event of seedEvents)await addDoc(collection(db,"events"),{...event,capacity:null,createdAt:serverTimestamp(),createdBy:"system"});}
}
function cleanupListeners(){[unsubscribeEvents,unsubscribeRegs,unsubscribeStudents].forEach(fn=>{if(fn)fn();});unsubscribeEvents=unsubscribeRegs=unsubscribeStudents=null;}
onAuthStateChanged(auth,async user=>{
  cleanupListeners();currentUser=user;
  if(!user){currentProfile=null;$("authView").classList.remove("d-none");$("appView").classList.add("d-none");return;}
  try{
    const profileRef=doc(db,"users",user.uid);let snap=await getDoc(profileRef);
    if(!snap.exists()){
      // Accounts manually created in Firebase Console must also have a users/{uid} document with role=admin/student.
      await signOut(auth);setMode("login");setError("loginError","Your profile is not configured. Ask the project admin to add your role in Firestore.");return;
    }
    currentProfile={uid:user.uid,...snap.data()};
    await updateDoc(profileRef,{lastLoginAt:serverTimestamp(),lastLoginText:new Date().toISOString()}).catch(()=>{});
    $("authView").classList.add("d-none");$("appView").classList.remove("d-none");
    $("navName").textContent=currentProfile.name||user.displayName||user.email;
    const isAdmin=currentProfile.role==="admin";
    $("roleLabel").textContent=isAdmin?"ADMIN":"STUDENT";
    $("studentView").classList.toggle("d-none",isAdmin);$("adminView").classList.toggle("d-none",!isAdmin);
    $("dashboardTitle").innerHTML=isAdmin?'Run the show. <em>Own the moment.</em>':'Find your next <em>thing.</em>';
    $("dashboardSubtitle").textContent=isAdmin?"Your campus events, students, and registrations in one place.":"A little curiosity can make a big memory.";
    if(isAdmin) await ensureSeedEvents();
    unsubscribeEvents=listen("events",events=>{currentEvents=events.sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.time||"").localeCompare(b.time||""));renderEvents();if(isAdmin)renderAdminEvents();},err=>showToast(friendlyAuthError(err)));
    unsubscribeRegs=listen("registrations",regs=>{currentRegistrations=regs;renderRegistrations();if(isAdmin){renderAdminStats();renderAdminRegistrations();}},err=>showToast(friendlyAuthError(err)));
    if(isAdmin)unsubscribeStudents=listen("users",students=>{currentStudents=students;renderStudents();renderAdminStats();},err=>showToast("Cannot load student directory. Check Firestore rules."));
  }catch(err){console.error(err);setError("loginError",friendlyAuthError(err));await signOut(auth).catch(()=>{});}
});
function eventDate(date){if(!date)return"Date to be announced";const d=new Date(`${date}T00:00:00`);return Number.isNaN(d.getTime())?date:d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});}
function eventTime(time){if(!time)return"Time to be announced";const [h,m]=time.split(":").map(Number);const d=new Date();d.setHours(h,m||0,0,0);return d.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"});}
function myRegistration(eventId){return currentRegistrations.find(r=>r.eventId===eventId&&r.studentUid===currentUser?.uid);}
function renderEvents(){
  const list=currentEvents.filter(e=>activeFilter==="All"||e.category===activeFilter);
  $("eventCount").textContent=`${list.length} EVENT${list.length===1?"":"S"}`;
  $("eventGrid").innerHTML=list.length?list.map((e,i)=>{const joined=!!myRegistration(e.id),full=e.capacity&&currentRegistrations.filter(r=>r.eventId===e.id).length>=Number(e.capacity)&&!joined;
    return `<article class="event-card" style="animation-delay:${Math.min(i,8)*50}ms"><div class="event-top"><div class="event-icon">${icons[e.category]||"✳"}</div><span class="category-pill">${esc((e.category||"Other").toUpperCase())}</span></div><h3>${esc(e.name)}</h3><p class="event-desc">${esc(e.description||"A campus event worth showing up for.")}</p><div class="event-meta"><div><span>◷</span>${esc(eventDate(e.date))} · ${esc(eventTime(e.time))}</div><div><span>⌖</span>${esc(e.venue||"Venue to be announced")}</div></div><div class="event-bottom"><span class="spots">${e.capacity?`${Math.max(0,Number(e.capacity)-currentRegistrations.filter(r=>r.eventId===e.id).length)} spots left`:"Everyone's welcome"}</span><button class="event-action ${joined?"joined":""}" data-join="${esc(e.id)}" ${full?"disabled":""}>${joined?"✓ You're in":full?"Full":"I'm interested ↗"}</button></div></article>`;}).join(""):`<div class="empty-state">No events in this category just yet. Check back soon ✳</div>`;
  $("eventGrid").querySelectorAll("[data-join]").forEach(b=>b.addEventListener("click",()=>{const event=currentEvents.find(e=>e.id===b.dataset.join);if(event&&!myRegistration(event.id)){pendingEvent=event;$("confirmTitle").textContent=`${event.name}?`;$("confirmDetails").textContent=`${eventDate(event.date)} · ${eventTime(event.time)} · ${event.venue||"Venue TBA"}`;confirmModal.show();}}));
}
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{activeFilter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));renderEvents();}));
$("confirmJoinBtn").addEventListener("click",async()=>{
  if(!pendingEvent||!currentUser||!currentProfile)return;const btn=$("confirmJoinBtn");btn.disabled=true;
  try{
    const duplicate=currentRegistrations.find(r=>r.eventId===pendingEvent.id&&r.studentUid===currentUser.uid);
    if(duplicate){showToast("You're already registered for this event.");}
    else{if(pendingEvent.capacity&&currentRegistrations.filter(r=>r.eventId===pendingEvent.id).length>=Number(pendingEvent.capacity))throw new Error("This event is full.");
      await addDoc(collection(db,"registrations"),{eventId:pendingEvent.id,eventName:pendingEvent.name,category:pendingEvent.category,studentUid:currentUser.uid,studentName:currentProfile.name||currentUser.displayName||"",studentEmail:currentUser.email,eventDate:pendingEvent.date||"",eventTime:pendingEvent.time||"",venue:pendingEvent.venue||"",createdAt:serverTimestamp()});showToast("You're on the list. See you there!");}
    confirmModal.hide();
  }catch(err){showToast(err.message||friendlyAuthError(err));}finally{btn.disabled=false;pendingEvent=null;}
});
function renderRegistrations(){
  const regs=currentRegistrations.filter(r=>r.studentUid===currentUser?.uid).sort((a,b)=>(a.eventDate||"").localeCompare(b.eventDate||""));
  $("registrationCount").textContent=`${regs.length} SAVED`;
  $("myRegistrations").innerHTML=regs.length?regs.map(r=>`<div class="registration-card"><div class="event-icon">${icons[r.category]||"✳"}</div><div><h4>${esc(r.eventName)}</h4><p>${esc(eventDate(r.eventDate))} · ${esc(eventTime(r.eventTime))}<br>${esc(r.venue||"Venue TBA")}</p></div><span class="confirmed-tag">✓ CONFIRMED</span></div>`).join(""):`<div class="empty-state">Your next campus memory goes here. Find an event and tap “I'm interested”.</div>`;
}
function renderAdminStats(){$("statStudents").textContent=currentStudents.filter(s=>s.role!=="admin").length;$("statEvents").textContent=currentEvents.length;$("statRegistrations").textContent=currentRegistrations.length;}
function renderAdminEvents(){
  $("adminEvents").innerHTML=currentEvents.length?currentEvents.map(e=>`<div class="admin-event-row"><div class="event-icon">${icons[e.category]||"✳"}</div><div class="admin-event-info"><b>${esc(e.name)}</b><small>${esc(e.category)} · ${esc(eventDate(e.date))} · ${esc(eventTime(e.time))} · ${esc(e.venue||"Venue TBA")}</small></div><div class="admin-event-actions"><button class="small-action" data-edit="${esc(e.id)}">Edit</button><button class="small-action danger" data-delete="${esc(e.id)}">Delete</button></div></div>`).join(""):`<div class="empty-state">No events yet. Create the first one.</div>`;
  $("adminEvents").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openEventEditor(currentEvents.find(e=>e.id===b.dataset.edit))));
  $("adminEvents").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{const e=currentEvents.find(x=>x.id===b.dataset.delete);if(!e)return;if(confirm(`Delete "${e.name}"? Its registration records will remain in the admin history.`)){try{await deleteDoc(doc(db,"events",e.id));showToast("Event deleted.");}catch(err){showToast(friendlyAuthError(err));}}}));
}
function renderStudents(){
  const search=($("studentSearch").value||"").trim().toLowerCase();
  const students=currentStudents.filter(s=>s.role!=="admin"&&`${s.name||""} ${s.email||""}`.toLowerCase().includes(search)).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  $("studentsTable").innerHTML=students.length?students.map(s=>`<tr><td><div class="student-cell"><b>${esc(s.name||"Student")}</b><small>${esc(s.uid||"")}</small></div></td><td>${esc(s.email||"—")}</td><td>${esc(formatLastLogin(s.lastLoginText))}</td><td><span class="status-pill">STUDENT</span></td></tr>`).join(""):`<tr><td colspan="4" class="text-center py-4 muted">No students found.</td></tr>`;
}
function formatLastLogin(s){if(!s)return"Not recorded";const d=new Date(s);return Number.isNaN(d.getTime())?"Recently":d.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});}
$("studentSearch").addEventListener("input",renderStudents);
function renderAdminRegistrations(){
  const regs=[...currentRegistrations].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  $("registrationsTable").innerHTML=regs.length?regs.map(r=>`<tr><td><div class="student-cell"><b>${esc(r.studentName||"Student")}</b><small>${esc(r.studentEmail||"")}</small></div></td><td>${esc(r.eventName||"Event")}</td><td>${esc(eventDate(r.eventDate))} · ${esc(eventTime(r.eventTime))}</td><td>${esc(r.venue||"—")}</td></tr>`).join(""):`<tr><td colspan="4" class="text-center py-4 muted">No confirmed interests yet.</td></tr>`;
}
$("newEventBtn").addEventListener("click",()=>openEventEditor());
function openEventEditor(event=null){
  $("eventForm").reset();$("eventFormError").textContent="";$("eventId").value=event?.id||"";$("modalTitle").textContent=event?"Edit event":"Create an event";$("modalEyebrow").textContent=event?"TUNE THE DETAILS":"NEW ON THE LINEUP";
  if(event){$("eventName").value=event.name||"";$("eventCategory").value=event.category||"Sports";$("eventDescription").value=event.description||"";$("eventDate").value=event.date||"";$("eventTime").value=event.time||"";$("eventVenue").value=event.venue||"";$("eventCapacity").value=event.capacity||"";}
  eventModal.show();
}
$("eventForm").addEventListener("submit",async e=>{
  e.preventDefault();$("eventFormError").textContent="";
  const data={name:$("eventName").value.trim(),category:$("eventCategory").value,description:$("eventDescription").value.trim(),date:$("eventDate").value,time:$("eventTime").value,venue:$("eventVenue").value.trim(),capacity:$("eventCapacity").value?Number($("eventCapacity").value):null};
  if(data.name.length<3||!data.date||!data.time||data.venue.length<2){$("eventFormError").textContent="Please complete the event name, date, time, and venue.";return;}
  if(data.capacity!==null&&(!Number.isInteger(data.capacity)||data.capacity<1)){$("eventFormError").textContent="Capacity must be a whole number greater than zero.";return;}
  if(data.date<futureDate(0)){$("eventFormError").textContent="Please select today or a future date.";return;}
  const id=$("eventId").value,btn=e.submitter;btn.disabled=true;btn.textContent="Saving…";
  try{if(id)await updateDoc(doc(db,"events",id),{...data,updatedAt:serverTimestamp(),updatedBy:currentUser.uid});else await addDoc(collection(db,"events"),{...data,createdAt:serverTimestamp(),createdBy:currentUser.uid});eventModal.hide();showToast(id?"Event updated.":"Event created.");}
  catch(err){$("eventFormError").textContent=friendlyAuthError(err);}finally{btn.disabled=false;btn.innerHTML='Save event <span>→</span>';}
});
