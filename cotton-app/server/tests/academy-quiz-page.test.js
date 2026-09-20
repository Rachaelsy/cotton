const assert=require('assert/strict')
const vm=require('vm')
const fs=require('fs')
const path=require('path')
let page,submitCount=0
const navigations=[],toasts=[]
const questions=[{type:'single',title:'单选',options:['A','B']},{type:'multiple',title:'多选',options:['A','B','C']},{type:'boolean',title:'判断',options:['正确','错误']}]
const auth={isLoggedIn:()=>true,request:async(method,url,body)=>{
 if(url.endsWith('/start'))return {code:200,data:{id:'attempt',title:'测验',seriesKey:'series',questions}}
 if(url.endsWith('/submit')){submitCount++;return {code:200,data:{score:67,passed:true,correctCount:2,results:questions.map((q,i)=>({...q,answer:i===1?[0,2]:[0],selected:body.answers[i],correct:i!==2}))}}}
}}
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../../cotton-public/pages/academy/quiz.js'),'utf8'),{
 require:()=>auth,Page:p=>page=p,wx:{showToast:o=>toasts.push(o),navigateTo:o=>navigations.push(o.url),redirectTo:o=>navigations.push(o.url)},console
})
page.setData=function(data){Object.assign(this.data,data)}
const pick=i=>page.select({currentTarget:{dataset:{index:i}}})
async function run(){
 page.key='quiz';await page.start()
 await page.submit();assert.equal(submitCount,0);assert.equal(page.data.index,0)
 pick(0);pick(1);assert.equal(JSON.stringify(page.answers[0]),'[1]')
 page.next();pick(0);pick(2);pick(0);assert.equal(JSON.stringify(page.answers[1]),'[2]');pick(0)
 page.previous();assert.equal(page.data.options[1].selected,true)
 await page.submit();assert.equal(submitCount,0);assert.equal(page.data.index,2)
 pick(1);await page.submit();assert.equal(submitCount,1);assert.equal(page.data.result.score,67)
 page.toggleWrong();assert.equal(page.data.visibleReviews.length,1)
 page.toggleWrong();assert.equal(page.data.visibleReviews.length,3)
 await page.start();assert.equal(page.data.result,null);assert.equal(page.answers.every(a=>a.length===0),true)
 page.directory();assert.match(navigations.at(-1),/series\?id=series/)
 console.log('Quiz page single/multiple/boolean selection, answer retention, missing-answer checks, review and retry passed')
}
run().catch(e=>{console.error(e);process.exitCode=1})
