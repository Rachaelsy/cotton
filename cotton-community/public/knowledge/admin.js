const token = localStorage.getItem('admin_token') || ''
if (!token) location.href = '/knowledge/admin-login.html'
const state = { contents:[], comments:[], questions:[], answers:[] }
const $ = id => document.getElementById(id)
const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char])
const typeName = { video:'视频课', article:'图文课', gallery:'图集课' }
const parseList = value => { if(Array.isArray(value))return value; try{return JSON.parse(value||'[]')}catch{return[]} }
async function api(path, options={}) {
  const response=await fetch(`/api/knowledge/admin${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(options.headers||{})}})
  const result=await response.json().catch(()=>({msg:'请求失败'})); if(response.status===401){localStorage.removeItem('admin_token');location.href='/knowledge/admin-login.html';throw new Error('登录已过期')} if(!response.ok||result.code!==200)throw new Error(result.msg||'请求失败'); return result.data
}
async function loadStats(){const d=await api('/stats');$('statTotal').textContent=d.total;$('statPublished').textContent=d.published;$('statViews').textContent=d.views;$('statLearners').textContent=d.learners;$('statComments').textContent=d.comments}
async function loadContents(){state.contents=await api('/contents');renderContents();populateCommentFilters()}
function renderContents(){
  $('contentTable').innerHTML=state.contents.length?state.contents.map(item=>`<tr><td><img class="thumb" src="${esc(item.coverUrl||'/assets/cotton-field-sky.png')}" alt=""></td><td><strong>${esc(item.title)}</strong><br><span class="question-excerpt">${esc(item.subtitle)}</span></td><td>${typeName[item.type]||item.type}<br>${esc(item.categoryName)}</td><td><span class="status-pill ${item.status}">${item.status==='published'?'已上架':'草稿'}</span>${item.isFeatured?'<br><span class="status-pill">推荐</span>':''}</td><td>${item.viewCount}</td><td>${item.commentCount}</td><td>${item.sortOrder}</td><td><div class="table-actions"><button class="small-btn primary" data-edit="${item.id}">编辑</button><button class="small-btn" data-toggle="${item.id}" data-status="${item.status}">${item.status==='published'?'下架':'上架'}</button><button class="small-btn danger" data-delete="${item.id}">删除</button></div></td></tr>`).join(''):'<tr><td colspan="8">暂无内容</td></tr>'
  document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(Number(b.dataset.edit))))
  document.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>toggleContent(b.dataset.toggle,b.dataset.status)))
  document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteContent(b.dataset.delete)))
}
function populateCommentFilters(){
  const categoryValue=$('commentCategory').value
  const contentValue=$('commentContent').value
  const categories=[...new Map(state.contents.map(item=>[item.categoryKey,item.categoryName])).entries()]
  $('commentCategory').innerHTML='<option value="">全部专区</option>'+categories.map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('')
  if(categories.some(([key])=>key===categoryValue))$('commentCategory').value=categoryValue
  const category=$('commentCategory').value
  const contents=state.contents.filter(item=>!category||item.categoryKey===category)
  $('commentContent').innerHTML='<option value="">全部课程</option>'+contents.map(item=>`<option value="${item.id}">${esc(item.title)}</option>`).join('')
  if(contents.some(item=>String(item.id)===String(contentValue)))$('commentContent').value=contentValue
}
async function loadComments(){
  const params=new URLSearchParams()
  if($('commentStatus').value)params.set('status',$('commentStatus').value)
  if($('commentCategory').value)params.set('category_key',$('commentCategory').value)
  if($('commentContent').value)params.set('content_id',$('commentContent').value)
  if($('commentQuery').value.trim())params.set('q',$('commentQuery').value.trim())
  state.comments=await api(`/comments${params.size?`?${params}`:''}`)
  $('commentResultCount').textContent=`${state.comments.length} 条结果`
  $('commentTable').innerHTML=state.comments.length?state.comments.map(x=>`<tr>
    <td><span class="status-pill">${esc(x.category_name)}</span></td>
    <td><a class="table-link" href="/knowledge/detail.html?id=${x.content_id}" target="_blank">${esc(x.content_title)}</a></td>
    <td>${esc(x.nickname)}</td><td class="comment-cell">${x.parent_id?`<div class="comment-reply-target">${x.parent_nickname?`回复 @${esc(x.parent_nickname)}`:'原评论已删除'}</div>`:''}${esc(x.body)}</td>
    <td>${new Date(x.created_at).toLocaleString('zh-CN')}</td>
    <td><span class="status-pill ${x.status}">${x.status==='visible'?'公开':'隐藏'}</span></td>
    <td><div class="table-actions"><button class="small-btn" data-comment-status="${x.id}" data-status="${x.status}">${x.status==='visible'?'隐藏':'恢复'}</button><button class="small-btn danger" data-comment-delete="${x.id}">删除</button></div></td>
  </tr>`).join(''):'<tr><td colspan="7">当前筛选下暂无评论</td></tr>'
  document.querySelectorAll('[data-comment-status]').forEach(b=>b.addEventListener('click',()=>commentStatus(b.dataset.commentStatus,b.dataset.status)))
  document.querySelectorAll('[data-comment-delete]').forEach(b=>b.addEventListener('click',()=>deleteComment(b.dataset.commentDelete)))
}
async function loadForum(){const d=await api('/forum');state.questions=d.questions||[];state.answers=d.answers||[];$('questionTable').innerHTML=state.questions.length?state.questions.map(q=>`<tr><td>${esc(q.title)}</td><td>${esc(q.nickname)}</td><td>${esc(q.categoryName)}</td><td>${q.answerCount}</td><td><span class="status-pill ${q.status==='hidden'?'hidden':''}">${esc(q.status)}</span></td><td><button class="small-btn" data-qstatus="${q.id}" data-status="${q.status}">${q.status==='hidden'?'恢复':'隐藏'}</button></td></tr>`).join(''):'<tr><td colspan="6">暂无问题</td></tr>';$('answerTable').innerHTML=state.answers.length?state.answers.map(a=>`<tr><td>${esc(a.question_title)}</td><td>${esc(a.nickname)}</td><td>${esc(String(a.body).slice(0,180))}</td><td>${a.vote_count}</td><td><span class="status-pill ${a.status}">${a.status==='visible'?'公开':'隐藏'}</span></td><td><button class="small-btn" data-astatus="${a.id}" data-status="${a.status}">${a.status==='visible'?'隐藏':'恢复'}</button></td></tr>`).join(''):'<tr><td colspan="6">暂无回答</td></tr>';document.querySelectorAll('[data-qstatus]').forEach(b=>b.addEventListener('click',()=>forumQuestionStatus(b.dataset.qstatus,b.dataset.status)));document.querySelectorAll('[data-astatus]').forEach(b=>b.addEventListener('click',()=>forumAnswerStatus(b.dataset.astatus,b.dataset.status)))}
function showPanel(view){document.querySelectorAll('.admin-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));$('contentsPanel').classList.toggle('hidden',view!=='contents');$('commentsPanel').classList.toggle('hidden',view!=='comments');$('forumPanel').classList.toggle('hidden',view!=='forum');if(view==='comments')loadComments().catch(e=>alert(e.message));if(view==='forum')loadForum().catch(e=>alert(e.message))}
document.querySelectorAll('.admin-tab').forEach(t=>t.addEventListener('click',()=>showPanel(t.dataset.view)))
function openModal(){ $('contentModal').classList.remove('hidden') }
function closeModal(){ $('contentModal').classList.add('hidden'); $('contentForm').reset(); $('contentId').value=''; $('contentMessage').textContent='' }
function categoryValue(item){return `${item.categoryKey}|${item.categoryName}`}
function fillForm(item={}){$('contentId').value=item.id||'';$('cType').value=item.type||'video';$('cDifficulty').value=item.difficulty||'intro';$('cTitle').value=item.title||'';$('cSubtitle').value=item.subtitle||'';const option=[...$('cCategory').options].find(x=>x.value===categoryValue(item));$('cCategory').value=option?option.value:'other|其他知识';$('cTags').value=(item.tags||[]).join('，');$('cCover').value=item.coverUrl||'';$('cVideo').value=item.videoUrl||'';$('cImages').value=(item.images||[]).join('\n');$('cBody').value=item.content||'';$('cQuiz').value=item.quiz&&item.quiz.length?JSON.stringify(item.quiz,null,2):'';$('cDuration').value=item.durationSeconds||300;$('cSort').value=item.sortOrder||0;$('cSource').value=item.sourceName||'棉花智能体知识中心';$('cPublished').checked=item.status==='published';$('cFeatured').checked=!!item.isFeatured}
function openEdit(id){const item=state.contents.find(x=>x.id===id);if(!item)return;fillForm(item);$('contentModalTitle').textContent='编辑内容';openModal()}
$('addContentBtn').addEventListener('click',()=>{fillForm();$('contentModalTitle').textContent='新增内容';openModal()});$('closeContentModal').addEventListener('click',closeModal);$('cancelContent').addEventListener('click',closeModal)
async function uploadFile(input,statusId,targetId){const file=input.files[0];if(!file)return;$(statusId).textContent=`正在上传 ${file.name}...`;const form=new FormData();form.append('file',file);try{const response=await fetch('/api/knowledge/admin/upload',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const result=await response.json();if(!response.ok||result.code!==200)throw new Error(result.msg||'上传失败');$(targetId).value=result.data.url;$(statusId).textContent='上传完成'}catch(e){$(statusId).textContent=e.message}finally{input.value=''}}
$('coverFile').addEventListener('change',e=>uploadFile(e.target,'coverStatus','cCover'));$('videoFile').addEventListener('change',e=>uploadFile(e.target,'videoStatus','cVideo'))
$('contentForm').addEventListener('submit',async event=>{
  event.preventDefault()
  const id=$('contentId').value
  const [category_key,category_name]=$('cCategory').value.split('|')
  let quiz=[]
  try {
    const raw=$('cQuiz').value.trim()
    quiz=raw?JSON.parse(raw):[]
    if(!Array.isArray(quiz))throw new Error('课后小测必须是 JSON 数组')
  } catch(e) {
    $('contentMessage').textContent=`小测格式错误：${e.message}`
    return
  }
  const body={type:$('cType').value,difficulty:$('cDifficulty').value,title:$('cTitle').value,subtitle:$('cSubtitle').value,category_key,category_name,tags:$('cTags').value,cover_url:$('cCover').value,video_url:$('cVideo').value,images:$('cImages').value,content:$('cBody').value,quiz,duration_seconds:$('cDuration').value,sort_order:$('cSort').value,source_name:$('cSource').value,status:$('cPublished').checked?'published':'draft',is_featured:$('cFeatured').checked}
  $('contentMessage').textContent='正在保存...'
  try{await api(`/contents${id?`/${id}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(body)});closeModal();await Promise.all([loadContents(),loadStats()])}catch(e){$('contentMessage').textContent=e.message}
})
async function toggleContent(id,status){try{await api(`/contents/${id}/status`,{method:'PATCH',body:JSON.stringify({status:status==='published'?'draft':'published'})});await Promise.all([loadContents(),loadStats()])}catch(e){alert(e.message)}}
async function deleteContent(id){if(!confirm('删除后课程、评论和学习记录都会清除，确定继续？'))return;try{await api(`/contents/${id}`,{method:'DELETE'});await Promise.all([loadContents(),loadStats()])}catch(e){alert(e.message)}}
async function commentStatus(id,status){try{await api(`/comments/${id}/status`,{method:'PATCH',body:JSON.stringify({status:status==='visible'?'hidden':'visible'})});await Promise.all([loadComments(),loadStats()])}catch(e){alert(e.message)}}
async function deleteComment(id){if(!confirm('永久删除这条评论？'))return;try{await api(`/comments/${id}`,{method:'DELETE'});await Promise.all([loadComments(),loadStats()])}catch(e){alert(e.message)}}
async function forumQuestionStatus(id,status){try{await api(`/forum/questions/${id}/status`,{method:'PATCH',body:JSON.stringify({status:status==='hidden'?'open':'hidden'})});await loadForum()}catch(e){alert(e.message)}}
async function forumAnswerStatus(id,status){try{await api(`/forum/answers/${id}/status`,{method:'PATCH',body:JSON.stringify({status:status==='visible'?'hidden':'visible'})});await loadForum()}catch(e){alert(e.message)}}
$('commentCategory').addEventListener('change',()=>{populateCommentFilters();loadComments().catch(e=>alert(e.message))})
$('commentContent').addEventListener('change',()=>loadComments().catch(e=>alert(e.message)))
$('commentStatus').addEventListener('change',()=>loadComments().catch(e=>alert(e.message)))
$('commentSearchBtn').addEventListener('click',()=>loadComments().catch(e=>alert(e.message)))
$('commentQuery').addEventListener('keydown',event=>{if(event.key==='Enter')loadComments().catch(e=>alert(e.message))})
$('commentResetBtn').addEventListener('click',()=>{$('commentCategory').value='';populateCommentFilters();$('commentContent').value='';$('commentStatus').value='';$('commentQuery').value='';loadComments().catch(e=>alert(e.message))})
Promise.all([loadStats(),loadContents()]).then(()=>{
  const query=new URLSearchParams(location.search)
  const editId=Number(query.get('edit'))
  const commentContent=query.get('content')
  if(editId)openEdit(editId)
  if(query.get('view')==='comments'||commentContent){
    showPanel('comments')
    if(commentContent){$('commentContent').value=commentContent;loadComments().catch(e=>alert(e.message))}
  } else if(query.get('view')==='forum') showPanel('forum')
}).catch(error=>alert(error.message))
