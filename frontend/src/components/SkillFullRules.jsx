import React from 'react';
import productSnapshot from '../data/productCreationSkill.json';
import imageSnapshot from '../data/productImageSkill.json';

function DocumentBody({ text }) {
  return <div className="space-y-4 text-sm leading-7 text-slate-700 break-words">{text.split(/\n\n+/).map((paragraph, i) => {
    if (/^#{1,6} /.test(paragraph) && !paragraph.includes('\n')) return <h5 key={i} className="text-base font-semibold text-slate-900 pt-2">{paragraph.replace(/^#+ /,'')}</h5>;
    if (/^(?:- |\d+\. )/.test(paragraph)) return <ul key={i} className="list-disc pl-5 space-y-2">{paragraph.split('\n').map((line,n)=><li key={n}>{line.replace(/^(?:- |\d+\. )/,'')}</li>)}</ul>;
    return <p key={i} className="whitespace-pre-wrap">{paragraph}</p>;
  })}</div>;
}
function Chapters({ text }) {
  const parts=text.replace(/^# [^\n]+\n/, '').split(/^## /m);
  return <div className="divide-y divide-slate-200">{parts.map((part,i)=>{
    if(!part.trim())return null;
    if(i===0)return <DocumentBody key={i} text={part}/>;
    const newline=part.indexOf('\n'); const title=newline<0?part:part.slice(0,newline); const body=newline<0?'':part.slice(newline+1);
    return <details key={i} className="py-4"><summary className="text-base font-semibold text-slate-900 cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-indigo-600">{title}</summary><div className="mt-4"><DocumentBody text={body}/></div></details>;
  })}</div>;
}
export default function SkillFullRules({ skillId = 'tiktok-product-creation' }) {
  const snapshot = skillId === 'wjj-reference-product-images' ? imageSnapshot : productSnapshot;
  return <section aria-label={skillId === 'wjj-reference-product-images' ? 'WJJ创建商品图完整Skill规则' : '创建商品完整Skill规则'} className="border-t border-slate-200 pt-5 space-y-4">
    <h3 className="text-lg font-bold text-slate-900">完整执行规则</h3>
    <p className="text-sm leading-relaxed text-slate-600">同步自本机实际Skill文件。按章节展开阅读；工作台任务执行与结果回写仍待接通。</p>
    <Chapters text={snapshot.documents[0].content}/>
    {snapshot.documents.slice(1).map(document=><details key={document.file} className="border-t border-slate-200 pt-4"><summary className="text-base cursor-pointer rounded font-semibold text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-600">{document.title}</summary><div className="mt-4"><Chapters text={document.content.replace(/^---\n[\s\S]*?\n---\n/, '')}/></div></details>)}
  </section>;
}
