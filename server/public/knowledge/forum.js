const id = Number(new URLSearchParams(location.search).get('id'))
const state = {
  token:localStorage.getItem('knowledge_token')||'',
  user:JSON.parse(localStorage.getItem('knowledge_user')||'null'),
  adminToken:localStorage.getItem('admin_token')||'', isAdmin:false,
  question:null, answers:[], viewer:null
}
const $ = value => document.getElementById(value)
const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char])
const dateText = value => value ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''
async function api(path, options={}) {
  const response=await fetch(`/api/knowledge${path}`,{...options,headers:{'Content-Type':'application/json',...(state.token?{Authorization:`Bearer ${state.token}`}:{})}})
  const result=await response.json().catch(()=>({msg:'请求失败'})); if(!response.ok||result.code!==200)throw new Error(result.msg||'请求失败'); return result.data
}
async function adminApi(path, options={}){
  const response=await fetch(`/api/knowledge/admin${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${state.adminToken}`}})
  const result=await response.json().catch(()=>({msg:'管理操作失败'}));if(!response.ok||result.code!==200)throw new Error(result.msg||'管理操作失败');return result.data
}
async function initAdminMode(){if(!state.adminToken)return;try{await adminApi('/stats');state.isAdmin=true;$('adminPreviewBar').classList.remove('hidden');$('forumAdminActions').classList.remove('hidden');if(!state.token)$('accountBtn').textContent='管理员'}catch{}}
function requireLogin(){ if(state.token)return true; if(confirm('回答、点赞和采纳需要先登录，是否返回首页登录？')) location.href='/knowledge/'; return false }
function render(){
  const q=state.question; document.title=`${q.title} · 棉知学堂`; $('questionTitle').textContent=q.title; $('questionBody').textContent=q.body
  $('questionTags').innerHTML=`<span class="tag">${esc(q.categoryName)}</span>${q.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}`
  $('questionMeta').innerHTML=`<span>${esc(q.nickname)} 提问</span><span>${dateText(q.createdAt)}</span><span>${q.viewCount} 次浏览</span>`
  $('answerCount').textContent=state.answers.length; $('solvedState').innerHTML=q.status==='solved'?'<span class="solved">已采纳答案</span>':'等待更多回答'
  $('answerList').innerHTML=state.answers.length?state.answers.map(a=>`<article class="answer ${a.isAccepted?'accepted':''}">
    <button class="vote-btn ${a.isVoted?'active':''}" data-vote="${a.id}" title="这个回答有帮助">▲<br>${a.voteCount}</button>
    <div>${a.isAccepted?'<span class="accepted-label">已采纳回答</span>':''}<div class="answer-body">${esc(a.body)}</div><div class="answer-meta">${esc(a.nickname)} · ${dateText(a.createdAt)} ${state.viewer&&Number(state.viewer.id)===Number(q.userId)&&!q.acceptedAnswerId?`<button class="btn ghost" data-accept="${a.id}">采纳这个回答</button>`:''}</div>${state.isAdmin?`<div class="comment-admin-actions"><button class="small-btn danger" data-admin-hide-answer="${a.id}">隐藏回答</button></div>`:''}</div>
  </article>`).join(''):'<div class="empty">还没有回答，欢迎分享第一个建议</div>'
  document.querySelectorAll('[data-vote]').forEach(btn=>btn.addEventListener('click',async()=>{if(!requireLogin())return;try{await api(`/forum/answers/${btn.dataset.vote}/vote`,{method:'POST'});await load()}catch(e){alert(e.message)}}))
  document.querySelectorAll('[data-accept]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('确定采纳这个回答？'))return;try{await api(`/forum/${id}/accept/${btn.dataset.accept}`,{method:'PATCH'});await load()}catch(e){alert(e.message)}}))
  document.querySelectorAll('[data-admin-hide-answer]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('隐藏这条回答？'))return;try{await adminApi(`/forum/answers/${btn.dataset.adminHideAnswer}/status`,{method:'PATCH',body:JSON.stringify({status:'hidden'})});await load()}catch(e){alert(e.message)}}))
  $('loading').classList.add('hidden'); $('content').classList.remove('hidden')
}
async function load(){const data=await api(`/forum/${id}`);state.question=data.question;state.answers=data.answers||[];state.viewer=data.viewer;render()}
$('accountBtn').textContent=state.user?(state.user.real_name||state.user.company_name||'已登录'):'登录'
$('accountBtn').addEventListener('click',()=>{if(state.isAdmin&&!state.token){location.href='/knowledge/admin.html';return}if(state.token){if(confirm('退出当前账号？')){localStorage.removeItem('knowledge_token');localStorage.removeItem('knowledge_user');location.reload()}}else location.href='/knowledge/'})
$('answerForm').addEventListener('submit',async event=>{event.preventDefault();if(!requireLogin())return;const body=$('answerBody').value.trim();if(body.length<5)return alert('回答至少需要5个字');try{await api(`/forum/${id}/answers`,{method:'POST',body:JSON.stringify({body})});$('answerBody').value='';await load()}catch(e){alert(e.message)}})
$('adminHideQuestion').addEventListener('click',async()=>{if(!state.isAdmin||!confirm('隐藏这个问题及其公开入口？'))return;try{await adminApi(`/forum/questions/${id}/status`,{method:'PATCH',body:JSON.stringify({status:'hidden'})});location.href='/knowledge/?view=forum'}catch(e){alert(e.message)}})
if(!id)$('loading').textContent='缺少问题编号';else initAdminMode().then(load).catch(error=>$('loading').textContent=error.message)
